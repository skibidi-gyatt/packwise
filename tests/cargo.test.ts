import test from 'node:test';
import assert from 'node:assert/strict';
import { cargoAsset, cargoDemo } from '../lib/packing/cargo-demo';
import {
  solve,
  unloadBlockers,
  topLoads,
  validPlacement,
} from '../lib/packing/solver';
import { defaultPreferences } from '../lib/packing/model';
import type { Plan, Placement } from '../lib/packing/model';
import {
  cargoOfflineIntent,
  applyCargoIntent,
} from '../lib/packing/cargo-intent';
import {
  parseManifest,
  manifestText,
  mergePhotoCargo,
} from '../lib/packing/manifest';

// Independent conservation, overlap, straight insertion, and support checks.
function verify(plan: Plan) {
  const ps = plan.placements;
  assert.ok(ps.reduce((s, p) => s + p.item.mass, 0) <= plan.container.maxMass);
  assert.equal(new Set(ps.map((p) => p.item.id)).size, ps.length);
  for (const [idx, p] of ps.entries()) {
    for (let a = 0; a < 3; a++) {
      assert.ok(p.pos[a] >= 0);
      assert.ok(p.pos[a] + p.dims[a] <= plan.container.dims[a] + 1e-6);
    }
    assert.equal(p.axes[1], 1);
    assert.equal(p.ratio, 1);
    assert.ok(p.pos[1] + p.dims[1] <= plan.container.opening[1]);
    let supportedArea = 0;
    for (const q of ps.slice(0, idx)) {
      const overlap = [0, 1, 2].map(
        (a) =>
          Math.min(p.pos[a] + p.dims[a], q.pos[a] + q.dims[a]) -
          Math.max(p.pos[a], q.pos[a]),
      );
      assert.ok(
        overlap.some((n) => n <= 1e-6),
        'non-overlap',
      );
      assert.ok(
        !(
          overlap[0] > 1e-6 &&
          overlap[1] > 1e-6 &&
          q.pos[2] >= p.pos[2] + p.dims[2] - 1e-6
        ),
        'rear insertion corridor',
      );
      if (Math.abs(q.pos[1] + q.dims[1] - p.pos[1]) < 1e-6)
        supportedArea += Math.max(0, overlap[0]) * Math.max(0, overlap[2]);
    }
    if (p.pos[1] > 0)
      assert.ok(supportedArea >= p.dims[0] * p.dims[2] * 0.8 - 1e-6);
  }
  const loads = topLoads(ps);
  for (const p of ps) {
    assert.ok(
      (loads.get(p.item.id) ?? 0) <=
        (p.item.stackable === false ? 0 : p.item.maxTopLoad) + 1e-6,
    );
  }
  assert.ok(
    plan.metrics.floorPeakKgM2 <= plan.container.floorLimitKgM2! + 1e-6,
  );
  assert.ok(
    Math.abs(
      plan.metrics.frontMass + plan.metrics.rearMass - plan.metrics.mass,
    ) < 1e-6,
  );
}
test('cargo hero computes its improvement and conserves units, mass and volume', () => {
  const base = solve(cargoDemo, cargoAsset, 'baseline'),
    opt = solve(cargoDemo, cargoAsset);
  assert.equal(base.placements.length, 14);
  assert.equal(opt.placements.length, 20);
  assert.equal(opt.metrics.mass, 7300);
  assert.equal(opt.metrics.volume, 24900);
  assert.equal(base.metrics.utilization.toFixed(1), '50.5');
  assert.equal(opt.metrics.utilization.toFixed(1), '72.0');
  verify(base);
  verify(opt);
  assert.deepEqual(solve(cargoDemo, cargoAsset), opt);
});
test('first unload changes a blocked P14 into a directly extractable unit', () => {
  const before = solve(cargoDemo, cargoAsset),
    p14 = before.placements.find((p) => p.item.id === 'P14')!;
  assert.equal(unloadBlockers(p14, before.placements).length, 2);
  const intent = cargoOfflineIntent(
    'Shipment P14 must be unloaded first.',
    cargoDemo,
  );
  const updated = applyCargoIntent(
    intent,
    cargoDemo,
    cargoAsset,
    defaultPreferences,
  );
  const after = solve(updated.items, updated.bag, 'optimized', updated.prefs),
    p = after.placements.find((p) => p.item.id === 'P14')!;
  assert.equal(after.placements.length, 20);
  assert.equal(unloadBlockers(p, after.placements).length, 0);
  assert.equal(p.item.deliveryStop, 2);
  assert.equal(p.item.destination, 'Central medical hub');
  assert.equal(p.item.stackable, false);
  assert.notDeepEqual(p.pos, p14.pos);
  verify(after);
});
test('cargo rejects narrow doors, overweight units, floor overload and unsupported stacking', () => {
  const one = {
    ...cargoDemo[2],
    dims: [120, 100, 100] as [number, number, number],
    mass: 780,
  };
  assert.equal(
    solve([one], { ...cargoAsset, opening: [90, 230] }).placements.length,
    0,
  );
  assert.equal(
    solve([one], { ...cargoAsset, maxMass: 700 }).placements.length,
    0,
  );
  assert.equal(
    solve([one], { ...cargoAsset, floorLimitKgM2: 100 }).placements.length,
    0,
  );
  const lower: Placement = {
    item: { ...one, stackable: false },
    pos: [0, 0, 0],
    dims: one.dims,
    axes: [0, 1, 2],
    ratio: 1,
    order: 1,
  };
  const upper: Placement = {
    ...lower,
    item: { ...one, id: 'upper' },
    pos: [0, 100, 0],
    order: 2,
  };
  assert.equal(validPlacement(upper, [lower], cargoAsset), false);
  assert.equal(
    validPlacement({ ...upper, pos: [0, 110, 0] }, [], cargoAsset),
    false,
  );
  const rear: Placement = {
    ...lower,
    item: { ...one, id: 'rear' },
    pos: [0, 0, 400],
  };
  assert.equal(validPlacement(lower, [rear], cargoAsset), false);
});
test('manifest quantities expand with unique IDs and authoritative values survive AI merge', () => {
  const data = JSON.parse(manifestText([cargoDemo[0]]));
  data[0].quantity = 2;
  const imported = parseManifest(JSON.stringify(data));
  assert.deepEqual(
    imported.map((i) => i.id),
    ['C04-1', 'C04-2'],
  );
  assert.equal(imported[0].provenance?.dims, 'manifest');
  const merged = mergePhotoCargo(imported, [
    { ...imported[0], mass: 999, source: 'astra_estimate' },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].mass, 260);
  data[0].quantity = 30;
  data.push({ ...data[0], id: 'extra' });
  assert.throws(() => parseManifest(JSON.stringify(data)), /30-unit/);
  assert.throws(() => parseManifest('[{}]'));
  assert.throws(
    () => parseManifest(manifestText([cargoDemo[0], cargoDemo[0]])),
    /Duplicate/,
  );
});
test('offline intent rejects ambiguity and unknown IDs; no-stack and empty load stay valid', () => {
  assert.throws(() =>
    cargoOfflineIntent('Do not make P14 first to unload', cargoDemo),
  );
  assert.throws(() =>
    cargoOfflineIntent('P14 and P01 must be unloaded first', cargoDemo),
  );
  const patch = cargoOfflineIntent('No stacking on C08', cargoDemo);
  assert.equal(patch.changes[0].noStack, true);
  assert.throws(
    () =>
      applyCargoIntent(
        { ...patch, changes: [{ ...patch.changes[0], id: 'UNKNOWN' }] },
        cargoDemo,
        cargoAsset,
        defaultPreferences,
      ),
    /unknown/,
  );
  const empty = solve([], cargoAsset);
  assert.equal(empty.placements.length, 0);
  assert.equal(empty.metrics.mass, 0);
  assert.ok(Number.isFinite(empty.metrics.quality));
});

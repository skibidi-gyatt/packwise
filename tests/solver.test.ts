import test from 'node:test';
import assert from 'node:assert/strict';
import { demoBag, demoItems } from '../lib/packing/demo';
import {
  solve,
  objective,
  rotations,
  validPlacement,
  topLoads,
  evaluate,
  blockers,
} from '../lib/packing/solver';
import { validateModel, defaultPreferences } from '../lib/packing/model';
import type { Item, Container, Placement, Plan } from '../lib/packing/model';
const item = (patch: Partial<Item> = {}): Item => ({
  ...demoItems[0],
  id: 'test',
  name: 'Test item',
  dims: [10, 10, 10],
  mass: 1,
  maxTopLoad: 10,
  ...patch,
});
const bag: Container = {
  name: 'Test bag',
  dims: [30, 40, 30],
  opening: [30, 30],
  maxMass: 20,
  expansion: 0,
};
function checkIndependently(plan: Plan) {
  const ps = plan.placements;
  assert.ok(
    ps.reduce((s, p) => s + p.item.mass, 0) <= plan.container.maxMass + 1e-6,
  );
  assert.equal(new Set(ps.map((p) => p.item.id)).size, ps.length);
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    assert.equal(p.order, i + 1);
    for (let a = 0; a < 3; a++) {
      assert.ok(p.pos[a] >= -1e-6);
      assert.ok(p.pos[a] + p.dims[a] <= plan.container.dims[a] + 1e-6);
    }
    assert.ok(
      p.dims[0] <= plan.container.opening[0] + 1e-6 &&
        p.dims[2] <= plan.container.opening[1] + 1e-6,
    );
    assert.ok(p.ratio >= p.item.minRatio && p.ratio <= 1);
    if (p.item.rigidity === 'rigid') assert.equal(p.ratio, 1);
    if (p.item.orientation !== 'any') assert.equal(p.axes[1], 1);
    for (let j = 0; j < i; j++) {
      const q = ps[j];
      const intersections = [0, 1, 2].map(
        (a) =>
          Math.min(p.pos[a] + p.dims[a], q.pos[a] + q.dims[a]) -
          Math.max(p.pos[a], q.pos[a]),
      );
      assert.ok(
        intersections.some((v) => v <= 1e-6),
        'boxes must not overlap',
      );
      assert.ok(
        !(
          intersections[0] > 1e-6 &&
          intersections[2] > 1e-6 &&
          q.pos[1] >= p.pos[1] + p.dims[1] - 1e-6
        ),
        'insertion path must be clear',
      );
    }
    if (p.pos[1] > 1e-6) {
      const support = ps.filter(
        (q) => Math.abs(q.pos[1] + q.dims[1] - p.pos[1]) < 1e-6,
      );
      const area = support.reduce(
        (sum, q) =>
          sum +
          Math.max(
            0,
            Math.min(q.pos[0] + q.dims[0], p.pos[0] + p.dims[0]) -
              Math.max(q.pos[0], p.pos[0]),
          ) *
            Math.max(
              0,
              Math.min(q.pos[2] + q.dims[2], p.pos[2] + p.dims[2]) -
                Math.max(q.pos[2], p.pos[2]),
            ),
        0,
      );
      assert.ok(area >= p.dims[0] * p.dims[2] * 0.8 - 1e-6);
    }
  }
}
test('demo: full optimized kit; physical invariants and honest baseline', () => {
  const optimized = solve(demoItems, demoBag),
    baseline = solve(demoItems, demoBag, 'baseline');
  assert.equal(optimized.placements.length, 8);
  assert.ok(optimized.complete);
  assert.ok(objective(optimized) >= objective(baseline));
  checkIndependently(optimized);
  checkIndependently(baseline);
  assert.equal(Number(optimized.metrics.mass.toFixed(2)), 4.95);
  assert.deepEqual(solve(demoItems, demoBag), optimized);
});
test('rotation preserves upright axis; rigid shapes do not compress', () => {
  const rs = rotations(item({ dims: [6, 12, 8], orientation: 'upright' }));
  assert.equal(rs.length, 2);
  for (const r of rs) {
    assert.equal(r.dims[1], 12);
    assert.equal(r.ratio, 1);
  }
});
test('opening gate catches an object that fits the interior', () => {
  const p = solve([item({ dims: [20, 10, 20], orientation: 'flat' })], {
    ...bag,
    opening: [15, 15],
  });
  assert.equal(p.placements.length, 0);
  assert.match(p.unpacked[0].reason, /Opening/);
});
test('weight limit and required-first selection', () => {
  const items = [
    item({ id: 'optional', required: false, mass: 3 }),
    item({ id: 'required', required: true, mass: 3 }),
  ];
  const p = solve(items, { ...bag, maxMass: 3.5 });
  assert.deepEqual(
    p.placements.map((p) => p.item.id),
    ['required'],
  );
  assert.match(p.unpacked[0].reason, /Weight/);
});
test('load from a three-level stack propagates to bottom support', () => {
  const bottom: Placement = {
    item: item({ id: 'bottom', maxTopLoad: 1.5 }),
    dims: [10, 10, 10],
    pos: [0, 0, 0],
    axes: [0, 1, 2],
    ratio: 1,
    order: 1,
  };
  const middle: Placement = {
    ...bottom,
    item: item({ id: 'middle' }),
    pos: [0, 10, 0],
    order: 2,
  };
  const top: Placement = {
    ...bottom,
    item: item({ id: 'top' }),
    pos: [0, 20, 0],
    order: 3,
  };
  assert.equal(topLoads([bottom, middle, top]).get('bottom'), 2);
  assert.equal(topLoads([bottom, middle, top]).get('middle'), 1);
  assert.ok(validPlacement(middle, [bottom], bag));
  assert.equal(validPlacement(top, [bottom, middle], bag), false);
});
test('reject floating, overhanging, collision and blocked insertion', () => {
  const base: Placement = {
    item: item(),
    dims: [10, 10, 10],
    pos: [0, 0, 0],
    axes: [0, 1, 2],
    ratio: 1,
    order: 1,
  };
  assert.equal(
    validPlacement({ ...base, pos: [0, 11, 0] }, [base], bag),
    false,
  );
  assert.equal(
    validPlacement(
      { ...base, item: item({ id: 'upper' }), pos: [7, 10, 0] },
      [base],
      bag,
    ),
    false,
  );
  assert.equal(validPlacement({ ...base, pos: [3, 0, 3] }, [base], bag), false);
  assert.equal(
    validPlacement(
      base,
      [{ ...base, item: item({ id: 'overhead' }), pos: [0, 20, 0] }],
      bag,
    ),
    false,
  );
});
test('soft compression can enable fit but a rigid item cannot', () => {
  const small = {
    ...bag,
    dims: [10, 6, 10] as [number, number, number],
    opening: [10, 10] as [number, number],
  };
  assert.equal(
    solve(
      [item({ orientation: 'upright', rigidity: 'soft', minRatio: 0.5 })],
      small,
    ).placements.length,
    1,
  );
  assert.equal(
    solve([item({ orientation: 'upright' })], small).placements.length,
    0,
  );
});
test('empty and impossible kits return finite metrics and useful reasons', () => {
  const empty = solve([], bag);
  assert.equal(empty.placements.length, 0);
  assert.ok(Object.values(empty.metrics).flat().every(Number.isFinite));
  const impossible = solve([item({ dims: [90, 90, 90] })], bag);
  assert.equal(impossible.complete, false);
  assert.ok(impossible.unpacked[0].reason.length > 30);
});
test('known COM, moment, retrieval and balance formula', () => {
  const p: Placement = {
    item: item({ mass: 2 }),
    dims: [10, 10, 10],
    pos: [10, 0, 0],
    axes: [0, 1, 2],
    ratio: 1,
    order: 1,
  };
  const m = evaluate([p], bag, bag);
  assert.deepEqual(m.com, [15, 5, 5]);
  assert.equal(m.balance, 100);
  assert.ok(Math.abs(m.rearMoment - 0.981) < 1e-12);
  assert.equal(blockers(p, [p]).length, 0);
});
test('invalid numbers, material assumptions and duplicate IDs rejected', () => {
  assert.ok(validateModel([item({ dims: [NaN, 10, 10] })], bag).length);
  assert.ok(validateModel([item(), item()], bag).length);
  assert.ok(validateModel([item({ minRatio: 0.5 })], bag).length);
  assert.throws(() => solve([item({ mass: -2 })], bag));
});
test('varied deterministic kits preserve feasibility and common objective', () => {
  let seed = 5;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let n = 0; n < 20; n++) {
    const items = Array.from({ length: 5 + (n % 4) }, (_, k) =>
      item({
        id: `${n}-${k}`,
        dims: [
          3 + Math.floor(random() * 14),
          3 + Math.floor(random() * 17),
          3 + Math.floor(random() * 13),
        ],
        mass: 0.2 + random(),
        fragile: k % 3 === 0,
        maxTopLoad: k % 3 === 0 ? 0 : 4,
        access: k === 2 ? 'immediate' : 'normal',
      }),
    );
    const opt = solve(items, bag),
      base = solve(items, bag, 'baseline');
    checkIndependently(opt);
    checkIndependently(base);
    assert.ok(objective(opt) >= objective(base));
  }
});
test('headphone counterfactual retains full kit and genuinely moves geometry', () => {
  const before = solve(demoItems, demoBag),
    after = solve(
      demoItems.map((i) =>
        i.id === 'headphones' ? { ...i, access: 'immediate' } : i,
      ),
      demoBag,
    );
  assert.equal(after.placements.length, 8);
  checkIndependently(after);
  assert.notDeepEqual(
    before.placements.find((p) => p.item.id === 'headphones')?.pos,
    after.placements.find((p) => p.item.id === 'headphones')?.pos,
  );
  // Compare against the same requested target, not the previous all-item average.
  const reevaluated = evaluate(
    before.placements.map((p) => ({
      ...p,
      item: {
        ...p.item,
        access: p.item.id === 'headphones' ? 'immediate' : 'normal',
      },
    })),
    before.container,
    demoBag,
    defaultPreferences,
  );
  assert.ok(after.metrics.access >= reevaluated.access);
});

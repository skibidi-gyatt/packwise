import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCargoImport, csvRows } from '../lib/packing/csv';
import {
  cargoCheck,
  newCargo,
  expandCargo,
  checkCargoList,
} from '../lib/packing/readiness';
import {
  captureCargo,
  captureSchema,
  type CaptureResult,
} from '../lib/astra/capture';
import { captureCargoPhoto } from '../lib/astra/client';
import { mergePhotoCargo } from '../lib/packing/manifest';
import {
  cargoOfflineIntent,
  applyCargoIntent,
} from '../lib/packing/cargo-intent';
import { cargoAsset, cargoDemo } from '../lib/packing/cargo-demo';
import { defaultPreferences } from '../lib/packing/model';
import { solve, instruction } from '../lib/packing/solver';
const capture: CaptureResult = {
  quality: 'good',
  guidance: 'Edges visible.',
  markerVisible: true,
  secondViewRequired: false,
  items: [
    {
      id: 'S01',
      name: 'Crate',
      dims: [60, 40, 50],
      mass: 18,
      dimensionConfidence: 0.95,
      massConfidence: 0.9,
      fragile: false,
      notes: 'Weight read from label.',
    },
  ],
};
void test('CSV handles quoted company fields, quantities and missing measurements', () => {
  const units = parseCargoImport(
    'ID,Name,Width,Height,Length,Weight,Quantity,Destination\r\nA,"Crate, boxed",60,40,50,18,2,"Depot ""A"""\r\nB,Unknown,80,,90,,1,West',
  );
  assert.equal(units.length, 3);
  assert.equal(units[0].destination, 'Depot "A"');
  assert.equal(units[0].mass, 18);
  assert.equal(cargoCheck(units[0]).status, 'ready');
  assert.equal(cargoCheck(units[2]).status, 'required');
  assert.deepEqual(csvRows('a,b\n"x\ny",z'), [
    ['a', 'b'],
    ['x\ny', 'z'],
  ]);
});
void test('bad CSV numbers, duplicate expanded IDs and excessive quantity are rejected', () => {
  for (const csv of [
    'id,weight\nA,-1',
    'id,width\nA,Infinity',
    'id,quantity\nA,31',
    'id,quantity\nA,2\nA-1,1',
    'id\nA\na',
  ])
    assert.throws(() => parseCargoImport(csv));
  assert.throws(() =>
    checkCargoList([
      { ...newCargo('A'), mustUnloadFirst: true },
      { ...newCargo('B'), mustUnloadFirst: true },
    ]),
  );
});
void test('missing weight blocks readiness; AI critical estimates need review but conservative handling does not', () => {
  const missing = newCargo('X');
  assert.deepEqual(cargoCheck(missing).fields, ['dims', 'mass']);
  const estimated = captureCargo(capture)[0];
  assert.equal(cargoCheck(estimated).status, 'check');
  assert.deepEqual(
    cargoCheck({ ...estimated, reviewed: { dims: true, mass: true } }).fields,
    [],
  );
  assert.equal(
    cargoCheck({
      ...estimated,
      reviewed: { dims: true, mass: true },
      stackable: true,
      maxTopLoad: 100,
    }).status,
    'check',
  );
});
void test('no calibration means no photo dimensions; retake and second-view gates cannot be bypassed', () => {
  const noMarker = captureCargo({ ...capture, markerVisible: false })[0];
  assert.deepEqual(noMarker.dims, [0, 0, 0]);
  assert.equal(cargoCheck(noMarker).status, 'required');
  assert.throws(() => captureCargo({ ...capture, quality: 'retake' }));
  assert.throws(() => captureCargo({ ...capture, secondViewRequired: true }));
  assert.throws(() =>
    captureSchema.parse({
      ...capture,
      items: [{ ...capture.items[0], mass: -2 }],
    }),
  );
  assert.equal(
    captureCargo({
      ...capture,
      items: [{ ...capture.items[0], mass: null }],
    })[0].mass,
    0,
  );
});
void test('scan-one quantity creates independent units and preserves group identity', () => {
  const units = captureCargo(capture, 3);
  assert.deepEqual(
    units.map((i) => i.id),
    ['S01-1', 'S01-2', 'S01-3'],
  );
  assert.ok(units.every((i) => i.quantityGroup === 'S01'));
  units[0].dims[0] = 99;
  assert.equal(units[1].dims[0], 60);
  assert.throws(() => expandCargo(units[1], 30, units));
});
void test('photo gap filling retains authoritative per-axis measurements and weight', () => {
  const company = parseCargoImport(
    'id,width,height,length,weight\nS01,120,,100,420',
  )[0];
  const merged = mergePhotoCargo([company], captureCargo(capture));
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].dims, [120, 40, 100]);
  assert.equal(merged[0].mass, 420);
  assert.equal(merged[0].provenance?.mass, 'manifest');
  assert.equal(cargoCheck(merged[0]).status, 'check');
  const complete = {
    ...company,
    dims: [120, 80, 100] as [number, number, number],
  };
  assert.deepEqual(mergePhotoCargo([complete], captureCargo(capture)), [
    complete,
  ]);
});
void test('plain upright requests preserve measured data and loading directions name a side', () => {
  const patch = cargoOfflineIntent("Don't turn C08 sideways", cargoDemo);
  const next = applyCargoIntent(
    patch,
    cargoDemo,
    cargoAsset,
    defaultPreferences,
  );
  assert.equal(next.items.find((i) => i.id === 'C08')?.orientation, 'upright');
  assert.equal(next.items.find((i) => i.id === 'C08')?.mass, 180);
  const plan = solve(next.items, next.bag);
  assert.match(
    instruction(plan.placements[0], plan),
    /left side|right side|across the centre/,
  );
});
void test('capture uses both image views, structured quality output and no stored Responses', async () => {
  let request:
    | {
        store: boolean;
        input: { content: { type: string }[] }[];
        text: { format: { strict: boolean } };
        instructions: string;
      }
    | undefined;
  const transport = async (_url: unknown, init?: RequestInit) => {
    request = JSON.parse(init!.body as string);
    return new Response(
      JSON.stringify({
        status: 'completed',
        output: [
          { content: [{ type: 'output_text', text: JSON.stringify(capture) }] },
        ],
      }),
      { status: 200 },
    );
  };
  const result = await captureCargoPhoto(
    { key: 'test', model: 'test-model' },
    [
      { role: 'items', data: 'data:image/jpeg;base64,AA==' },
      { role: 'side', data: 'data:image/jpeg;base64,AA==' },
    ],
    'label 18 kg',
    'single',
    [],
    transport as typeof fetch,
  );
  assert.equal(result.items[0].mass, 18);
  assert.ok(request);
  assert.equal(request.store, false);
  assert.equal(
    request.input[0].content.filter((c) => c.type === 'input_image').length,
    2,
  );
  assert.equal(request.text.format.strict, true);
  assert.match(request.instructions, /Never invent weight/);
});

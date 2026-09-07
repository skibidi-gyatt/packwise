import test from 'node:test';
import assert from 'node:assert/strict';
import {
  transportErrors,
  usableTransportPhoto,
  type TransportPhoto,
} from '../lib/packing/transports';
import { captureTransportPhoto } from '../lib/astra/client';
import { cargoAsset, freshCargo } from '../lib/packing/cargo-demo';
import { solve } from '../lib/packing/solver';
const estimate: TransportPhoto = {
  quality: 'good',
  scaleVisible: true,
  secondViewRequired: false,
  dims: [230, 220, 590],
  opening: [220, 210],
  confidence: 0.8,
  guidance: 'Review all measurements.',
};

void test('transport requires a user-entered payload and reviewed photo measurements', () => {
  assert.ok(
    transportErrors({ ...cargoAsset, maxMass: 0 }, false, false).some((s) =>
      s.includes('Payload'),
    ),
  );
  assert.ok(
    transportErrors(cargoAsset, true, false).some((s) => s.includes('review')),
  );
  assert.deepEqual(transportErrors(cargoAsset, true, true), []);
  assert.ok(
    transportErrors({ ...cargoAsset, opening: [999, 999] }, false, false)
      .length,
  );
});
void test('unscaled, unusable and incomplete-view photos cannot populate metric dimensions', () => {
  for (const change of [
    { scaleVisible: false },
    { quality: 'retake' },
    { secondViewRequired: true },
  ]) {
    const result = usableTransportPhoto({ ...estimate, ...change });
    assert.deepEqual(result.dims, [null, null, null]);
    assert.deepEqual(result.opening, [null, null]);
  }
  assert.deepEqual(
    usableTransportPhoto({ ...estimate, dims: [230, 220, null] }).dims,
    [230, 220, null],
  );
});
void test('photo contract excludes payload and floor ratings and rejects invalid dimensions', () => {
  const result = usableTransportPhoto({
    ...estimate,
    maxMass: 10000,
    floorLimitKgM2: 1800,
  });
  assert.equal('maxMass' in result, false);
  assert.equal('floorLimitKgM2' in result, false);
  assert.throws(() =>
    usableTransportPhoto({ ...estimate, dims: [-1, 220, 590] }),
  );
});
void test('demo mode keeps uncalibrated estimates and optional extra-view advice, but rejects unusable images', () => {
  const unscaled = {
    ...estimate,
    scaleVisible: false,
    secondViewRequired: true,
  };
  const result = usableTransportPhoto(unscaled, 'demo');
  assert.deepEqual(result.dims, estimate.dims);
  assert.deepEqual(result.opening, estimate.opening);
  assert.ok(result.confidence <= 0.5);
  assert.deepEqual(usableTransportPhoto(unscaled).dims, [null, null, null]);
  assert.deepEqual(
    usableTransportPhoto({ ...unscaled, quality: 'retake' }, 'demo').dims,
    [null, null, null],
  );
  assert.equal('maxMass' in result, false);
});
void test('demo prompt permits occupied and uncalibrated views and records transport context', async () => {
  let sent: Record<string, unknown> = {};
  const transport = (async (_url: unknown, init: RequestInit) => {
    sent = JSON.parse(init.body as string);
    return Response.json({
      status: 'completed',
      output: [
        {
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({ ...estimate, scaleVisible: false }),
            },
          ],
        },
      ],
    });
  }) as typeof fetch;
  await captureTransportPhoto(
    { key: 'test', model: 'test' },
    [{ role: 'container', data: 'data:image/jpeg;base64,AA==' }],
    '',
    transport,
    'demo',
    'container',
  );
  assert.match(String(sent.instructions), /empty interior are NOT required/);
  assert.match(String(sent.instructions), /Never infer weight/);
  assert.match(JSON.stringify(sent.input), /transportKind/);
});
void test('photo request uses calibrated interior-only structured output', async () => {
  let sent: Record<string, unknown> = {};
  const transport = (async (_url: unknown, init: RequestInit) => {
    assert.equal(typeof init.body, 'string');
    sent = JSON.parse(init.body as string);
    return Response.json({
      status: 'completed',
      output: [
        { content: [{ type: 'output_text', text: JSON.stringify(estimate) }] },
      ],
    });
  }) as typeof fetch;
  const result = await captureTransportPhoto(
    { key: 'test', model: 'test' },
    [{ role: 'container', data: 'data:image/jpeg;base64,AA==' }],
    '20 cm marker',
    transport,
  );
  assert.deepEqual(result.dims, estimate.dims);
  assert.match(String(sent.instructions), /Never infer weight/);
  assert.equal(sent.store, false);
  assert.equal(JSON.stringify(sent.text).includes('maxMass'), false);
});
void test('selected transport dimensions and manual weight constrain the existing planner', () => {
  const bag = {
    ...cargoAsset,
    dims: [200, 220, 400] as [number, number, number],
    opening: [190, 210] as [number, number],
    maxMass: 2000,
  };
  const plan = solve(freshCargo().items, bag);
  assert.deepEqual(plan.container.dims, [200, 220, 400]);
  assert.ok(plan.metrics.mass <= 2000);
  assert.ok(plan.unpacked.length > 0);
});

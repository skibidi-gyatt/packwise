import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { demoBag, demoItems } from '../lib/packing/demo';
import { offlineIntent, applyIntent } from '../lib/packing/intent';
import { defaultPreferences } from '../lib/packing/model';
import { intentSchema, perceptionSchema } from '../lib/astra/schemas';
import { structuredCall, perceive } from '../lib/astra/client';
test('offline requests become explicit restricted changes', () => {
  const updated = applyIntent(
    offlineIntent('I need my headphones during the flight.', demoItems),
    demoItems,
    demoBag,
    defaultPreferences,
  );
  assert.equal(
    updated.items.find((i) => i.id === 'headphones')?.access,
    'immediate',
  );
  assert.equal(demoItems[0].access, 'normal');
  assert.equal(
    applyIntent(
      offlineIntent('Reduce bulging', demoItems),
      demoItems,
      demoBag,
      defaultPreferences,
    ).bag.expansion,
    0,
  );
  assert.equal(
    applyIntent(
      offlineIntent('Remove shoes', demoItems),
      demoItems,
      demoBag,
      defaultPreferences,
    ).items.length,
    7,
  );
  assert.throws(() => offlineIntent('Do not remove shoes', demoItems));
  assert.throws(() => offlineIntent('Lock laptop position', demoItems));
});
test('unknown and duplicate IDs cannot mutate an inventory', () => {
  const patch = offlineIntent('Remove shoes', demoItems);
  patch.changes[0].id = 'unknown';
  assert.throws(() =>
    applyIntent(patch, demoItems, demoBag, defaultPreferences),
  );
  patch.changes[0].id = 'shoes';
  patch.changes.push(patch.changes[0]);
  assert.throws(() =>
    applyIntent(patch, demoItems, demoBag, defaultPreferences),
  );
});
test('strict structured outputs request and response validation', async () => {
  const output = offlineIntent('Improve comfort', demoItems);
  let calls = 0;
  const transport = (async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const b = JSON.parse(String(init?.body));
    assert.equal(b.model, 'gpt-6-astra');
    assert.equal(b.store, false);
    assert.equal(b.text.format.strict, true);
    assert.equal(b.text.format.schema.additionalProperties, false);
    return Response.json({
      status: 'completed',
      output: [
        { content: [{ type: 'output_text', text: JSON.stringify(output) }] },
      ],
    });
  }) as typeof fetch;
  assert.deepEqual(
    await structuredCall(
      { key: 'test-only', model: 'gpt-6-astra' },
      'instructions',
      [{ type: 'input_text', text: 'request' }],
      intentSchema,
      transport,
    ),
    output,
  );
  assert.equal(calls, 1);
});
test('refusal, malformed output and rate limits produce actionable failures', async () => {
  const run = (body: unknown, status = 200) =>
    structuredCall(
      { key: 'test', model: 'gpt-6-astra' },
      'x',
      [],
      intentSchema,
      (async () => Response.json(body, { status })) as typeof fetch,
    );
  await assert.rejects(run({}, 429), /rate limited/);
  await assert.rejects(
    run({ output: [{ content: [{ type: 'refusal' }] }] }),
    /no structured/,
  );
  await assert.rejects(
    run({ output: [{ content: [{ type: 'output_text', text: '{}' }] }] }),
    /invalid/,
  );
  await assert.rejects(run({ status: 'incomplete' }), /did not complete/);
});
test('photo contract handles image input and keeps dimensions inferred', async () => {
  const fixture = {
    observed: 'Eight visible items.',
    uncertainty: 'Dimensions and mass require measurement.',
    container: demoBag,
    items: demoItems.map(({ color, source, ...i }) => ({
      ...i,
      confidence: 0.4,
    })),
  };
  const result = await perceive(
    { key: 'test', model: 'gpt-6-astra' },
    [{ role: 'items', data: 'data:image/jpeg;base64,abcd' }],
    '30 cm ruler',
    (async (_, init) => {
      const body = JSON.parse(String(init?.body));
      assert.ok(
        body.input[0].content.some(
          (c: { type: string }) => c.type === 'input_image',
        ),
      );
      assert.match(body.instructions, /Never claim measurements/);
      return Response.json({
        status: 'completed',
        output: [
          { content: [{ type: 'output_text', text: JSON.stringify(fixture) }] },
        ],
      });
    }) as typeof fetch,
  );
  assert.equal(result.items.length, 8);
  assert.equal(result.items[0].confidence, 0.4);
  const schema = JSON.stringify(z.toJSONSchema(perceptionSchema));
  assert.ok(!schema.includes('prefixItems'));
  assert.ok(!schema.includes('additionalItems'));
});

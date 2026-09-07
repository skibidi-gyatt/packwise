import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { responseJsonSchema } from '../lib/astra/response-schema';
import { captureSchema } from '../lib/astra/capture';
import { transportPhotoSchema } from '../lib/packing/transports';
import { perceptionSchema } from '../lib/astra/schemas';

void test('all photo contracts use API-compatible homogeneous arrays', () => {
  function inspect(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(inspect);
      return;
    }
    const node = value as Record<string, unknown>;
    assert.equal(
      Array.isArray(node.items),
      false,
      'positional items arrays are unsupported',
    );
    if (node.type === 'array')
      assert.ok(node.items && typeof node.items === 'object');
    Object.values(node).forEach(inspect);
  }
  [captureSchema, transportPhotoSchema, perceptionSchema].forEach((schema) =>
    inspect(responseJsonSchema(schema)),
  );
});
void test('dimension arrays retain fixed lengths and local tuple validation', () => {
  const schema = z.object({
    dims: z.tuple([z.number(), z.number(), z.number()]),
  });
  const json = responseJsonSchema(schema) as {
    properties: { dims: Record<string, unknown> };
  };
  assert.deepEqual(json.properties.dims.items, { type: 'number' });
  assert.equal(json.properties.dims.minItems, 3);
  assert.equal(json.properties.dims.maxItems, 3);
  assert.throws(() => schema.parse({ dims: [1, 2] }));
  assert.throws(() => responseJsonSchema(z.tuple([z.number(), z.string()])));
});

import { z } from 'zod';

// The API accepts fixed-length arrays, not draft-7 positional `items` lists.
// Keep the original Zod tuples for response validation and application types.
export function responseJsonSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { target: 'draft-7' });
  function normalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== 'object') return value;
    const node = value as Record<string, unknown>;
    if (Array.isArray(node.items)) {
      const items = node.items;
      if (
        !items.length ||
        items.some((item) => JSON.stringify(item) !== JSON.stringify(items[0]))
      )
        throw new Error(
          'AI response tuples must contain matching element types.',
        );
      const { items: _items, additionalItems: _additional, ...rest } = node;
      return normalize({
        ...rest,
        items: items[0],
        minItems: items.length,
        maxItems: items.length,
      });
    }
    return Object.fromEntries(
      Object.entries(node).map(([key, item]) => [key, normalize(item)]),
    );
  }
  return normalize(json);
}

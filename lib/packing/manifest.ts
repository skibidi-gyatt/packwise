import { z } from 'zod';
import type { Item } from './model';
import { stops } from './cargo-demo';
const row = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,35}$/),
  name: z.string().min(1).max(80),
  width_cm: z.number().positive().max(2000),
  height_cm: z.number().positive().max(2000),
  length_cm: z.number().positive().max(2000),
  weight_kg: z.number().positive().max(100000),
  quantity: z.number().int().min(1).max(30).default(1),
  stop: z.number().int().min(1).max(20),
  destination: z.string().min(1).max(80),
  stackable: z.boolean(),
  max_top_load_kg: z.number().min(0).max(100000),
  fragile: z.boolean().default(false),
  orientation: z.enum(['upright', 'flat', 'any']).default('upright'),
  required: z.boolean().default(true),
  first_unload: z.boolean().default(false),
});
export function parseManifest(text: string): Item[] {
  const rows = z.array(row).min(1).max(30).parse(JSON.parse(text));
  const items: Item[] = rows.flatMap((r) =>
    Array.from({ length: r.quantity }, (_, k) => ({
      id: r.quantity > 1 ? `${r.id}-${k + 1}` : r.id,
      name: r.name,
      dims: [r.width_cm, r.height_cm, r.length_cm],
      mass: r.weight_kg,
      color: stops[(r.stop - 1) % stops.length].color,
      rigidity: 'rigid',
      minRatio: 1,
      fragile: r.fragile,
      orientation: r.orientation,
      access: r.first_unload ? 'immediate' : 'normal',
      mustUnloadFirst: r.first_unload,
      required: r.required,
      maxTopLoad: r.stackable ? r.max_top_load_kg : 0,
      stackable: r.stackable,
      destination: r.destination,
      deliveryStop: r.stop,
      source: 'manifest',
      confidence: 1,
      notes: 'Dimensions, mass and handling limits supplied by the manifest.',
      provenance: { dims: 'manifest', mass: 'manifest', handling: 'manifest' },
    })),
  );
  if (items.length > 30)
    throw new Error('Expanded quantities exceed the 30-unit prototype limit.');
  if (new Set(items.map((i) => i.id)).size !== items.length)
    throw new Error('Duplicate cargo IDs after expanding quantity.');
  return items;
}
export const manifestText = (items: Item[]) =>
  JSON.stringify(
    items.map((i) => ({
      id: i.id,
      name: i.name,
      width_cm: i.dims[0],
      height_cm: i.dims[1],
      length_cm: i.dims[2],
      weight_kg: i.mass,
      quantity: 1,
      stop: i.deliveryStop ?? 1,
      destination: i.destination ?? 'Delivery',
      stackable: i.stackable !== false,
      max_top_load_kg: i.maxTopLoad,
      fragile: i.fragile,
      orientation: i.orientation,
      required: i.required,
      first_unload: i.mustUnloadFirst ?? false,
    })),
    null,
    2,
  );
// Existing IDs retain every authoritative property. AI adds only new reviewed units.
export function mergePhotoCargo(existing: Item[], estimates: Item[]) {
  const ids = new Set(existing.map((i) => i.id));
  return [...existing, ...estimates.filter((i) => !ids.has(i.id))];
}

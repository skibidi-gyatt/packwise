import { z } from 'zod';
import type { Item } from '../packing/model';
import { newCargo, expandCargo } from '../packing/readiness';
export const captureSchema = z.object({
  quality: z.enum(['good', 'retake']),
  guidance: z.string().max(800),
  markerVisible: z.boolean(),
  secondViewRequired: z.boolean(),
  items: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,35}$/),
        name: z.string().min(1).max(80),
        dims: z
          .tuple([
            z.number().positive().max(2000),
            z.number().positive().max(2000),
            z.number().positive().max(2000),
          ])
          .nullable(),
        mass: z.number().positive().max(100000).nullable(),
        dimensionConfidence: z.number().min(0).max(1),
        massConfidence: z.number().min(0).max(1),
        fragile: z.boolean(),
        notes: z.string().max(600),
      }),
    )
    .max(30),
});
export type CaptureResult = z.infer<typeof captureSchema>;
export function captureCargo(result: CaptureResult, quantity = 1): Item[] {
  if (result.quality !== 'good' || result.secondViewRequired)
    throw new Error(result.guidance || 'Retake the photo before adding cargo.');
  if (quantity !== 1 && result.items.length !== 1)
    throw new Error('Quantity applies to a single cargo scan.');
  let units: Item[] = [];
  for (const i of result.items) {
    const unit: Item = {
      ...newCargo(i.id),
      name: i.name,
      dims: result.markerVisible && i.dims ? i.dims : [0, 0, 0],
      mass: i.mass ?? 0,
      fragile: i.fragile,
      source: 'astra_estimate',
      confidence: i.dimensionConfidence,
      fieldConfidence: { dims: i.dimensionConfidence, mass: i.massConfidence },
      provenance: {
        dims: 'astra_estimate',
        mass: 'astra_estimate',
        handling: 'astra_estimate',
      },
      notes: i.notes,
    };
    units = [...units, ...expandCargo(unit, quantity, units)];
  }
  return units;
}

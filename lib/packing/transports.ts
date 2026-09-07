import { z } from 'zod';
import { validateModel, type Container } from './model';

export const transportStorageKey = 'packwise-saved-transports-v1';
export function readTransports(): Container[] {
  try {
    const rows = JSON.parse(localStorage.getItem(transportStorageKey) ?? '[]');
    return Array.isArray(rows)
      ? rows
          .filter(
            (b) =>
              typeof b?.name === 'string' &&
              b.loading === 'rear' &&
              Array.isArray(b.dims) &&
              Array.isArray(b.opening) &&
              validateModel([], b).length === 0,
          )
          .slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

const dimension = z.number().positive().max(2000);
export const transportPhotoSchema = z.object({
  quality: z.enum(['good', 'retake']),
  scaleVisible: z.boolean(),
  secondViewRequired: z.boolean(),
  dims: z.tuple([
    dimension.nullable(),
    dimension.nullable(),
    dimension.nullable(),
  ]),
  opening: z.tuple([dimension.nullable(), dimension.nullable()]),
  confidence: z.number().min(0).max(1),
  guidance: z.string().max(1500),
});
export type TransportPhoto = z.infer<typeof transportPhotoSchema>;
// Unusable or uncalibrated photos never supply metric measurements to the form.
export function usableTransportPhoto(
  input: unknown,
  mode: 'reference' | 'demo' = 'reference',
): TransportPhoto {
  const result = transportPhotoSchema.parse(input);
  return result.quality === 'good' &&
    (mode === 'demo' || (result.scaleVisible && !result.secondViewRequired))
    ? {
        ...result,
        confidence:
          mode === 'demo' && !result.scaleVisible
            ? Math.min(result.confidence, 0.5)
            : result.confidence,
      }
    : { ...result, dims: [null, null, null], opening: [null, null] };
}

export function transportErrors(
  bag: Container,
  photoReviewRequired: boolean,
  reviewed: boolean,
): string[] {
  const errors = validateModel([], bag);
  if (!bag.name.trim()) errors.unshift('Enter a name for this transport.');
  if (bag.opening[0] > bag.dims[0] || bag.opening[1] > bag.dims[1])
    errors.push(
      'The door opening cannot be larger than the interior width or height.',
    );
  if (photoReviewRequired && !reviewed)
    errors.push('Check the estimated measurements, then confirm your review.');
  return errors;
}

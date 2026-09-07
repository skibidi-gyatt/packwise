import { z } from 'zod';
const dimension = z.number().min(0.1).max(2000);
export const inferredItemSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  dims: z.array(dimension).length(3),
  mass: z.number().min(0.01).max(100000),
  rigidity: z.enum(['rigid', 'soft']),
  minRatio: z.number().min(0.4).max(1),
  fragile: z.boolean(),
  orientation: z.enum(['any', 'upright', 'flat']),
  access: z.enum(['normal', 'immediate']),
  required: z.boolean(),
  maxTopLoad: z.number().min(0).max(100000),
  confidence: z.number().min(0).max(1),
  notes: z.string().max(600),
});
export const perceptionSchema = z.object({
  observed: z.string().max(1600),
  uncertainty: z.string().max(1600),
  container: z.object({
    name: z.string().min(1).max(60),
    dims: z.array(dimension).length(3),
    opening: z.array(dimension).length(2),
    maxMass: z.number().min(0.1).max(100000),
    expansion: z.number().min(0).max(0.3),
  }),
  items: z.array(inferredItemSchema).min(1).max(30),
});
export const intentSchema = z.object({
  explanation: z.string().max(1200),
  changes: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        access: z.literal('immediate').nullable(),
        fragile: z.boolean().nullable(),
        remove: z.boolean(),
      }),
    )
    .max(30),
  comfort: z.boolean(),
  reduceBulging: z.boolean(),
  protection: z.boolean(),
});
export type Perception = z.infer<typeof perceptionSchema>;
export const photoPalette = [
  '#678baa',
  '#52b9a3',
  '#d9a25c',
  '#b391ea',
  '#70aadb',
  '#e78d84',
  '#d6bd65',
  '#90ae93',
];

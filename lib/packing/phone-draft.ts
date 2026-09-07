import { z } from 'zod';
import {
  validateModel,
  type Item,
  type Container,
  type Preferences,
} from './model';
import { checkCargoList, cargoCheck } from './readiness';
import { solve } from './solver';
const source = z.enum(['sample', 'astra_estimate', 'manual', 'manifest']);
const vec = z.tuple([
  z.number().min(0).max(2000),
  z.number().min(0).max(2000),
  z.number().min(0).max(2000),
]);
const item = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  dims: vec,
  mass: z.number().min(0).max(100000),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  rigidity: z.enum(['soft', 'rigid']),
  minRatio: z.number().min(0.4).max(1),
  fragile: z.boolean(),
  orientation: z.enum(['upright', 'flat', 'any']),
  access: z.enum(['normal', 'immediate']),
  required: z.boolean(),
  maxTopLoad: z.number().min(0).max(100000),
  source,
  confidence: z.number().min(0).max(1),
  notes: z.string().max(3000),
  quantityGroup: z.string().max(40).optional(),
  deliveryStop: z.number().int().min(1).max(20).optional(),
  destination: z.string().max(80).optional(),
  stackable: z.boolean().optional(),
  mustUnloadFirst: z.boolean().optional(),
  reviewed: z
    .object({
      dims: z.boolean().optional(),
      mass: z.boolean().optional(),
      handling: z.boolean().optional(),
    })
    .optional(),
  fieldConfidence: z
    .object({
      dims: z.number().min(0).max(1).optional(),
      mass: z.number().min(0).max(1).optional(),
      handling: z.number().min(0).max(1).optional(),
    })
    .optional(),
  provenance: z
    .object({
      dims: source.optional(),
      mass: source.optional(),
      handling: source.optional(),
    })
    .optional(),
});
const schema = z.object({
  version: z.literal(1),
  items: z.array(item).max(30),
  bag: z.object({
    name: z.string().min(1).max(80),
    dims: vec,
    opening: z.tuple([z.number(), z.number()]),
    maxMass: z.number(),
    expansion: z.number(),
    kind: z.enum(['truck', 'container', 'other']).optional(),
    loading: z.enum(['rear', 'top']).optional(),
    floorLimitKgM2: z.number().optional(),
  }),
  prefs: z.object({
    comfort: z.number().min(0.1).max(10),
    protection: z.number().min(0.1).max(10),
    access: z.number().min(0.1).max(10),
    route: z.number().min(0).max(10).optional(),
  }),
  phase: z.enum(['cargo', 'plan', 'load']),
  view: z.enum(['baseline', 'optimized']),
  hasPlan: z.boolean(),
  loadingIndex: z.number().int().min(0).max(30),
  loadingCompleted: z.number().int().min(0).max(30),
});
export const phoneDraftKey = 'packwise-iphone-draft-v1';
export type PhoneDraft = {
  version: 1;
  items: Item[];
  bag: Container;
  prefs: Preferences;
  phase: 'cargo' | 'plan' | 'load';
  view: 'baseline' | 'optimized';
  hasPlan: boolean;
  loadingIndex: number;
  loadingCompleted: number;
};
export function parsePhoneDraft(text: string) {
  if (text.length > 200000) throw new Error('Saved cargo is too large.');
  const d = schema.parse(JSON.parse(text));
  checkCargoList(d.items);
  if (
    validateModel(
      d.items.map((i) => ({
        ...i,
        dims: i.dims.map((n) => n || 1) as Item['dims'],
        mass: i.mass || 1,
      })),
      d.bag,
    ).length
  )
    throw new Error('Saved cargo could not be validated.');
  const ready = d.items.every((i) => cargoCheck(i).status === 'ready');
  const plan = solve(ready ? d.items : [], d.bag, 'optimized', d.prefs),
    baseline = solve(ready ? d.items : [], d.bag, 'baseline', d.prefs);
  const hasPlan = d.hasPlan && ready,
    count = (d.view === 'baseline' ? baseline : plan).placements.length;
  return {
    ...d,
    plan,
    baseline,
    hasPlan,
    phase: hasPlan ? d.phase : ('cargo' as const),
    loadingIndex: hasPlan
      ? Math.min(d.loadingIndex, d.loadingCompleted, count)
      : 0,
    loadingCompleted: hasPlan ? Math.min(d.loadingCompleted, count) : 0,
  };
}
export function readPhoneDraft() {
  try {
    const text = localStorage.getItem(phoneDraftKey);
    return text ? parsePhoneDraft(text) : null;
  } catch {
    return null;
  }
}

export type Vec3 = [number, number, number];
export type Item = {
  id: string;
  name: string;
  dims: Vec3;
  mass: number;
  color: string;
  rigidity: 'rigid' | 'soft';
  minRatio: number;
  fragile: boolean;
  orientation: 'any' | 'upright' | 'flat';
  access: 'normal' | 'immediate';
  required: boolean;
  maxTopLoad: number;
  source: 'sample' | 'astra_estimate' | 'manual';
  confidence: number;
  notes: string;
};
export type Container = {
  name: string;
  dims: Vec3;
  opening: [number, number];
  maxMass: number;
  expansion: number;
};
export type Placement = {
  item: Item;
  pos: Vec3;
  dims: Vec3;
  axes: Vec3;
  ratio: number;
  order: number;
};
export type Preferences = {
  comfort: number;
  protection: number;
  access: number;
};
export type Metrics = {
  mass: number;
  volume: number;
  utilization: number;
  com: Vec3;
  balance: number;
  rearMoment: number;
  access: number;
  protection: number;
  compression: number;
  expansion: number;
  quality: number;
};
export type Plan = {
  placements: Placement[];
  unpacked: { item: Item; reason: string }[];
  container: Container;
  metrics: Metrics;
  tried: number;
  mode: 'baseline' | 'optimized';
  complete: boolean;
};
export const defaultPreferences: Preferences = {
  comfort: 1,
  protection: 1,
  access: 1,
};
export const volume = (v: Vec3) => v[0] * v[1] * v[2];
export function validateModel(items: Item[], bag: Container) {
  const errors: string[] = [];
  const positive = (x: number, max: number) =>
    Number.isFinite(x) && x > 0 && x <= max;
  if (items.length > 24)
    errors.push('Use at most 24 separate items for this prototype.');
  if (new Set(items.map((i) => i.id)).size !== items.length)
    errors.push('Each item needs a unique ID.');
  if (bag.dims.length !== 3 || !bag.dims.every((x) => positive(x, 200)))
    errors.push('Bag dimensions must be between 0 and 200 cm.');
  if (bag.opening.length !== 2 || !bag.opening.every((x) => positive(x, 200)))
    errors.push('Opening dimensions must be positive and at most 200 cm.');
  if (!positive(bag.maxMass, 100))
    errors.push('Weight limit must be positive and at most 100 kg.');
  if (
    !Number.isFinite(bag.expansion) ||
    bag.expansion < 0 ||
    bag.expansion > 0.3
  )
    errors.push('Expansion must be between 0 and 30%.');
  for (const i of items) {
    if (!i.id || !i.name.trim() || i.name.length > 80)
      errors.push('Each item needs a name (up to 80 characters).');
    if (
      i.dims.length !== 3 ||
      !i.dims.every((x) => positive(x, 200)) ||
      !positive(i.mass, 100)
    )
      errors.push(`${i.name}: enter positive dimensions and weight.`);
    if (
      !Number.isFinite(i.minRatio) ||
      i.minRatio < 0.4 ||
      i.minRatio > 1 ||
      (i.rigidity === 'rigid' && i.minRatio !== 1)
    )
      errors.push(
        `${i.name}: rigid objects cannot compress; soft objects retain at least 40% of their volume.`,
      );
    if (
      !Number.isFinite(i.maxTopLoad) ||
      i.maxTopLoad < 0 ||
      i.maxTopLoad > 100
    )
      errors.push(`${i.name}: top-load limit must be 0–100 kg.`);
    if (
      !['rigid', 'soft'].includes(i.rigidity) ||
      !['any', 'upright', 'flat'].includes(i.orientation) ||
      !['normal', 'immediate'].includes(i.access)
    )
      errors.push(`${i.name}: invalid physical property.`);
    if (!Number.isFinite(i.confidence) || i.confidence < 0 || i.confidence > 1)
      errors.push(`${i.name}: confidence must be 0–1.`);
  }
  return errors;
}

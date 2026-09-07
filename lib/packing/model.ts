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
  source: 'sample' | 'astra_estimate' | 'manual' | 'manifest';
  confidence: number;
  notes: string;
  quantityGroup?: string;
  reviewed?: Partial<Record<'dims' | 'mass' | 'handling', boolean>>;
  fieldConfidence?: Partial<Record<'dims' | 'mass' | 'handling', number>>;
  destination?: string;
  deliveryStop?: number;
  stackable?: boolean;
  mustUnloadFirst?: boolean;
  provenance?: Partial<
    Record<
      'dims' | 'mass' | 'handling',
      'sample' | 'manifest' | 'manual' | 'astra_estimate'
    >
  >;
};
export type Container = {
  name: string;
  dims: Vec3;
  opening: [number, number];
  maxMass: number;
  expansion: number;
  kind?: 'truck' | 'container' | 'other';
  loading?: 'rear' | 'top';
  floorLimitKgM2?: number;
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
  route?: number;
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
  payloadUtilization: number;
  unusedM3: number;
  frontMass: number;
  rearMass: number;
  longitudinalBalance: number;
  rehandles: number;
  floorPeakKgM2: number;
};
export type CargoUnit = Item;
export type TransportAsset = Container;
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
  if (items.length > 30)
    errors.push('Use at most 30 cargo units for this prototype.');
  if (new Set(items.map((i) => i.id)).size !== items.length)
    errors.push('Each item needs a unique ID.');
  if (bag.dims.length !== 3 || !bag.dims.every((x) => positive(x, 2000)))
    errors.push('Asset dimensions must be positive and at most 2,000 cm.');
  if (bag.opening.length !== 2 || !bag.opening.every((x) => positive(x, 2000)))
    errors.push('Opening dimensions must be positive and at most 2,000 cm.');
  if (!positive(bag.maxMass, 100000))
    errors.push('Payload limit must be positive and at most 100,000 kg.');
  if (
    bag.loading === 'rear' &&
    (bag.expansion !== 0 ||
      bag.opening[0] > bag.dims[0] ||
      bag.opening[1] > bag.dims[1])
  )
    errors.push(
      'Rear-door assets are rigid; door width/height cannot exceed the interior.',
    );
  if (bag.floorLimitKgM2 !== undefined && !positive(bag.floorLimitKgM2, 100000))
    errors.push('Enter a positive floor load limit.');
  if (items.filter((i) => i.mustUnloadFirst).length > 1)
    errors.push('Only one cargo unit can be first to unload.');
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
      !i.dims.every((x) => positive(x, 2000)) ||
      !positive(i.mass, 100000)
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
      i.maxTopLoad > 100000
    )
      errors.push(`${i.name}: top-load limit must be 0–100,000 kg.`);
    if (
      i.deliveryStop !== undefined &&
      (!Number.isInteger(i.deliveryStop) ||
        i.deliveryStop < 1 ||
        i.deliveryStop > 20)
    )
      errors.push(`${i.id}: delivery stop must be an integer from 1 to 20.`);
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

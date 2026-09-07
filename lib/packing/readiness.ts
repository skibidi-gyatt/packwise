import type { Item } from './model';
export type CargoCheck = {
  status: 'ready' | 'check' | 'required';
  label: string;
  fields: ('dims' | 'mass' | 'handling')[];
};
export function cargoCheck(i: Item): CargoCheck {
  const missing: CargoCheck['fields'] = [];
  if (
    i.dims.length !== 3 ||
    i.dims.some((n) => !Number.isFinite(n) || n <= 0 || n > 2000)
  )
    missing.push('dims');
  if (!Number.isFinite(i.mass) || i.mass <= 0 || i.mass > 100000)
    missing.push('mass');
  if (missing.length)
    return {
      status: 'required',
      label: `Add ${missing.map((f) => (f === 'dims' ? 'dimensions' : 'weight')).join(' and ')}`,
      fields: missing,
    };
  const fields: CargoCheck['fields'] = [];
  for (const f of ['dims', 'mass'] as const) {
    if (
      (i.provenance?.[f] ?? i.source) === 'astra_estimate' &&
      !i.reviewed?.[f]
    )
      fields.push(f);
  }
  // Conservative no-stack handling can proceed. Inferred positive load ratings cannot.
  if (
    (i.provenance?.handling ?? i.source) === 'astra_estimate' &&
    i.stackable !== false &&
    i.maxTopLoad > 0 &&
    !i.reviewed?.handling
  )
    fields.push('handling');
  return fields.length
    ? {
        status: 'check',
        label: `Check ${fields.map((f) => (f === 'dims' ? 'dimensions' : f === 'mass' ? 'weight' : 'stacking limit')).join(' and ')}`,
        fields,
      }
    : { status: 'ready', label: 'Ready', fields: [] };
}
export function checkCargoList(items: Item[]) {
  if (
    items.some(
      (i) =>
        i.deliveryStop !== undefined &&
        (!Number.isInteger(i.deliveryStop) ||
          i.deliveryStop < 1 ||
          i.deliveryStop > 20),
    )
  )
    throw new Error('Use delivery stop numbers from 1 to 20.');
  if (items.length > 30)
    throw new Error(
      'This demo supports up to 30 cargo units. Split this manifest into smaller loads.',
    );
  if (new Set(items.map((i) => i.id.toLowerCase())).size !== items.length)
    throw new Error(
      'Two cargo units have the same ID. Give each one a different ID.',
    );
  if (items.filter((i) => i.mustUnloadFirst).length > 1)
    throw new Error('Choose just one shipment to unload first.');
}
export function newCargo(id: string): Item {
  return {
    id,
    name: '',
    dims: [0, 0, 0],
    mass: 0,
    color: '#de9f4d',
    rigidity: 'rigid',
    minRatio: 1,
    fragile: false,
    orientation: 'upright',
    access: 'normal',
    required: true,
    maxTopLoad: 0,
    stackable: false,
    deliveryStop: 1,
    destination: '',
    source: 'manual',
    confidence: 1,
    notes:
      'Keep upright. Nothing stacked on top unless a known limit is entered.',
  };
}
export function expandCargo(item: Item, quantity: number, existing: Item[]) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 30)
    throw new Error('Enter a quantity from 1 to 30.');
  const units = Array.from({ length: quantity }, (_, k) => ({
    ...structuredClone(item),
    quantityGroup: quantity > 1 ? item.id : item.quantityGroup,
    id: quantity === 1 ? item.id : `${item.id}-${k + 1}`,
  }));
  checkCargoList([...existing, ...units]);
  return units;
}

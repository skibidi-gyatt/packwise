import type { CargoUnit, TransportAsset, Vec3 } from './model';
export const stops = [
  { id: 1, name: 'Jurong distribution', color: '#de9f4d' },
  { id: 2, name: 'Central medical hub', color: '#598bd6' },
  { id: 3, name: 'Changi fulfilment', color: '#509c82' },
];
export const cargoAsset: TransportAsset = {
  name: 'Rigid truck · T-07',
  kind: 'truck',
  loading: 'rear',
  dims: [240, 240, 600],
  opening: [240, 230],
  maxMass: 10000,
  expansion: 0,
  floorLimitKgM2: 1800,
};
const rows: [string, string, Vec3, number, number, boolean, number][] = [
  ['C04', 'Diagnostic equipment', [100, 120, 120], 260, 2, false, 0],
  ['C08', 'Control electronics', [100, 90, 100], 180, 1, false, 0],
  ['P01', 'Machine components', [120, 100, 100], 780, 3, true, 1400],
  ['P02', 'Motor assemblies', [120, 100, 100], 720, 3, true, 1400],
  ['P03', 'Retail cartons', [120, 100, 100], 310, 1, true, 650],
  ['P04', 'Retail cartons', [120, 100, 100], 280, 1, true, 650],
  ['P05', 'Spare parts', [120, 110, 100], 540, 3, true, 900],
  ['P06', 'Spare parts', [120, 110, 100], 510, 3, true, 900],
  ['P07', 'Sterile supplies', [100, 100, 120], 220, 2, true, 400],
  ['P09', 'Packaging stock', [120, 100, 100], 190, 3, true, 350],
  ['P10', 'Home appliances', [120, 120, 100], 430, 1, true, 650],
  ['P11', 'Home appliances', [120, 120, 100], 410, 1, true, 650],
  ['P12', 'Industrial pumps', [120, 100, 100], 690, 3, true, 1200],
  ['P14', 'Medical supply crate', [100, 100, 120], 230, 2, true, 400],
  ['P15', 'Textile cartons', [120, 100, 100], 160, 1, true, 300],
  ['P16', 'Textile cartons', [120, 100, 100], 150, 1, true, 300],
  ['P17', 'Service tools', [100, 100, 120], 350, 2, true, 700],
  ['P18', 'Service tools', [100, 100, 120], 330, 2, true, 700],
  ['P19', 'Store fixtures', [120, 110, 100], 290, 1, true, 550],
  ['P20', 'Store fixtures', [120, 110, 100], 270, 1, true, 550],
];
export const cargoDemo: CargoUnit[] = rows.map(
  ([id, name, dims, mass, stop, stackable, maxTopLoad]) => ({
    id,
    name,
    dims,
    mass,
    color: stops[stop - 1].color,
    rigidity: 'rigid',
    minRatio: 1,
    fragile: !stackable,
    orientation: 'upright',
    access: 'normal',
    required: true,
    maxTopLoad,
    stackable,
    destination: stops[stop - 1].name,
    deliveryStop: stop,
    source: 'sample',
    confidence: 1,
    provenance: { dims: 'sample', mass: 'sample', handling: 'sample' },
    notes: !stackable
      ? 'Illustrative handling instruction: keep upright; no top loading.'
      : 'Synthetic manifest unit. Dimensions include packaging; verify with dispatch.',
  }),
);
export const freshCargo = () => ({
  items: structuredClone(cargoDemo),
  bag: structuredClone(cargoAsset),
});

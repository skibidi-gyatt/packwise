import type { Item } from './model';
import { newCargo, checkCargoList, expandCargo } from './readiness';
import { parseManifest } from './manifest';
export const csvTemplate =
  'ID,Name,Width_cm,Height_cm,Length_cm,Weight_kg,Quantity,Destination,Stop,Stackable,Max_top_load_kg\nP01,Cartons,120,100,100,230,2,Depot A,1,false,0\n';
// RFC-style quoted fields, including embedded commas/newlines and doubled quotes.
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  for (let n = 0; n < text.length; n++) {
    const c = text[n];
    if (c === '"') {
      if (quoted && text[n + 1] === '"') {
        field += '"';
        n++;
      } else if (quoted) quoted = false;
      else if (!field) quoted = true;
      else
        throw new Error(
          'A CSV quote is out of place. Export the file as CSV again.',
        );
    } else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
      row.push(field);
      field = '';
      if (c !== ',') {
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
        if (c === '\r' && text[n + 1] === '\n') n++;
      }
    } else field += c;
  }
  if (quoted)
    throw new Error('A CSV quoted value is unfinished. Check the final quote.');
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
export function parseCargoImport(text: string): Item[] {
  if (text.length > 150000)
    throw new Error('Use a manifest smaller than 150 KB.');
  if (text.trim().startsWith('[')) return parseManifest(text);
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  if (rows.length < 2)
    throw new Error('Add at least one cargo row below the CSV column names.');
  const aliases: Record<string, string> = {
    width: 'width_cm',
    height: 'height_cm',
    length: 'length_cm',
    weight: 'weight_kg',
    mass: 'weight_kg',
    description: 'name',
    shipment_id: 'id',
    stackability: 'stackable',
    top_load: 'max_top_load_kg',
  };
  const heads = rows[0].map((h) => {
    const k = h.trim().toLowerCase().replaceAll(' ', '_');
    return aliases[k] ?? k;
  });
  if (new Set(heads).size !== heads.length)
    throw new Error(
      'A CSV column appears twice. Keep one column for each value.',
    );
  if (!heads.includes('id'))
    throw new Error('Add an ID column so each cargo unit can be identified.');
  let items: Item[] = [];
  for (const [index, cells] of rows.slice(1).entries()) {
    if (cells.length !== heads.length)
      throw new Error(
        `Row ${index + 2}: the number of values does not match the column names.`,
      );
    const r = Object.fromEntries(heads.map((h, k) => [h, cells[k].trim()]));
    if (!/^[A-Za-z0-9_-]{1,35}$/.test(r.id))
      throw new Error(
        `Row ${index + 2}: use a short cargo ID with letters, numbers, - or _.`,
      );
    const number = (key: string, fallback = 0) => {
      if (!r[key]) return fallback;
      const n = Number(r[key]);
      if (!Number.isFinite(n) || n < 0)
        throw new Error(`Row ${index + 2}: ${key} needs a positive number.`);
      return n;
    };
    const boolean = (key: string, fallback = false) => {
      if (!r[key]) return fallback;
      if (/^(yes|true|1)$/i.test(r[key])) return true;
      if (/^(no|false|0)$/i.test(r[key])) return false;
      throw new Error(`Row ${index + 2}: use yes or no for ${key}.`);
    };
    const i: Item = {
      ...newCargo(r.id),
      name: r.name || r.id,
      dims: [number('width_cm'), number('height_cm'), number('length_cm')],
      mass: number('weight_kg'),
      source: 'manifest',
      provenance: { dims: 'manifest', mass: 'manifest', handling: 'manifest' },
      destination: r.destination || 'Unassigned',
      deliveryStop: number('stop', 1),
      stackable: boolean('stackable'),
      fragile: boolean('fragile'),
      maxTopLoad: number('max_top_load_kg'),
      notes:
        'Imported company measurements. Missing values must be added before optimization.',
    };
    if (
      i.dims.some((n) => n > 2000) ||
      i.mass > 100000 ||
      i.maxTopLoad > 100000
    )
      throw new Error(
        `Row ${index + 2}: check units. Use centimetres and kilograms.`,
      );
    if (
      !Number.isInteger(i.deliveryStop) ||
      i.deliveryStop! < 1 ||
      i.deliveryStop! > 20
    )
      throw new Error(`Row ${index + 2}: delivery stop must be 1–20.`);
    if (r.orientation) {
      if (!['upright', 'flat', 'any'].includes(r.orientation.toLowerCase()))
        throw new Error(
          `Row ${index + 2}: orientation must be upright, flat or any.`,
        );
      i.orientation = r.orientation.toLowerCase() as Item['orientation'];
    }
    if (!i.stackable) i.maxTopLoad = 0;
    else if (!r.max_top_load_kg) {
      i.maxTopLoad = 0;
      i.stackable = false;
      i.notes += ' No stacking allowed until a known limit is entered.';
    }
    items = [...items, ...expandCargo(i, number('quantity', 1), items)];
  }
  checkCargoList(items);
  return items;
}

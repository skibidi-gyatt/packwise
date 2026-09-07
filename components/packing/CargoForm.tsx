'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Item } from '@/lib/packing/model';
import { cargoCheck, expandCargo } from '@/lib/packing/readiness';
export default function CargoForm({
  item,
  items,
  onClose,
  onSave,
  onDelete,
  onAdvanced,
}: {
  item: Item;
  items: Item[];
  onClose: () => void;
  onSave: (items: Item[]) => void;
  onDelete: () => void;
  onAdvanced: () => void;
}) {
  const [draft, setDraft] = useState(structuredClone(item)),
    [quantity, setQuantity] = useState(1),
    [error, setError] = useState(''),
    [applyGroup, setApplyGroup] = useState(false);
  const existing = items.some((i) => i.id === item.id),
    check = cargoCheck(item),
    siblings = item.quantityGroup
      ? items.filter(
          (i) => i.quantityGroup === item.quantityGroup && i.id !== item.id,
        )
      : [];
  const save = () => {
    try {
      if (!draft.name.trim()) throw new Error('Give this cargo a name.');
      if (!/^[A-Za-z0-9_-]{1,35}$/.test(draft.id))
        throw new Error('Use a cargo ID with letters, numbers, - or _.');
      if (
        cargoCheck({
          ...draft,
          source: 'manual',
          provenance: { dims: 'manual', mass: 'manual', handling: 'manual' },
        }).status === 'required'
      )
        throw new Error('Enter the dimensions and weight in cm and kg.');
      if (
        !Number.isInteger(draft.deliveryStop) ||
        draft.deliveryStop! < 1 ||
        draft.deliveryStop! > 20
      )
        throw new Error('Use a delivery stop from 1 to 20.');
      if (
        draft.stackable &&
        (!Number.isFinite(draft.maxTopLoad) ||
          draft.maxTopLoad <= 0 ||
          draft.maxTopLoad > 100000)
      )
        throw new Error(
          'Enter a known stacking limit, or choose nothing on top.',
        );
      const updated: Item = {
        ...draft,
        reviewed: { dims: true, mass: true, handling: true },
        provenance: {
          dims: draft.dims.some((n, k) => n !== item.dims[k])
            ? 'manual'
            : (item.provenance?.dims ?? item.source),
          mass:
            draft.mass !== item.mass
              ? 'manual'
              : (item.provenance?.mass ?? item.source),
          handling:
            draft.stackable !== item.stackable ||
            draft.maxTopLoad !== item.maxTopLoad
              ? 'manual'
              : (item.provenance?.handling ?? item.source),
        },
      };
      const rest = items.filter((i) => i.id !== item.id);
      onSave(
        existing
          ? items.map((i) =>
              i.id === item.id
                ? updated
                : applyGroup && siblings.some((s) => s.id === i.id)
                  ? {
                      ...i,
                      dims: [...updated.dims],
                      mass: updated.mass,
                      reviewed: { ...i.reviewed, dims: true, mass: true },
                      provenance: {
                        ...i.provenance,
                        dims: 'manual',
                        mass: 'manual',
                      },
                    }
                  : i,
            )
          : [...rest, ...expandCargo(updated, quantity, rest)],
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="edit-dialog">
        <DialogTitle>{existing ? `Check ${item.id}` : 'Add cargo'}</DialogTitle>
        <DialogDescription>
          {check.status === 'check'
            ? 'Only the measurements and significant handling estimates need your check.'
            : 'Use the outside size, including pallet and packaging.'}
        </DialogDescription>
        <div className="edit-fields">
          <label className="field">
            Cargo ID
            <input
              value={draft.id}
              disabled={existing}
              maxLength={35}
              onChange={(e) => setDraft({ ...draft, id: e.target.value })}
            />
          </label>
          <label className="field">
            Cargo name
            <input
              value={draft.name}
              maxLength={80}
              placeholder="Medical supply crate"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          {!existing && (
            <label className="field">
              Quantity · identical units
              <input
                type="number"
                min={1}
                max={30}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
          )}
          <div className="dimension-fields">
            {['Width · cm', 'Height · cm', 'Length · cm'].map((label, k) => (
              <label className="field" key={label}>
                {label}
                <input
                  type="number"
                  min={0.1}
                  max={2000}
                  value={draft.dims[k] || ''}
                  placeholder="Required"
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      dims: draft.dims.map((n, a) =>
                        a === k ? Number(e.target.value) : n,
                      ) as Item['dims'],
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label className="field">
            Weight per unit · kg
            <input
              type="number"
              min={0.01}
              max={100000}
              value={draft.mass || ''}
              placeholder="Required"
              onChange={(e) =>
                setDraft({ ...draft, mass: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            Can anything go on top?
            <select
              value={draft.stackable ? 'yes' : 'no'}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  stackable: e.target.value === 'yes',
                  maxTopLoad: 0,
                })
              }
            >
              <option value="no">No · keep the top clear</option>
              <option value="yes">Yes · I know the load limit</option>
            </select>
          </label>
          {draft.stackable && (
            <label className="field">
              Maximum weight on top · kg
              <input
                type="number"
                min={0.1}
                max={100000}
                value={draft.maxTopLoad || ''}
                placeholder="Known limit"
                onChange={(e) =>
                  setDraft({ ...draft, maxTopLoad: Number(e.target.value) })
                }
              />
            </label>
          )}
          <div className="route-fields full">
            <label className="field">
              Destination · optional for a single stop
              <input
                value={draft.destination ?? ''}
                maxLength={80}
                onChange={(e) =>
                  setDraft({ ...draft, destination: e.target.value })
                }
              />
            </label>
            <label className="field">
              Delivery stop
              <input
                type="number"
                min={1}
                max={20}
                value={draft.deliveryStop ?? 1}
                onChange={(e) =>
                  setDraft({ ...draft, deliveryStop: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <details className="form-more full">
            <summary>Advanced handling</summary>
            <p>
              Kept upright by default. More handling controls are available in
              Advanced.
            </p>
            <button className="text-button" onClick={onAdvanced}>
              Advanced cargo settings
            </button>
          </details>
        </div>
        {siblings.length > 0 && (
          <label className="check-field">
            <input
              type="checkbox"
              checked={applyGroup}
              onChange={(e) => setApplyGroup(e.target.checked)}
            />{' '}
            Apply these checked dimensions and weight to all{' '}
            {siblings.length + 1} identical units
          </label>
        )}
        <p className="field-authority">
          {item.source === 'astra_estimate'
            ? 'Photo measurements are estimates. Check the size and weight before confirming.'
            : item.source === 'manifest'
              ? 'Company manifest values. Enter a correction only if you have a verified replacement.'
              : 'Dimensions and weight are supplied by you.'}
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {existing && (
            <button className="danger" onClick={onDelete}>
              Remove cargo
            </button>
          )}
          <button className="primary" onClick={save}>
            {check.status === 'check'
              ? 'Confirm checked values'
              : existing
                ? 'Save cargo'
                : `Add ${quantity} ${quantity === 1 ? 'unit' : 'units'}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

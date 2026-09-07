'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Container, Item, Vec3 } from '@/lib/packing/model';
import { validateModel } from '@/lib/packing/model';

export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      {label}
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className="choice-trigger" aria-label={label}>
          <SelectValue>
            {options.find((o) => o.value === value)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
export function Numeric({
  label,
  value,
  onChange,
  min = 0,
  max = 2000,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        value={Number.isNaN(value) ? '' : value}
        min={min}
        max={max}
        step={step}
        onChange={(e) =>
          onChange(e.target.value === '' ? NaN : Number(e.target.value))
        }
        required
      />
    </label>
  );
}
export function ItemEditor({
  item,
  bag,
  onClose,
  onSave,
  onDelete,
}: {
  item: Item;
  bag: Container;
  onClose: () => void;
  onSave: (i: Item) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Item>(structuredClone(item)),
    [error, setError] = useState('');
  const change = (patch: Partial<Item>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const save = () => {
    const errors = validateModel([draft], bag);
    if (errors.length) {
      setError(errors.join(' '));
      return;
    }
    onSave({
      ...draft,
      source: 'manual',
      confidence: 1,
      provenance: { dims: 'manual', mass: 'manual', handling: 'manual' },
      notes:
        'Properties reviewed by the user. Measurement accuracy is not independently verified.',
    });
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="edit-dialog">
        <DialogTitle>Review {item.name}</DialogTitle>
        <DialogDescription>
          {item.source === 'astra_estimate'
            ? `Astra estimate · ${Math.round(item.confidence * 100)}% confidence. Dimensions and mass are inferred, not measured.`
            : 'Use external cargo dimensions, including its pallet and packaging.'}
        </DialogDescription>
        <div className="edit-fields">
          <label className="field full">
            Cargo description
            <input
              value={draft.name}
              maxLength={80}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <div className="dimension-fields">
            {['Width · cm', 'Height · cm', 'Length · cm'].map((label, k) => (
              <Numeric
                key={label}
                label={label}
                min={0.1}
                value={draft.dims[k]}
                onChange={(n) =>
                  change({
                    dims: draft.dims.map((x, j) => (j === k ? n : x)) as Vec3,
                  })
                }
              />
            ))}
          </div>
          <Numeric
            label="Cargo weight · kg"
            min={0.01}
            max={100000}
            step={0.01}
            value={draft.mass}
            onChange={(mass) => change({ mass })}
          />
          <Numeric
            label="Maximum top load · kg"
            value={draft.maxTopLoad}
            max={100000}
            onChange={(maxTopLoad) => change({ maxTopLoad })}
          />
          <Choice
            label="Material"
            value={draft.rigidity}
            options={[
              { value: 'rigid', label: 'Rigid' },
              { value: 'soft', label: 'Soft / compressible' },
            ]}
            onChange={(v) =>
              change({
                rigidity: v as Item['rigidity'],
                minRatio: v === 'rigid' ? 1 : 0.7,
              })
            }
          />
          <Choice
            label="Orientation"
            value={draft.orientation}
            options={[
              { value: 'any', label: 'Any rotation' },
              { value: 'upright', label: 'Keep upright' },
              { value: 'flat', label: 'Keep flat' },
            ]}
            onChange={(v) => change({ orientation: v as Item['orientation'] })}
          />
          {draft.rigidity === 'soft' && (
            <Numeric
              label="Minimum retained volume · %"
              min={40}
              max={100000}
              step={5}
              value={Math.round(draft.minRatio * 100)}
              onChange={(n) => change({ minRatio: n / 100 })}
            />
          )}
          <Choice
            label="Unloading access"
            value={draft.access}
            options={[
              { value: 'normal', label: 'Follow delivery stop' },
              { value: 'immediate', label: 'Priority access' },
            ]}
            onChange={(v) => change({ access: v as Item['access'] })}
          />
          <label className="check-field">
            <Checkbox
              checked={draft.fragile}
              onCheckedChange={(fragile) =>
                change({ fragile, maxTopLoad: fragile ? 0 : draft.maxTopLoad })
              }
            />{' '}
            Fragile
          </label>
          <label className="check-field">
            <Checkbox
              checked={draft.required}
              onCheckedChange={(required) => change({ required })}
            />{' '}
            Required on this load
          </label>
          <Numeric
            label="Delivery stop"
            value={draft.deliveryStop ?? 1}
            min={1}
            max={20}
            step={1}
            onChange={(deliveryStop) => change({ deliveryStop })}
          />
          <label className="field">
            Destination
            <input
              value={draft.destination ?? ''}
              maxLength={80}
              onChange={(e) => change({ destination: e.target.value })}
            />
          </label>
          <label className="check-field" htmlFor="cargo-stackable">
            <Checkbox
              id="cargo-stackable"
              checked={draft.stackable !== false}
              onCheckedChange={(stackable) =>
                change({
                  stackable,
                  maxTopLoad: stackable ? draft.maxTopLoad : 0,
                })
              }
            />
            Stackable
          </label>
          <label className="check-field" htmlFor="cargo-first-unload">
            <Checkbox
              id="cargo-first-unload"
              checked={draft.mustUnloadFirst ?? false}
              onCheckedChange={(first) =>
                change({
                  mustUnloadFirst: first,
                  access: first ? 'immediate' : 'normal',
                })
              }
            />
            Must unload first · clear extraction path
          </label>
        </div>
        <p className="muted small">{item.notes}</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button className="text-button danger" onClick={onDelete}>
            Remove cargo
          </button>
          <button className="primary" onClick={save}>
            Save cargo
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function BagEditor({
  bag,
  onClose,
  onSave,
}: {
  bag: Container;
  onClose: () => void;
  onSave: (c: Container) => void;
}) {
  const [draft, setDraft] = useState<Container>(structuredClone(bag)),
    [error, setError] = useState('');
  const change = (patch: Partial<Container>) =>
    setDraft((d) => ({ ...d, ...patch }));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="edit-dialog">
        <DialogTitle>Transport asset constraints</DialogTitle>
        <DialogDescription>
          Use usable interior dimensions. The opening is a separate, measured
          rectangular approximation.
        </DialogDescription>
        <div className="edit-fields">
          <label className="field full">
            Asset name
            <input
              value={draft.name}
              maxLength={60}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <div className="dimension-fields">
            {['Width · cm', 'Height · cm', 'Length · cm'].map((label, k) => (
              <Numeric
                key={label}
                label={label}
                min={1}
                value={draft.dims[k]}
                onChange={(n) =>
                  change({
                    dims: draft.dims.map((x, j) => (j === k ? n : x)) as Vec3,
                  })
                }
              />
            ))}
          </div>
          <Numeric
            label="Door width · cm"
            min={1}
            value={draft.opening[0]}
            onChange={(n) => change({ opening: [n, draft.opening[1]] })}
          />
          <Numeric
            label="Door height · cm"
            min={1}
            value={draft.opening[1]}
            onChange={(n) => change({ opening: [draft.opening[0], n] })}
          />
          <Numeric
            label="Payload limit · kg"
            min={0.1}
            max={100000}
            value={draft.maxMass}
            onChange={(maxMass) => change({ maxMass })}
          />
          <Numeric
            label="Floor load limit · kg/m²"
            min={1}
            max={100000}
            step={100}
            value={draft.floorLimitKgM2 ?? 1800}
            onChange={(floorLimitKgM2) => change({ floorLimitKgM2 })}
          />
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="small muted">
          Rigid asset; rear loading through a centred, floor-aligned door. Floor
          loading uses the full contact footprint. Wheel loads, axle ratings and
          securing are not modeled.
        </p>
        <button
          className="primary"
          onClick={() => {
            const errors = validateModel([], draft);
            if (errors.length) setError(errors.join(' '));
            else onSave(draft);
          }}
        >
          Save transport
        </button>
      </DialogContent>
    </Dialog>
  );
}

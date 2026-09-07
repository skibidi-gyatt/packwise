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
  max = 200,
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
            : 'Use the dimensions of the item as you will pack it.'}
        </DialogDescription>
        <div className="edit-fields">
          <label className="field full">
            Item name
            <input
              value={draft.name}
              maxLength={80}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <div className="dimension-fields">
            {['Width · cm', 'Height · cm', 'Depth · cm'].map((label, k) => (
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
            label="Weight · kg"
            min={0.01}
            max={100}
            step={0.01}
            value={draft.mass}
            onChange={(mass) => change({ mass })}
          />
          <Numeric
            label="Max weight on top · kg"
            value={draft.maxTopLoad}
            max={100}
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
              max={100}
              step={5}
              value={Math.round(draft.minRatio * 100)}
              onChange={(n) => change({ minRatio: n / 100 })}
            />
          )}
          <Choice
            label="When do you need it?"
            value={draft.access}
            options={[
              { value: 'normal', label: 'At my destination' },
              { value: 'immediate', label: 'During the journey' },
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
            Must pack
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
            Remove item
          </button>
          <button className="primary" onClick={save}>
            Save & replan
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
        <DialogTitle>Measure your backpack</DialogTitle>
        <DialogDescription>
          Use usable interior dimensions. The opening is a separate, measured
          rectangular approximation.
        </DialogDescription>
        <div className="edit-fields">
          <label className="field full">
            Bag name
            <input
              value={draft.name}
              maxLength={60}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <div className="dimension-fields">
            {['Width · cm', 'Height · cm', 'Depth · cm'].map((label, k) => (
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
            label="Opening width · cm"
            min={1}
            value={draft.opening[0]}
            onChange={(n) => change({ opening: [n, draft.opening[1]] })}
          />
          <Numeric
            label="Opening depth · cm"
            min={1}
            value={draft.opening[1]}
            onChange={(n) => change({ opening: [draft.opening[0], n] })}
          />
          <Numeric
            label="Weight limit · kg"
            min={0.1}
            max={100}
            value={draft.maxMass}
            onChange={(maxMass) => change({ maxMass })}
          />
          <Numeric
            label="Allowed depth expansion · %"
            max={30}
            step={5}
            value={Math.round(draft.expansion * 100)}
            onChange={(n) => change({ expansion: n / 100 })}
          />
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="small muted">
          Set expansion to 0 for a rigid container. Expansion does not enlarge
          the measured opening.
        </p>
        <button
          className="primary"
          onClick={() => {
            const errors = validateModel([], draft);
            if (errors.length) setError(errors.join(' '));
            else onSave(draft);
          }}
        >
          Save & replan
        </button>
      </DialogContent>
    </Dialog>
  );
}

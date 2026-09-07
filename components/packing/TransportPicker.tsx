'use client';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Container } from '@/lib/packing/model';
import { validateModel } from '@/lib/packing/model';
import { cargoAsset } from '@/lib/packing/cargo-demo';
import { BagEditor } from './Editors';
const storageKey = 'packwise-saved-transports-v1';
function readSaved(): Container[] {
  try {
    const rows = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(rows)
      ? rows
          .filter(
            (b) =>
              typeof b?.name === 'string' &&
              b.loading === 'rear' &&
              Array.isArray(b.dims) &&
              Array.isArray(b.opening) &&
              validateModel([], b).length === 0,
          )
          .slice(0, 10)
      : [];
  } catch {
    return [];
  }
}
export default function TransportPicker({
  current,
  onClose,
  onSelect,
}: {
  current: Container;
  onClose: () => void;
  onSelect: (b: Container) => void;
}) {
  const [saved, setSaved] = useState<Container[]>([]),
    [editing, setEditing] = useState<Container | null>(null),
    [notice, setNotice] = useState('');
  useEffect(() => {
    queueMicrotask(() => setSaved(readSaved()));
  }, []);
  function save(b: Container) {
    const next = [b, ...saved.filter((v) => v.name !== b.name)].slice(0, 10);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setNotice(
        'This browser could not save the truck. You can still select it for this load.',
      );
    }
    setSaved(next);
    setEditing(null);
  }
  if (editing)
    return (
      <BagEditor bag={editing} onClose={() => setEditing(null)} onSave={save} />
    );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="transport-dialog">
        <DialogTitle>Select transport</DialogTitle>
        <DialogDescription>
          Choose a saved vehicle. Your saved dimensions stay on this device.
        </DialogDescription>
        <div className="transport-options">
          {[
            ...saved,
            ...(!saved.some((b) => b.name === cargoAsset.name)
              ? [cargoAsset]
              : []),
          ].map((b) => (
            <button
              key={b.name}
              className="transport-option"
              onClick={() => onSelect(structuredClone(b))}
            >
              <strong>{b.name}</strong>
              <span>
                {b.dims.map((n) => (n / 100).toFixed(1)).join(' × ')} m ·{' '}
                {b.maxMass.toLocaleString()} kg capacity
              </span>
              <small>
                {b.name === cargoAsset.name
                  ? 'Sample truck · verify before real use'
                  : 'Saved on this device'}
              </small>
            </button>
          ))}
        </div>
        {notice && <output>{notice}</output>}
        <div className="dialog-actions">
          <button
            className="quiet-button"
            onClick={() => setEditing(structuredClone(current))}
          >
            Edit & save this transport
          </button>
          <button
            className="primary"
            onClick={() =>
              setEditing({
                ...structuredClone(cargoAsset),
                name: 'New transport',
              })
            }
          >
            Add transport
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

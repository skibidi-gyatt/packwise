'use client';
import { useState } from 'react';
import { ZodError } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { csvTemplate, parseCargoImport } from '@/lib/packing/csv';
import type { Item } from '@/lib/packing/model';
export default function ManifestInput({
  onClose,
  onApply,
}: {
  items: Item[];
  onClose: () => void;
  onApply: (i: Item[]) => void;
}) {
  const [text, setText] = useState(csvTemplate),
    [error, setError] = useState('');
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="manifest-dialog">
        <DialogTitle>Import cargo manifest</DialogTitle>
        <DialogDescription>
          CSV or JSON, with centimetres and kilograms. Quantity expands to
          individually tracked units. Review before replacing the current
          manifest.
        </DialogDescription>
        <button
          className="text-button"
          onClick={() => {
            const u = URL.createObjectURL(
              new Blob([csvTemplate], { type: 'text/csv' }),
            );
            const a = document.createElement('a');
            a.href = u;
            a.download = 'cargo-template.csv';
            a.click();
            setTimeout(() => URL.revokeObjectURL(u), 1000);
          }}
        >
          Download CSV template
        </button>
        <label className="field">
          Manifest file · CSV or JSON
          <input
            type="file"
            accept="text/csv,.csv,application/json,.json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 150000) {
                setError('Use a manifest file smaller than 150 KB.');
                return;
              }
              setText(await f.text());
              setError('');
            }}
          />
        </label>
        <label className="field">
          Manifest data
          <textarea
            aria-label="Manifest data"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </label>
        <p className="small muted">
          CSV columns: id, name, width_cm, height_cm, length_cm, weight_kg,
          quantity, destination. Missing size or weight is flagged for checking.
          Stacking defaults to nothing on top. Quantity defaults to 1. Maximum
          30 expanded units.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          className="primary"
          onClick={() => {
            try {
              onApply(parseCargoImport(text));
            } catch (e) {
              setError(
                e instanceof SyntaxError
                  ? 'Invalid JSON. Check quotes, commas and brackets.'
                  : e instanceof ZodError
                    ? e.issues
                        .slice(0, 3)
                        .map(
                          (i) =>
                            `Row ${Number(i.path[0] ?? 0) + 1}, ${String(i.path[1] ?? 'rows')}: ${i.message}`,
                        )
                        .join(' · ')
                    : e instanceof Error
                      ? e.message
                      : 'Invalid manifest.',
              );
            }
          }}
        >
          Replace manifest & check cargo
        </button>
      </DialogContent>
    </Dialog>
  );
}

'use client';
import { useState } from 'react';
import { ZodError } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { manifestText, parseManifest } from '@/lib/packing/manifest';
import type { Item } from '@/lib/packing/model';
export default function ManifestInput({
  items,
  onClose,
  onApply,
}: {
  items: Item[];
  onClose: () => void;
  onApply: (i: Item[]) => void;
}) {
  const [text, setText] = useState(manifestText(items)),
    [error, setError] = useState('');
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="manifest-dialog">
        <DialogTitle>Import cargo manifest</DialogTitle>
        <DialogDescription>
          JSON rows with centimetres and kilograms. Quantity expands to
          individually tracked units. Review before replacing the current
          manifest.
        </DialogDescription>
        <label className="field">
          Manifest file · JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 150000) {
                setError('Use a JSON file smaller than 150 KB.');
                return;
              }
              setText(await f.text());
              setError('');
            }}
          />
        </label>
        <label className="field">
          Manifest JSON
          <textarea
            aria-label="Manifest JSON"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </label>
        <p className="small muted">
          Required columns: id, name, width_cm, height_cm, length_cm, weight_kg,
          stop, destination, stackable, max_top_load_kg. Quantity defaults to 1.
          Maximum 30 expanded units.
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
              onApply(parseManifest(text));
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
          Validate & import manifest
        </button>
      </DialogContent>
    </Dialog>
  );
}

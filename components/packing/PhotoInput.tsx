'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Camera, Upload, LoaderCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { photoPalette, perceptionSchema } from '@/lib/astra/schemas';
import type { Perception } from '@/lib/astra/schemas';
import type { Item, Container } from '@/lib/packing/model';
import { validateModel } from '@/lib/packing/model';

async function prepare(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG, or WebP photo.');
  if (file.size > 15 * 1024 * 1024)
    throw new Error('Choose a photo smaller than 15 MB.');
  const bitmap = await createImageBitmap(file),
    canvas = document.createElement('canvas');
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
export default function PhotoInput({
  available,
  asset,
  onClose,
  onApply,
}: {
  available: boolean;
  asset: Container;
  onClose: () => void;
  onApply: (items: Item[], bag: Container) => void;
}) {
  const [photos, setPhotos] = useState<{ container?: string; items?: string }>(
      {},
    ),
    [reference, setReference] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState<Perception | null>(null),
    [reviewed, setReviewed] = useState(false);
  const [measured, setMeasured] = useState<string[]>([]);
  const analyze = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/astra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'perceive',
          reference,
          images: Object.entries(photos).map(([role, data]) => ({
            role,
            data,
          })),
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        result: unknown;
      };
      if (!response.ok) throw new Error(body.error || 'Photo analysis failed.');
      setResult(perceptionSchema.parse(body.result));
      setReviewed(false);
      setMeasured([]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not analyze the photos.',
      );
    } finally {
      setBusy(false);
    }
  };
  const apply = () => {
    if (!result) return;
    const items: Item[] = result.items.map((i, k) => ({
      ...i,
      dims: i.dims as [number, number, number],
      color: photoPalette[k % photoPalette.length],
      source: 'astra_estimate',
      stackable: i.maxTopLoad > 0,
      deliveryStop: 1,
      destination: 'Unassigned — review',
      provenance: {
        dims: measured.includes(i.id) ? 'manual' : 'astra_estimate',
        mass: 'astra_estimate',
        handling: 'astra_estimate',
      },
    }));
    const container: Container = {
      ...result.container,
      kind: 'truck',
      loading: 'rear',
      expansion: 0,
      dims: result.container.dims as [number, number, number],
      opening: result.container.opening as [number, number],
    };
    const errors = validateModel(items, asset);
    if (errors.length) {
      setError(errors.join(' '));
      return;
    }
    onApply(items, container);
  };
  return (
    <Dialog open onOpenChange={(open) => !busy && !open && onClose()}>
      <DialogContent className="photo-dialog">
        <DialogTitle>Astra cargo understanding</DialogTitle>
        <DialogDescription>
          Photograph cargo labels and the rear opening. A ruler or a known
          dimension helps. Photos are sent to OpenAI only when you select
          Analyze.
        </DialogDescription>
        {!available && (
          <div className="notice">
            Runtime Astra is not connected. You can preview photos here; use the
            sample manifest or cargo editor until a server API key is
            configured.
          </div>
        )}
        <div className="photo-grid">
          {(['container', 'items'] as const).map((role) => (
            <label className="upload-box" key={role}>
              {photos[role] ? (
                <Image
                  src={photos[role]!}
                  width={640}
                  height={480}
                  unoptimized
                  alt={
                    role === 'container'
                      ? 'Selected transport asset'
                      : 'Selected cargo units'
                  }
                />
              ) : (
                <Camera size={32} />
              )}
              <strong>
                {role === 'container' ? 'Transport asset' : 'Cargo units'}
              </strong>
              <span>Choose photo</span>
              <input
                aria-label={`${role} photo`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const data = await prepare(f);
                    setPhotos((p) => ({ ...p, [role]: data }));
                    setResult(null);
                    setError('');
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              />
            </label>
          ))}
        </div>
        <label className="field">
          Known measurements or reference
          <textarea
            maxLength={1500}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="The truck interior is 240 × 240 × 600 cm. Manifest weight for P14 is 230 kg."
          />
        </label>
        <button
          className="primary"
          disabled={busy || !available || !photos.items}
          onClick={analyze}
        >
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Upload size={18} />
          )}{' '}
          {busy ? 'Astra is reviewing the photos…' : 'Analyze with Astra'}
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {result && (
          <div className="photo-result">
            <p className="eyebrow">OBSERVED</p>
            <p>{result.observed}</p>
            <p className="notice">{result.uncertainty}</p>
            <div className="estimate-list">
              {result.items.map((i, k) => (
                <div key={i.id}>
                  <strong>{i.name}</strong>
                  <span>
                    {i.dims.join(' × ')} cm · {i.mass} kg ·{' '}
                    {Math.round(i.confidence * 100)}% confidence
                  </span>
                  <div className="dimension-fields">
                    {i.dims.map((n, axis) => (
                      <label className="field" key={axis}>
                        {['Width', 'Height', 'Length'][axis]}
                        <input
                          type="number"
                          min={0.1}
                          max={2000}
                          value={n}
                          onChange={(e) => {
                            setMeasured((ids) => [...new Set([...ids, i.id])]);
                            setReviewed(false);
                            setResult((r) =>
                              r
                                ? {
                                    ...r,
                                    items: r.items.map((it, j) =>
                                      j === k
                                        ? {
                                            ...it,
                                            dims: it.dims.map((x, a) =>
                                              a === axis
                                                ? Number(e.target.value)
                                                : x,
                                            ) as [number, number, number],
                                          }
                                        : it,
                                    ),
                                  }
                                : r,
                            );
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="small muted">
              Asset suggestion: {result.container.dims.join(' × ')} cm; opening{' '}
              {result.container.opening.join(' × ')} cm;{' '}
              {result.container.maxMass} kg limit. Existing asset measurements
              and cargo IDs are retained. New IDs are added after review.
            </p>
            <label className="check-field" htmlFor="photo-review">
              <Checkbox
                id="photo-review"
                checked={reviewed}
                onCheckedChange={setReviewed}
              />{' '}
              I reviewed these estimates and will verify inferred dimensions and
              load limits before physical loading.
            </label>
            <button className="primary" disabled={!reviewed} onClick={apply}>
              Use reviewed estimates
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

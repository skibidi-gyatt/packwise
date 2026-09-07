'use client';
import { useState } from 'react';
import Image from 'next/image';
import { hasNativeFileExporter, saveTextFile } from '@/lib/packing/files';
import { Camera, LoaderCircle } from 'lucide-react';
import CargoPhotoResults from './CargoPhotoResults';
import PhotoSourcePicker from './PhotoSourcePicker';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Item, Container } from '@/lib/packing/model';
import {
  captureSchema,
  captureCargo,
  type CaptureResult,
} from '@/lib/astra/capture';
async function prepare(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG or WebP photo.');
  if (file.size > 15 * 1024 * 1024)
    throw new Error('Choose a photo smaller than 15 MB.');
  const bitmap = await createImageBitmap(file);
  if (Math.min(bitmap.width, bitmap.height) < 320) {
    bitmap.close();
    throw new Error(
      'This photo is too small to see cargo edges. Retake it at a higher resolution.',
    );
  }
  const canvas = document.createElement('canvas'),
    scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
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
  items,
  onClose,
  onApply,
}: {
  available: boolean;
  asset: Container;
  items: Item[];
  onClose: () => void;
  onApply: (items: Item[]) => void;
}) {
  const [mode, setMode] = useState<'single' | 'batch'>('single'),
    [photos, setPhotos] = useState<{ items?: string; side?: string }>({}),
    [quantity, setQuantity] = useState(1),
    [reference, setReference] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState<CaptureResult | null>(null),
    [showSide, setShowSide] = useState(false);
  async function analyze() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const r = await fetch('/api/astra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'capture',
          mode,
          reference,
          images: Object.entries(photos).map(([role, data]) => ({
            role,
            data,
          })),
          items: items.map(({ id, name }) => ({ id, name })),
        }),
      });
      const b = (await r.json()) as { error?: string; result: unknown };
      if (!r.ok) throw new Error(b.error || 'The photo could not be checked.');
      const parsed = captureSchema.parse(b.result);
      if (mode === 'single' && parsed.items.length > 1)
        throw new Error(
          'Several units were identified. Switch to Batch, or retake a photo of one unit.',
        );
      setResult(parsed);
      if (parsed.secondViewRequired) setShowSide(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !busy && !o && onClose()}>
      <DialogContent className="photo-dialog">
        <DialogTitle>Scan cargo</DialogTitle>
        <DialogDescription>
          Capture a useful view, then check only the measurements that need your
          attention.
        </DialogDescription>
        <fieldset className="scan-modes" aria-label="Scan mode">
          <button
            disabled={busy}
            aria-pressed={mode === 'single'}
            onClick={() => {
              setMode('single');
              setResult(null);
            }}
          >
            Single cargo + quantity
          </button>
          <button
            disabled={busy}
            aria-pressed={mode === 'batch'}
            onClick={() => {
              setMode('batch');
              setQuantity(1);
              setResult(null);
            }}
          >
            Batch · different cargo
          </button>
        </fieldset>
        <div className="capture-guide">
          <figure className="capture-diagram">
            <svg
              viewBox="0 0 400 170"
              aria-label="Put the marker flat against the cargo front, keeping the whole cargo visible"
            >
              <rect
                x="55"
                y="15"
                width="210"
                height="135"
                fill="#f0f4f5"
                stroke="#526b78"
                strokeWidth="2"
              />
              <text x="80" y="45" fill="#173746" fontSize="15">
                Cargo front
              </text>
              <rect
                x="73"
                y="78"
                width="55"
                height="55"
                fill="white"
                stroke="#102c3b"
                strokeWidth="6"
              />
              <path d="M135 105H285" stroke="#526b78" />
              <text x="290" y="99" fill="#173746" fontSize="13">
                20 cm
              </text>
              <text x="290" y="120" fill="#173746" fontSize="13">
                marker
              </text>
            </svg>
            <figcaption>
              Place the marker flat against the front. Step slightly to one side
              so the photo also shows the cargo depth.
            </figcaption>
          </figure>
          <ol>
            <li>
              Show the whole{' '}
              {mode === 'batch'
                ? 'group, with space between units'
                : 'unit, including its pallet'}
              .
            </li>
            <li>
              Place the <strong>20 cm scan marker</strong> beside it, on the
              same plane.
            </li>
            <li>
              Use an angled view showing the front and side. Keep edges clear
              and labels readable.
            </li>
          </ol>
          <a
            href="/cargo-scan-marker.html"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              if (!hasNativeFileExporter()) return;
              e.preventDefault();
              void fetch('/cargo-scan-marker.html')
                .then((r) => {
                  if (!r.ok)
                    throw new Error('The marker file could not be opened.');
                  return r.text();
                })
                .then((t) =>
                  saveTextFile('cargo-scan-marker.html', t, 'text/html'),
                )
                .catch((e) => setError((e as Error).message));
            }}
          >
            {hasNativeFileExporter()
              ? 'Share printable 20 cm marker'
              : 'Open printable 20 cm marker'}
          </a>
          <p>
            Print at 100% and check the outer square with a ruler. Photo
            dimensions are approximate.
          </p>
        </div>
        {!available && (
          <p className="notice">
            Photo analysis is unavailable until runtime AI is connected. You can
            prepare photos here, or close this window and use Import manifest or
            Add manually.
          </p>
        )}
        <div className="photo-grid">
          {(
            ['items', ...(showSide ? ['side'] : [])] as ('items' | 'side')[]
          ).map((role) => (
            <div className="upload-box scan-frame" key={role}>
              {photos[role] ? (
                <Image
                  src={photos[role]!}
                  width={640}
                  height={480}
                  unoptimized
                  alt={
                    role === 'items'
                      ? 'Selected cargo front and angled view'
                      : 'Selected cargo side view'
                  }
                />
              ) : (
                <Camera size={34} />
              )}
              <strong>
                {role === 'items' ? 'Front & angled view' : 'Side view'}
              </strong>
              <span>
                {photos[role]
                  ? 'Retake or choose another photo'
                  : 'Take photo or choose from device'}
              </span>
              <small>
                Full cargo visible · marker visible · minimal overlap
              </small>
              <PhotoSourcePicker
                label={role === 'items' ? 'Cargo photo' : 'Side photo'}
                disabled={busy}
                onSelect={(f) => {
                  void (async () => {
                    try {
                      const data = await prepare(f);
                      setPhotos((p) => ({ ...p, [role]: data }));
                      setResult(null);
                      setError('');
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  })();
                }}
              />
            </div>
          ))}
        </div>
        {!showSide && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => setShowSide(true)}
          >
            Add an optional side view for irregular cargo
          </button>
        )}
        {mode === 'single' && (
          <label className="field">
            Quantity · identical units
            <input
              type="number"
              value={quantity}
              min={1}
              max={30}
              disabled={busy}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
        )}
        <details className="form-more">
          <summary>Add known measurements or label details</summary>
          <label className="field">
            Known cargo facts
            <textarea
              maxLength={1500}
              disabled={busy}
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                setResult(null);
              }}
              placeholder="Crate C04 weighs 105 kg, including the pallet."
            />
          </label>
        </details>
        <p className="small muted">
          Photos are sent to OpenAI only when you select Check photo. This app
          does not save them. Up to 30 cargo units per load.
        </p>
        <button
          className="primary"
          disabled={!available || busy || !photos.items}
          onClick={() => void analyze()}
        >
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Camera size={18} />
          )}{' '}
          {busy
            ? 'Checking visibility and cargo…'
            : 'Check photo & identify cargo'}
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {result && (
          <CargoPhotoResults
            result={result}
            onAdd={() => {
              try {
                onApply(captureCargo(result, mode === 'single' ? quantity : 1));
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

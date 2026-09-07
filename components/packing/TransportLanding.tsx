'use client';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Camera,
  Check,
  Container as ContainerIcon,
  LoaderCircle,
  Ruler,
  Truck,
} from 'lucide-react';
import type { Container } from '@/lib/packing/model';
import { cargoAsset } from '@/lib/packing/cargo-demo';
import {
  readTransports,
  transportStorageKey,
  transportErrors,
  usableTransportPhoto,
} from '@/lib/packing/transports';
import { preparePhoto } from '@/lib/packing/prepare-photo';
import './transport-landing.css';

type Fields = {
  name: string;
  width: string;
  height: string;
  length: string;
  doorWidth: string;
  doorHeight: string;
  weight: string;
  floor: string;
};
const empty: Fields = {
  name: '',
  width: '',
  height: '',
  length: '',
  doorWidth: '',
  doorHeight: '',
  weight: '',
  floor: '',
};
export default function TransportLanding({
  onSelect,
}: {
  onSelect: (b: Container) => void;
}) {
  const [saved, setSaved] = useState<Container[]>([]);
  const [kind, setKind] = useState<'truck' | 'container' | null>(null);
  const [fields, setFields] = useState<Fields>(empty);
  const [photoMode, setPhotoMode] = useState(false);
  const [photos, setPhotos] = useState<{ container?: string; side?: string }>(
    {},
  );
  const [reference, setReference] = useState('Packwise 20 cm square marker');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [guidance, setGuidance] = useState('');
  const [estimated, setEstimated] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [remember, setRemember] = useState(true);
  const [pending, setPending] = useState<Container | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const revision = useRef(0);
  useEffect(() => {
    queueMicrotask(() => setSaved(readTransports()));
    const controller = new AbortController();
    fetch('/api/astra', { signal: controller.signal })
      .then((r) => r.json())
      .then((r) =>
        setAvailable((r as { available?: boolean }).available === true),
      )
      .catch(() => setAvailable(false));
    return () => {
      controller.abort();
    };
  }, []);
  useEffect(() => {
    if (kind) heading.current?.focus();
  }, [kind]);
  function start(nextKind: 'truck' | 'container', value?: Container) {
    revision.current++;
    setKind(nextKind);
    setError('');
    setGuidance('');
    setPhotos({});
    setPhotoMode(false);
    setEstimated(false);
    setReviewed(false);
    setPending(null);
    setFields(
      value
        ? {
            name: value.name,
            width: String(value.dims[0]),
            height: String(value.dims[1]),
            length: String(value.dims[2]),
            doorWidth: String(value.opening[0]),
            doorHeight: String(value.opening[1]),
            weight: String(value.maxMass),
            floor: value.floorLimitKgM2 ? String(value.floorLimitKgM2) : '',
          }
        : {
            ...empty,
            name: nextKind === 'truck' ? 'My truck' : 'My container',
          },
    );
  }
  function update(key: keyof Fields, value: string) {
    setFields((old) => ({ ...old, [key]: value }));
    setPending(null);
    if (['width', 'height', 'length', 'doorWidth', 'doorHeight'].includes(key))
      setReviewed(false);
  }
  async function photo(file: File | undefined, role: 'container' | 'side') {
    if (!file) return;
    setPreparing(true);
    setError('');
    setGuidance('');
    try {
      setPhotos((old) => ({ ...old, [role]: undefined }));
      const data = await preparePhoto(file);
      setPhotos((old) => ({ ...old, [role]: data }));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not open this photo. Try a JPEG.',
      );
    } finally {
      setPreparing(false);
    }
  }
  async function estimate() {
    const current = ++revision.current;
    setBusy(true);
    setError('');
    setGuidance('');
    try {
      const r = await fetch('/api/astra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(70000),
        body: JSON.stringify({
          action: 'transport-capture',
          reference,
          images: Object.entries(photos)
            .filter(([, data]) => data)
            .map(([role, data]) => ({ role, data })),
        }),
      });
      const body = (await r.json()) as { error?: string; result?: unknown };
      if (!r.ok)
        throw new Error(
          body.error ||
            'Photo estimation failed. Try again or enter measurements below.',
        );
      const result = usableTransportPhoto(body.result);
      if (current !== revision.current) return;
      const hasDimensions = [...result.dims, ...result.opening].some(
        (n) => n !== null,
      );
      setGuidance(result.guidance || 'Enter any missing measurements below.');
      if (hasDimensions) {
        // Deliberately do not accept payload or floor ratings from the model.
        setFields((old) => ({
          ...old,
          width: result.dims[0]?.toFixed(1) ?? '',
          height: result.dims[1]?.toFixed(1) ?? '',
          length: result.dims[2]?.toFixed(1) ?? '',
          doorWidth: result.opening[0]?.toFixed(1) ?? '',
          doorHeight: result.opening[1]?.toFixed(1) ?? '',
        }));
        setEstimated(true);
        setReviewed(false);
      }
    } catch (e) {
      if (current === revision.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Photo estimation failed. Enter measurements below.',
        );
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }
  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const bag: Container = {
      name: fields.name.trim(),
      kind: kind ?? 'truck',
      loading: 'rear',
      expansion: 0,
      dims: [
        Number(fields.width),
        Number(fields.height),
        Number(fields.length),
      ],
      opening: [Number(fields.doorWidth), Number(fields.doorHeight)],
      maxMass: Number(fields.weight),
      ...(fields.floor ? { floorLimitKgM2: Number(fields.floor) } : {}),
    };
    const errors = transportErrors(bag, estimated, reviewed);
    if (errors.length) {
      setError(errors.join(' '));
      return;
    }
    if (remember) {
      try {
        localStorage.setItem(
          transportStorageKey,
          JSON.stringify(
            [bag, ...readTransports().filter((b) => b.name !== bag.name)].slice(
              0,
              10,
            ),
          ),
        );
      } catch {
        setPending(bag);
        setError(
          'This browser could not save your transport. You can still open this load without saving.',
        );
        return;
      }
    }
    onSelect(bag);
  }
  const measurement = (key: keyof Fields, label: string, max = 2000) => (
    <label className="tl-field" key={key}>
      <span>{label}</span>
      <div className="tl-unit-input">
        <input
          required
          type="number"
          inputMode="decimal"
          min="0.1"
          max={max}
          step="any"
          value={fields[key]}
          onChange={(e) => update(key, e.target.value)}
        />
        <span>
          {key === 'weight' ? 'kg' : key === 'floor' ? 'kg/m²' : 'cm'}
        </span>
      </div>
    </label>
  );
  return (
    <div className="transport-landing">
      <header className="tl-header">
        <Link href="/" aria-label="Packwise home" onClick={() => setKind(null)}>
          <Box size={24} strokeWidth={1.8} />
          <strong>
            packwise<span>.</span>
          </strong>
        </Link>
        <span>Cargo load planning</span>
      </header>
      <main className="tl-main" id="main">
        <section className="tl-intro">
          <h1>
            Every good load starts
            <br />
            with the right space.
          </h1>
          <p>
            Choose your transport, set its capacity,
            <br className="tl-desktop-break" /> and make room for a better load.
          </p>
          <ol className="tl-steps">
            <li className="tl-current">
              <span>1</span> Select transport
            </li>
            <li>
              <span>2</span> Add your cargo
            </li>
            <li>
              <span>3</span> Plan your load
            </li>
          </ol>
          <p className="tl-footnote">Choose your space. Then add your cargo.</p>
        </section>
        <section className="tl-selection" aria-label="Transport selection">
          {!kind ? (
            <>
              <h2>What are you loading?</h2>
              <p className="tl-muted">
                Start with a truck or shipping container.
              </p>
              <div className="tl-choices">
                <button onClick={() => start('truck')}>
                  <Truck size={32} strokeWidth={1.5} />
                  <span>
                    <strong>Truck</strong>
                    <small>Set up your cargo space</small>
                  </span>
                  <ArrowRight size={20} />
                </button>
                <button onClick={() => start('container')}>
                  <ContainerIcon size={32} strokeWidth={1.5} />
                  <span>
                    <strong>Shipping container</strong>
                    <small>Set up your container interior</small>
                  </span>
                  <ArrowRight size={20} />
                </button>
              </div>
              <div className="tl-photo-hint">
                <Camera size={20} />
                <span>No measurements yet? Take a photo in the next step.</span>
              </div>
              {saved.length > 0 && (
                <div className="tl-saved">
                  <h3>Saved on this device</h3>
                  {saved.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => start(b.kind ?? 'truck', b)}
                    >
                      <span>
                        <strong>{b.name}</strong>
                        <small>
                          {b.dims.join(' × ')} cm · {b.maxMass.toLocaleString()}{' '}
                          kg
                        </small>
                      </span>
                      <ArrowRight size={18} />
                    </button>
                  ))}
                </div>
              )}
              <button
                className="tl-sample"
                onClick={() => start('truck', structuredClone(cargoAsset))}
              >
                Try the sample truck <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                className="tl-back"
                disabled={busy || preparing}
                onClick={() => {
                  revision.current++;
                  setKind(null);
                }}
              >
                <ArrowLeft size={16} /> All transports
              </button>
              <h2 tabIndex={-1} ref={heading}>
                Set up your {kind === 'truck' ? 'truck' : 'container'}
              </h2>
              <p className="tl-muted">
                Use the empty interior’s usable dimensions.
              </p>
              <form onSubmit={submit}>
                <fieldset disabled={busy || preparing} className="tl-fields">
                  <label className="tl-field">
                    <span>Transport name</span>
                    <input
                      required
                      maxLength={80}
                      value={fields.name}
                      onChange={(e) => update('name', e.target.value)}
                    />
                  </label>
                  <div className="tl-methods">
                    <button
                      type="button"
                      aria-pressed={!photoMode}
                      onClick={() => setPhotoMode(false)}
                    >
                      <Ruler size={17} /> Enter dimensions
                    </button>
                    <button
                      type="button"
                      aria-pressed={photoMode}
                      onClick={() => setPhotoMode(true)}
                    >
                      <Camera size={17} /> Use a photo
                    </button>
                  </div>
                  {photoMode && (
                    <div className="tl-photo">
                      <h3>Photograph the empty space</h3>
                      <p>
                        Show the floor, ceiling, both walls and the far end.
                        Include a visible object of known size. An angled second
                        view helps estimate depth.
                      </p>
                      <a
                        href="/packwise-marker.html"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Print the 20 cm reference marker{' '}
                        <ArrowRight size={14} />
                      </a>
                      <div className="tl-photo-inputs">
                        {(['container', 'side'] as const).map((role) => (
                          <label key={role}>
                            <span>
                              {role === 'container'
                                ? 'Interior photo'
                                : 'Second angle (optional)'}
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              capture="environment"
                              onChange={(e) => {
                                void photo(e.target.files?.[0], role);
                                e.target.value = '';
                              }}
                            />
                            {photos[role] && (
                              <Image
                                src={photos[role]!}
                                width={300}
                                height={180}
                                alt={
                                  role === 'container'
                                    ? 'Your transport interior'
                                    : 'Your second angle'
                                }
                                unoptimized
                              />
                            )}
                          </label>
                        ))}
                      </div>
                      <label className="tl-field">
                        <span>Visible reference and its size</span>
                        <input
                          maxLength={1500}
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          placeholder="For example: a 100 cm ruler on the floor"
                        />
                      </label>
                      <p className="tl-muted">
                        Only the photos you choose are sent for AI analysis when
                        you click Estimate. Photos are not saved with your
                        transport.
                      </p>
                      {available === false && (
                        <p className="tl-notice">
                          Photo estimation needs an AI connection, which is not
                          connected yet. You can still enter your measurements
                          below.
                        </p>
                      )}
                      <button
                        className="primary"
                        type="button"
                        disabled={
                          !available || !photos.container || !reference.trim()
                        }
                        onClick={() => void estimate()}
                      >
                        {busy ? (
                          <LoaderCircle className="animate-spin" size={17} />
                        ) : (
                          <Camera size={17} />
                        )}
                        {busy
                          ? 'Estimating dimensions…'
                          : available === null
                            ? 'Checking photo service…'
                            : 'Estimate dimensions'}
                      </button>
                      {guidance && (
                        <output className="tl-notice">{guidance}</output>
                      )}
                    </div>
                  )}
                  <div className="tl-group">
                    <h3>
                      {estimated
                        ? 'Review estimated dimensions'
                        : 'Interior dimensions'}
                    </h3>
                    <div className="tl-grid">
                      {measurement('width', 'Width')}
                      {measurement('height', 'Height')}
                      {measurement('length', 'Length')}
                    </div>
                  </div>
                  <div className="tl-group">
                    <h3>Clear door opening</h3>
                    <p className="tl-muted">
                      The opening cargo must pass through.
                    </p>
                    <div className="tl-grid tl-two">
                      {measurement('doorWidth', 'Door width')}
                      {measurement('doorHeight', 'Door height')}
                    </div>
                  </div>
                  <div className="tl-weight">
                    {measurement('weight', 'Maximum cargo weight', 100000)}
                    <p>
                      Enter the permitted cargo payload from your transport’s
                      specifications, in kilograms. This is never estimated from
                      a photo.
                    </p>
                  </div>
                  <details className="tl-floor">
                    <summary>Floor load limit (optional)</summary>
                    <p>
                      Enter a known rating. Floor loading is not checked when
                      this is blank.
                    </p>
                    <label className="tl-field">
                      <span>Maximum floor load (kg/m²)</span>
                      <input
                        type="number"
                        min="0.1"
                        max="100000"
                        step="any"
                        inputMode="decimal"
                        value={fields.floor}
                        onChange={(e) => update('floor', e.target.value)}
                      />
                    </label>
                  </details>
                  {estimated && (
                    <label className="tl-check">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(e) => setReviewed(e.target.checked)}
                      />
                      <span>
                        I checked the interior and door measurements against the
                        actual space. Photo estimates are approximate.
                      </span>
                    </label>
                  )}
                  <label className="tl-check">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => {
                        setRemember(e.target.checked);
                        setPending(null);
                      }}
                    />
                    <span>Save this transport on this device</span>
                  </label>
                  {error && (
                    <p role="alert" className="tl-error">
                      {error}
                    </p>
                  )}
                  {pending ? (
                    <button
                      type="button"
                      className="primary tl-continue"
                      onClick={() => onSelect(pending)}
                    >
                      Continue without saving <ArrowRight size={18} />
                    </button>
                  ) : (
                    <button type="submit" className="primary tl-continue">
                      Open load planner <ArrowRight size={18} />
                    </button>
                  )}
                </fieldset>
                {(busy || preparing) && (
                  <output className="tl-progress">
                    <LoaderCircle size={18} className="animate-spin" />
                    {preparing
                      ? 'Preparing photo…'
                      : 'Checking scale and estimating the space…'}
                  </output>
                )}
              </form>
            </>
          )}
        </section>
      </main>
      <footer className="tl-footer">
        <Check size={15} /> Dimensions first. A better load next.
      </footer>
    </div>
  );
}

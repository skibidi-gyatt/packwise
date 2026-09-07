'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Backpack,
  ArrowUpRight,
  ArrowRight,
  RotateCcw,
  Download,
  Camera,
  Plus,
  SlidersHorizontal,
  Check,
  Box,
  Sparkles,
  Headphones,
  ShieldCheck,
  MoveUpRight,
  Layers,
  Play,
  Pause,
  ChevronRight,
  Weight,
  Info,
  LoaderCircle,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { freshDemo } from '@/lib/packing/demo';
import { defaultPreferences, volume } from '@/lib/packing/model';
import type { Item, Container, Plan, Preferences } from '@/lib/packing/model';
import {
  solve,
  evaluate,
  instruction,
  blockers,
  topLoads,
} from '@/lib/packing/solver';
import { offlineIntent, applyIntent } from '@/lib/packing/intent';
import { intentSchema } from '@/lib/astra/schemas';
import Scene from './Scene';
import { ItemEditor, BagEditor } from './Editors';
import PhotoInput from './PhotoInput';

const initial = freshDemo();
const initialPlan = solve(initial.items, initial.bag);
const initialBaseline = solve(initial.items, initial.bag, 'baseline');
const number = (n: number, d = 0) => n.toFixed(d);
const signed = (n: number, d = 0) => `${n > 0 ? '+' : ''}${n.toFixed(d)}`;

export default function Planner() {
  const [items, setItems] = useState<Item[]>(initial.items),
    [bag, setBag] = useState<Container>(initial.bag),
    [prefs, setPrefs] = useState<Preferences>(defaultPreferences);
  const [plan, setPlan] = useState<Plan>(initialPlan),
    [baseline, setBaseline] = useState<Plan>(initialBaseline),
    [view, setView] = useState('optimized');
  const [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<Item | null>(null),
    [editBag, setEditBag] = useState(false),
    [photos, setPhotos] = useState(false),
    [info, setInfo] = useState(false);
  const [exploded, setExploded] = useState(false),
    [step, setStep] = useState(24),
    [playing, setPlaying] = useState(false),
    [moved, setMoved] = useState<string[]>([]);
  const [prompt, setPrompt] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      'Sample kit loaded. Every box and metric below comes from the packing solver.',
    ),
    [error, setError] = useState('');
  const [api, setApi] = useState({ available: false, model: 'gpt-6-astra' }),
    [change, setChange] = useState<{
      access: number;
      moment: number;
      count: number;
    } | null>(null);
  const revision = useRef(0);
  const shown = view === 'baseline' ? baseline : plan;
  const selectedPlacement = shown.placements.find(
    (p) => p.item.id === selected,
  );
  const loads = useMemo(() => topLoads(shown.placements), [shown]);
  const pick = useCallback((id: string) => setSelected(id), []);
  useEffect(() => {
    fetch('/api/astra')
      .then((r) => r.json() as Promise<{ available?: boolean; model?: string }>)
      .then((data) =>
        setApi({
          available: data.available === true,
          model: typeof data.model === 'string' ? data.model : 'gpt-6-astra',
        }),
      )
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setStep((s) => {
          if (s >= shown.placements.length) {
            setPlaying(false);
            return s;
          }
          return s + 1;
        }),
      900,
    );
    return () => clearInterval(timer);
  }, [playing, shown.placements.length]);
  function recompute(
    nextItems: Item[],
    nextBag: Container,
    nextPrefs: Preferences = prefs,
    text = 'Properties updated. The plan and comparison have been recomputed.',
    intent = false,
  ) {
    try {
      const next = solve(nextItems, nextBag, 'optimized', nextPrefs),
        base = solve(nextItems, nextBag, 'baseline', nextPrefs);
      const movedIds = next.placements
        .filter((p) => {
          const old = plan.placements.find((q) => q.item.id === p.item.id);
          return (
            old &&
            [0, 1, 2].some(
              (k) =>
                Math.abs(old.pos[k] - p.pos[k]) > 0.01 ||
                Math.abs(old.dims[k] - p.dims[k]) > 0.01,
            )
          );
        })
        .map((p) => p.item.id);
      if (intent) {
        const oldWithNewTargets = plan.placements.map((p) => ({
          ...p,
          item: nextItems.find((i) => i.id === p.item.id) ?? p.item,
        }));
        const before = evaluate(
          oldWithNewTargets,
          plan.container,
          bag,
          nextPrefs,
        );
        setChange({
          access: next.metrics.access - before.access,
          moment: next.metrics.rearMoment - before.rearMoment,
          count: movedIds.length,
        });
      } else setChange(null);
      revision.current++;
      setItems(nextItems);
      setBag(nextBag);
      setPrefs(nextPrefs);
      setPlan(next);
      setBaseline(base);
      setView('optimized');
      setStep(24);
      setPlaying(false);
      setMoved(movedIds);
      setMessage(text);
      setError('');
      setEditing(null);
      setEditBag(false);
      setPhotos(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function request(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    const rev = revision.current;
    try {
      let patch;
      if (api.available) {
        const response = await fetch('/api/astra', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'interpret',
            text,
            items: items.map(({ id, name }) => ({ id, name })),
          }),
        });
        const body = (await response.json()) as {
          error?: string;
          result: unknown;
        };
        if (!response.ok)
          throw new Error(body.error || 'Astra request failed.');
        patch = intentSchema.parse(body.result);
      } else patch = offlineIntent(text, items);
      if (revision.current !== rev)
        throw new Error(
          'The kit changed while this request was being interpreted. Please send the request again.',
        );
      if (
        !patch.changes.length &&
        !patch.comfort &&
        !patch.protection &&
        !patch.reduceBulging
      ) {
        setMessage(patch.explanation);
        setChange(null);
        return;
      }
      const updated = applyIntent(patch, items, bag, prefs);
      recompute(
        updated.items,
        updated.bag,
        updated.prefs,
        `${api.available ? 'Astra' : 'Offline intent rule'}: ${patch.explanation}`,
        true,
      );
      setPrompt('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const reset = () => {
    const d = freshDemo();
    recompute(
      d.items,
      d.bag,
      defaultPreferences,
      'Weekend sample restored. These are sample measurements, not photo estimates.',
    );
    setMoved([]);
    setSelected(null);
    setExploded(false);
  };
  const exportPlan = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            schemaVersion: 1,
            units: { dimensions: 'cm', mass: 'kg' },
            assumptions:
              'Axis-aligned proxies, straight top insertion, static support, estimated protection. Not a safety certification.',
            items,
            container: bag,
            preferences: prefs,
            plan,
            baseline,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'packwise-plan.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const add = () => {
    if (items.length >= 24) {
      setError('This prototype supports up to 24 items.');
      return;
    }
    setEditing({
      id: `item-${Date.now()}`,
      name: 'New item',
      dims: [10, 10, 10],
      mass: 0.2,
      color: '#71a4ba',
      rigidity: 'rigid',
      minRatio: 1,
      fragile: false,
      orientation: 'any',
      access: 'normal',
      required: true,
      maxTopLoad: 0,
      source: 'manual',
      confidence: 1,
      notes: 'New item. Enter your measurements.',
    });
  };
  const packed = shown.placements.length;
  const metricsRows = [
    {
      label: 'Items packed',
      a: baseline.placements.length,
      b: plan.placements.length,
      suffix: ` / ${items.length}`,
      max: Math.max(1, items.length),
    },
    {
      label: 'Lateral balance',
      a: baseline.metrics.balance,
      b: plan.metrics.balance,
      suffix: ' / 100',
      max: 100,
    },
    {
      label: 'Retrieval access',
      a: baseline.metrics.access,
      b: plan.metrics.access,
      suffix: ' / 100',
      max: 100,
    },
    {
      label: 'Protection proxy',
      a: baseline.metrics.protection,
      b: plan.metrics.protection,
      suffix: ' / 100',
      max: 100,
    },
  ];
  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark">
            <Backpack size={22} />
          </span>
          packwise<span className="brand-sub">FIELD LAB / 01</span>
        </div>
        <div className="header-actions">
          <span className={`connection ${api.available ? 'live' : ''}`}>
            <i />
            {api.available ? 'Astra connected' : 'Offline demo'}
          </span>
          <button
            className="icon-button"
            title="How the model works"
            aria-label="How the model works"
            onClick={() => setInfo(true)}
          >
            <Info size={19} />
          </button>
          <button className="quiet-button export" onClick={exportPlan}>
            <Download size={16} /> Export plan
          </button>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">LESS GUESSWORK. MORE ROOM TO GO.</p>
            <h1>Everything has its place.</h1>
            <p className="subtitle">
              A smarter pack, built around your journey.
            </p>
          </div>
          <button className="quiet-button" onClick={reset}>
            <RotateCcw size={15} /> Reset weekend demo
          </button>
        </div>
        <div className="workspace">
          <aside className="inventory panel">
            <div className="section-heading">
              <p className="eyebrow">01 / YOUR KIT</p>
              <span className="small muted">{items.length} items</span>
            </div>
            <button className="bag-card" onClick={() => setEditBag(true)}>
              <span className="bag-icon">
                <Backpack size={32} strokeWidth={1.4} />
              </span>
              <span>
                <strong>{bag.name}</strong>
                <small>
                  {bag.dims.join(' × ')} cm ·{' '}
                  {number(volume(bag.dims) / 1000, 1)} L
                </small>
              </span>
              <SlidersHorizontal size={16} />
            </button>
            <div className="bag-limits">
              <span>
                <Weight size={13} />
                {bag.maxMass} kg limit
              </span>
              <button className="text-button" onClick={() => setEditBag(true)}>
                Bag settings <ChevronRight size={13} />
              </button>
            </div>
            <button className="upload-button" onClick={() => setPhotos(true)}>
              <Camera size={17} /> Start from photos <ArrowUpRight size={16} />
            </button>
            <div className="inventory-label">
              <h3>Your essentials</h3>
              <button
                className="icon-button"
                onClick={add}
                aria-label="Add item"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="item-list">
              {items.map((i) => {
                const isPacked = shown.placements.some(
                  (p) => p.item.id === i.id,
                );
                return (
                  <div
                    className={`item-row ${selected === i.id ? 'selected' : ''}`}
                    key={i.id}
                  >
                    <button
                      className="item-main"
                      onClick={() =>
                        setSelected(selected === i.id ? null : i.id)
                      }
                      aria-label={`Select ${i.name}`}
                      aria-pressed={selected === i.id}
                    >
                      <span
                        className="item-swatch"
                        style={{ background: i.color }}
                      >
                        <Box size={17} />
                      </span>
                      <span>
                        <strong>{i.name}</strong>
                        <small>
                          {i.dims.join(' × ')} cm <span>· {i.mass} kg</span>
                        </small>
                        <span className="item-tags">
                          {i.fragile && <em>Fragile</em>}
                          {i.access === 'immediate' && (
                            <em className="access-tag">Easy access</em>
                          )}
                          {i.rigidity === 'soft' && <em>Soft</em>}
                          {!isPacked && (
                            <em className="excluded">Not packed</em>
                          )}
                        </span>
                      </span>
                    </button>
                    <button
                      className="edit-item"
                      aria-label={`Edit ${i.name}`}
                      onClick={() => setEditing(i)}
                    >
                      <SlidersHorizontal size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            {!items.length && (
              <p className="empty-state">
                Your bag is empty. Add an item or reset the weekend demo.
              </p>
            )}
            <div className="inventory-footer">
              <span className="source-dot" />
              <span>
                {items.some((i) => i.source === 'astra_estimate')
                  ? 'Reviewed AI estimates'
                  : items.every((i) => i.source === 'sample')
                    ? 'Sample kit · editable measurements'
                    : 'User-reviewed kit'}
              </span>
            </div>
          </aside>
          <section className="stage-panel">
            <div className="stage-toolbar">
              <p className="eyebrow">02 / FIND THE FIT</p>
              <Tabs
                value={view}
                onValueChange={(v) => {
                  setView(String(v));
                  setStep(24);
                  setPlaying(false);
                }}
              >
                <TabsList>
                  <TabsTrigger value="baseline">First fit</TabsTrigger>
                  <TabsTrigger value="optimized">Optimized</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="stage-title">
              <h2>
                {view === 'baseline'
                  ? 'A place to start.'
                  : 'A place for every priority.'}
              </h2>
              <span
                className={`fit-tag ${packed === items.length ? '' : 'partial'}`}
              >
                {packed === items.length ? (
                  <Check size={13} />
                ) : (
                  <Box size={13} />
                )}{' '}
                {packed} of {items.length} fit
              </span>
            </div>
            <div className="scene-wrap">
              <Scene
                plan={shown}
                selected={selected}
                onSelect={pick}
                exploded={exploded}
                step={step}
                moved={moved}
              />
              <div className="scene-hint">
                DRAG TO ORBIT <span>·</span> SCROLL TO ZOOM
              </div>
              <button
                className={`explode-control ${exploded ? 'active' : ''}`}
                onClick={() => setExploded((v) => !v)}
                aria-pressed={exploded}
              >
                <Layers size={16} />
                {exploded ? 'Collapse' : 'Explode'}
              </button>
              {exploded && (
                <div className="exploded-note">
                  Exploded view · vertical gaps added for clarity
                </div>
              )}
              <div className="com-key">
                <i /> Centre of mass
              </div>
            </div>
            {selectedPlacement ? (
              <div className="selection-card">
                <span
                  className="selection-color"
                  style={{ background: selectedPlacement.item.color }}
                />
                <div>
                  <strong>{selectedPlacement.item.name}</strong>
                  <p>
                    {selectedPlacement.dims
                      .map((n) => number(n, 1))
                      .join(' × ')}{' '}
                    cm packed ·{' '}
                    {number(loads.get(selectedPlacement.item.id) ?? 0, 2)} kg
                    above ·{' '}
                    {blockers(selectedPlacement, shown.placements).length}{' '}
                    retrieval blockers
                  </p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setEditing(selectedPlacement.item)}
                >
                  Edit <ArrowUpRight size={14} />
                </button>
              </div>
            ) : (
              <div className="selection-card muted">
                <Box size={17} />
                <p>Select an item to inspect its placement.</p>
                <span className="proxy-note">Bounding-box model</span>
              </div>
            )}
            <div className="playback">
              <button
                className="play-button"
                aria-label={
                  playing ? 'Pause packing sequence' : 'Play packing sequence'
                }
                onClick={() => {
                  if (!playing) setStep(0);
                  setPlaying(!playing);
                }}
                disabled={!packed}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <div className="playback-control">
                <div>
                  <span>Packing sequence</span>
                  <span>
                    {Math.min(step, packed)} / {packed}
                  </span>
                </div>
                <Slider
                  value={[Math.min(step, packed)]}
                  min={0}
                  max={Math.max(1, packed)}
                  step={1}
                  aria-label="Packing sequence step"
                  onValueChange={(v) => {
                    setStep(Array.isArray(v) ? v[0] : v);
                    setPlaying(false);
                  }}
                />
              </div>
            </div>
          </section>
          <aside className="insights panel">
            <div className="section-heading">
              <p className="eyebrow">03 / THE DIFFERENCE</p>
              <MoveUpRight size={17} />
            </div>
            <div className="hero-metric">
              <strong>
                {number(shown.metrics.mass, 2)}
                <span> kg</span>
              </strong>
              <p>
                {packed} items packed · {number(shown.metrics.volume, 1)} L
                occupied
              </p>
            </div>
            <div className="volume-track">
              <span style={{ width: `${shown.metrics.utilization}%` }} />
            </div>
            <div className="volume-caption">
              <span>{number(shown.metrics.utilization)}% of envelope</span>
              <span>{number(volume(shown.container.dims) / 1000, 1)} L</span>
            </div>
            <div className="comparison-head">
              <span>Same kit & constraints</span>
              <span>First fit</span>
              <span>Optimized</span>
            </div>
            {metricsRows.map((r) => (
              <div className="comparison-row" key={r.label}>
                <div>
                  <span>{r.label}</span>
                  <strong>
                    {number(r.a)}
                    <small>{r.suffix}</small>
                  </strong>
                  <strong className="optimized-value">
                    {number(r.b)}
                    <small>{r.suffix}</small>
                  </strong>
                </div>
                <div className="dual-bars">
                  <span style={{ width: `${(r.a / r.max) * 100}%` }} />
                  <span style={{ width: `${(r.b / r.max) * 100}%` }} />
                </div>
              </div>
            ))}
            <div className="physical-facts">
              <div>
                <span>Rear moment proxy</span>
                <strong>{number(shown.metrics.rearMoment, 2)} Nm</strong>
              </div>
              <div>
                <span>Depth expansion</span>
                <strong>{number(shown.metrics.expansion)}%</strong>
              </div>
              <div>
                <span>Volume compressed</span>
                <strong>{number(shown.metrics.compression)}%</strong>
              </div>
            </div>
            <button className="model-note" onClick={() => setInfo(true)}>
              <Info size={15} />
              <span>
                Computed geometry. Approximate physics.
                <br />
                See assumptions and score definitions.
              </span>
            </button>
          </aside>
        </div>
        <section className="intent-panel">
          <div className="intent-heading">
            <span className="spark-icon">
              <Sparkles size={20} />
            </span>
            <div>
              <h2>Pack for the way you travel.</h2>
              <p>
                {api.available
                  ? 'Tell Astra what matters. The solver handles the rearranging.'
                  : 'Try a supported request. Offline rules translate it into solver constraints.'}
              </p>
            </div>
            <span className="intent-mode">
              {api.available ? api.model : 'OFFLINE INTENT RULES'}
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void request(prompt);
            }}
          >
            <input
              aria-label="Packing request"
              value={prompt}
              maxLength={1500}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="I need my headphones during the flight."
              disabled={busy}
            />
            <button
              className="primary"
              type="submit"
              disabled={busy || !prompt.trim()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Sparkles size={17} />
              )}
              <span>{busy ? 'Interpreting…' : 'Replan my bag'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
          <div className="suggestions">
            <button
              disabled={busy}
              onClick={() =>
                void request('I need my headphones during the flight.')
              }
            >
              <Headphones size={14} /> Headphones during the flight
            </button>
            <button
              disabled={busy}
              onClick={() => void request('Protect the camera more.')}
            >
              <ShieldCheck size={14} /> Protect my camera
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void request('Make the backpack more comfortable.')
              }
            >
              <Backpack size={14} /> Improve comfort
            </button>
            <button
              disabled={busy}
              onClick={() => void request('Reduce the bulging.')}
            >
              <Layers size={14} /> Reduce bulging
            </button>
          </div>
          <div className="reasoning" aria-live="polite">
            <span className="reason-mark">
              <Check size={15} />
            </span>
            <div>
              <p>{message}</p>
              {change && (
                <p className="change-summary">
                  {change.count} item(s) moved <span>·</span> Same-target access{' '}
                  {signed(change.access, 1)} points <span>·</span> Rear moment{' '}
                  {signed(change.moment, 2)} Nm
                </p>
              )}
            </div>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
        {shown.unpacked.length > 0 && (
          <section className="failure-panel">
            <h2>Let’s resolve what doesn’t fit.</h2>
            {shown.unpacked.map((u) => (
              <div key={u.item.id}>
                <strong>
                  {u.item.name} {u.item.required ? '· required' : '· optional'}
                </strong>
                <p>{u.reason}</p>
              </div>
            ))}
            <p className="small muted">
              A limited search can miss a feasible arrangement. These results
              are not a proof of impossibility unless a dimension, opening, or
              weight bound is exceeded.
            </p>
          </section>
        )}
        <section className="instructions">
          <div className="instructions-heading">
            <div>
              <p className="eyebrow">FROM PLAN TO PACK</p>
              <h2>One item at a time.</h2>
            </div>
            <span className="muted small">
              {view === 'baseline' ? 'First-fit' : 'Optimized'} insertion order
              · top opening
            </span>
          </div>
          <div className="steps-grid">
            {shown.placements.map((p) => (
              <button
                key={p.item.id}
                className={`step-card ${selected === p.item.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelected(p.item.id);
                  setStep(p.order);
                  setPlaying(false);
                }}
              >
                <span
                  className="step-number"
                  style={{ borderColor: p.item.color }}
                >
                  {String(p.order).padStart(2, '0')}
                </span>
                <div>
                  <h3>{p.item.name}</h3>
                  <p>{instruction(p, shown)}</p>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </section>
        <footer className="footer">
          <span>
            packwise <span> / </span> Make room for what matters.
          </span>
          <span>
            {plan.tried} candidate plans · reproducible search · cm / kg
          </span>
        </footer>
      </main>
      {editing && (
        <ItemEditor
          key={editing.id}
          item={editing}
          bag={bag}
          onClose={() => setEditing(null)}
          onSave={(i) =>
            recompute(
              items.some((x) => x.id === i.id)
                ? items.map((x) => (x.id === i.id ? i : x))
                : [...items, i],
              bag,
            )
          }
          onDelete={() =>
            recompute(
              items.filter((i) => i.id !== editing.id),
              bag,
            )
          }
        />
      )}
      {editBag && (
        <BagEditor
          bag={bag}
          onClose={() => setEditBag(false)}
          onSave={(b) => recompute(items, b)}
        />
      )}
      {photos && (
        <PhotoInput
          available={api.available}
          onClose={() => setPhotos(false)}
          onApply={(i, b) =>
            recompute(
              i,
              b,
              defaultPreferences,
              'Reviewed photo estimates loaded. You can correct every item and the bag settings.',
            )
          }
        />
      )}
      <Dialog open={info} onOpenChange={setInfo}>
        <DialogContent className="info-dialog">
          <DialogTitle>What this packing model knows.</DialogTitle>
          <DialogDescription>
            A practical planning aid with explicit assumptions.
          </DialogDescription>
          <div className="model-explainer">
            <h3>Hard checks</h3>
            <p>
              No overlapping boxes, no envelope or weight overflow. Every item
              passes a rectangular top opening in its packed orientation, has a
              clear vertical insertion path, and rests on at least 80% support
              area with its centre supported. Loads propagate down through
              contact surfaces.
            </p>
            <h3>What the scores mean</h3>
            <p>
              <b>Balance:</b> lateral centre-of-mass centering, 0–100.{' '}
              <b>Access:</b> overhead footprint blockers and distance from the
              opening; uses immediate-access items when requested, otherwise all
              packed items. <b>Protection:</b> fragile-item wall clearance and
              nearby soft material; a heuristic, not a damage probability. No
              fragile item means this check scores 100 as not applicable.
            </p>
            <p>
              <b>Rear moment:</b> sum of mass × distance from rear panel ×
              gravity, in Nm. Lower suggests weight is closer to your back; this
              is not an ergonomic assessment. <b>Volume:</b> occupied bounding
              boxes, after compression. Higher utilization does not always mean
              a better plan.
            </p>
            <h3>What is approximate</h3>
            <p>
              All objects are cuboid proxies. Soft items compress along one
              original dimension. The bag can expand in depth within your limit.
              No cloth simulation, complete protective wrapping, curved opening,
              strap forces, or tilting insertion is modeled. Upright and flat
              both preserve the original vertical dimension.
            </p>
            <h3>AI and your data</h3>
            <p>
              {api.available
                ? `Runtime ${api.model} is configured.`
                : 'Runtime Astra is not configured. The demo kit and intent rules work offline.'}{' '}
              Photos are sent to OpenAI for analysis only when requested and are
              not saved by this app. API responses use store:false. Review
              inferred dimensions, weights and load limits. A manual edit takes
              precedence.
            </p>
            <h3>Fair comparison</h3>
            <p>
              First-fit and multi-start search use the same checks, allowed
              compression, and expansion bounds. Missing required items outrank
              every soft score. The search includes first-fit candidates and
              never lowers that common objective. It is not an exact optimizer.
              All per-item quality metrics describe packed items; compare packed
              counts first.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

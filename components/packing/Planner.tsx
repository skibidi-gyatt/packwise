'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Truck,
  ArrowRight,
  ArrowUpRight,
  RotateCcw,
  Download,
  Camera,
  Plus,
  SlidersHorizontal,
  Check,
  Layers,
  Play,
  Pause,
  ChevronRight,
  Info,
  LoaderCircle,
  Search,
  Route,
  ShieldCheck,
  ScanLine,
  ArrowDownToLine,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Item, Container, Preferences } from '@/lib/packing/model';
import { defaultPreferences, volume } from '@/lib/packing/model';
import { freshCargo, stops } from '@/lib/packing/cargo-demo';
import {
  solve,
  instruction,
  unloadBlockers,
  topLoads,
  evaluate,
} from '@/lib/packing/solver';
import {
  cargoOfflineIntent,
  applyCargoIntent,
  cargoIntentSchema,
} from '@/lib/packing/cargo-intent';
import type { CargoIntent } from '@/lib/packing/cargo-intent';
import { mergePhotoCargo, manifestText } from '@/lib/packing/manifest';
import Scene from './Scene';
import { ItemEditor, BagEditor } from './Editors';
import PhotoInput from './PhotoInput';
import ManifestInput from './ManifestInput';
const seed = freshCargo(),
  seedBase = solve(seed.items, seed.bag, 'baseline'),
  seedPlan = solve(seed.items, seed.bag);
const fmt = (n: number, d = 0) =>
  n.toLocaleString('en-SG', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
const delta = (n: number, d = 1) => `${n > 0 ? '+' : ''}${fmt(n, d)}`;
type Change = {
  moved: number;
  utilization: number;
  access: number;
  beforeBlockers: number;
  afterBlockers: number;
  id?: string;
};
export default function Planner() {
  const [allMetrics, setAllMetrics] = useState(false);
  const [items, setItems] = useState(seed.items),
    [bag, setBag] = useState(seed.bag),
    [prefs, setPrefs] = useState<Preferences>({
      ...defaultPreferences,
      route: 1,
    });
  const [plan, setPlan] = useState(seedPlan),
    [baseline, setBaseline] = useState(seedBase),
    [view, setView] = useState('baseline');
  const [selected, setSelected] = useState<string | null>('P14'),
    [editing, setEditing] = useState<Item | null>(null),
    [assetOpen, setAssetOpen] = useState(false),
    [photoOpen, setPhotoOpen] = useState(false),
    [manifestOpen, setManifestOpen] = useState(false),
    [info, setInfo] = useState(false);
  const [exploded, setExploded] = useState(false),
    [step, setStep] = useState(30),
    [playing, setPlaying] = useState(false),
    [moved, setMoved] = useState<string[]>([]);
  const [search, setSearch] = useState(''),
    [stopFilter, setStopFilter] = useState('all'),
    [prompt, setPrompt] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [api, setApi] = useState({ available: false, model: 'gpt-6-astra' }),
    [patch, setPatch] = useState<CargoIntent | null>(null),
    [change, setChange] = useState<Change | null>(null);
  const [message, setMessage] = useState(
    'Synthetic dispatch manifest loaded. Compare the simple load with a geometry- and weight-aware plan.',
  );
  const revision = useRef(0),
    shown = view === 'baseline' ? baseline : plan;
  const pick = useCallback((id: string) => setSelected(id), []);
  const selectedUnit = items.find((i) => i.id === selected),
    placed = shown.placements.find((p) => p.item.id === selected);
  const loads = useMemo(() => topLoads(shown.placements), [shown]);
  const filtered = items.filter(
    (i) =>
      (stopFilter === 'all' || String(i.deliveryStop ?? 1) === stopFilter) &&
      `${i.id} ${i.name} ${i.destination}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  useEffect(() => {
    fetch('/api/astra')
      .then((r) => r.json() as Promise<{ available?: boolean; model?: string }>)
      .then((d) =>
        setApi({
          available: d.available === true,
          model: d.model ?? 'gpt-6-astra',
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
      800,
    );
    return () => clearInterval(timer);
  }, [playing, shown.placements.length]);
  function recompute(
    nextItems: Item[],
    nextBag: Container,
    nextPrefs = prefs,
    reason = 'Manifest updated. All placements and checks have been recomputed.',
    intent?: CargoIntent,
  ) {
    try {
      const next = solve(nextItems, nextBag, 'optimized', nextPrefs),
        base = solve(nextItems, nextBag, 'baseline', nextPrefs);
      const old = shown;
      const movedIds = next.placements
        .filter((p) => {
          const q = old.placements.find((q) => q.item.id === p.item.id);
          return (
            !q ||
            [0, 1, 2].some(
              (k) =>
                Math.abs(q.pos[k] - p.pos[k]) > 0.01 ||
                Math.abs(q.dims[k] - p.dims[k]) > 0.01,
            )
          );
        })
        .map((p) => p.item.id);
      const first = intent?.changes.find((c) => c.first)?.id;
      const oldUnit = old.placements.find((p) => p.item.id === first),
        newUnit = next.placements.find((p) => p.item.id === first);
      const oldTargets = old.placements.map((p) => ({
        ...p,
        item: nextItems.find((i) => i.id === p.item.id) ?? p.item,
      }));
      const before = evaluate(oldTargets, old.container, bag, nextPrefs);
      setChange({
        moved: movedIds.length,
        utilization: next.metrics.utilization - old.metrics.utilization,
        access: next.metrics.access - before.access,
        beforeBlockers: oldUnit
          ? unloadBlockers(oldUnit, old.placements).length
          : 0,
        afterBlockers: newUnit
          ? unloadBlockers(newUnit, next.placements).length
          : 0,
        id: first,
      });
      revision.current++;
      setItems(nextItems);
      setBag(nextBag);
      setPrefs(nextPrefs);
      setPlan(next);
      setBaseline(base);
      setView('optimized');
      setMoved(movedIds);
      setStep(30);
      setPlaying(false);
      setMessage(reason);
      setError('');
      setEditing(null);
      setAssetOpen(false);
      setPhotoOpen(false);
      setManifestOpen(false);
      if (first) setSelected(first);
      if (!intent) setPatch(null);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not calculate this load.',
      );
      return false;
    }
  }
  async function optimize() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 25));
    recompute(
      items,
      bag,
      prefs,
      'Optimization complete. Every KPI is calculated from the selected load; no business savings are assumed.',
    );
    setBusy(false);
  }
  async function request(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    const rev = revision.current;
    try {
      let proposal: CargoIntent;
      if (api.available) {
        const r = await fetch('/api/astra', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'cargo-intent',
            text,
            items: items.map(
              ({ id, name, deliveryStop, destination, stackable }) => ({
                id,
                name,
                deliveryStop,
                destination,
                stackable,
              }),
            ),
          }),
        });
        const body = (await r.json()) as { error?: string; result: unknown };
        if (!r.ok)
          throw new Error(
            body.error ?? 'Astra could not interpret this request.',
          );
        proposal = cargoIntentSchema.parse(body.result);
      } else proposal = cargoOfflineIntent(text, items);
      if (revision.current !== rev)
        throw new Error(
          'The manifest changed during interpretation. Please submit the request again.',
        );
      setPatch(proposal);
      if (!proposal.changes.length && !proposal.balance && !proposal.route) {
        setChange(null);
        setMessage(proposal.explanation);
        return;
      }
      const updated = applyCargoIntent(proposal, items, bag, prefs);
      recompute(
        updated.items,
        updated.bag,
        updated.prefs,
        proposal.explanation,
        proposal,
      );
      setPrompt('');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to interpret the request.',
      );
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    const d = freshCargo();
    recompute(
      d.items,
      d.bag,
      { ...defaultPreferences, route: 1 },
      'Synthetic manifest restored. Start with simple loading, then optimize.',
    );
    setView('baseline');
    setSelected('P14');
    setChange(null);
    setPatch(null);
    setMoved([]);
    setSearch('');
    setStopFilter('all');
    setExploded(false);
  }
  function download(name: string, data: unknown) {
    const blob = new Blob(
      [typeof data === 'string' ? data : JSON.stringify(data, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const synthetic =
    items.length > 0 && items.every((i) => i.source === 'sample');
  const routeStops = [...new Set(items.map((i) => i.deliveryStop ?? 1))]
    .sort((a, b) => a - b)
    .map((id) => ({
      id,
      color: stops[(id - 1) % stops.length].color,
      name: [
        ...new Set(
          items
            .filter((i) => (i.deliveryStop ?? 1) === id)
            .map((i) => i.destination ?? 'Unassigned'),
        ),
      ].join(' / '),
    }));
  const priorityIds = items
    .filter((i) => i.access === 'immediate')
    .map((i) => i.id);
  const totalM3 = volume(bag.dims) / 1e6;
  const kpis = [
    {
      label: 'Cubic utilization',
      value: fmt(shown.metrics.utilization, 1),
      unit: '%',
      detail: `${fmt(shown.metrics.volume / 1000, 2)} of ${fmt(totalM3, 2)} m³`,
      base: `Simple ${fmt(baseline.metrics.utilization, 1)}%`,
    },
    {
      label: 'Cargo loaded',
      value: String(shown.placements.length),
      unit: `/ ${items.length}`,
      detail: `${shown.unpacked.length} pending assignment`,
      base: `Simple ${baseline.placements.length} units`,
    },
    {
      label: 'Payload utilization',
      value: fmt(shown.metrics.payloadUtilization, 1),
      unit: '%',
      detail: `${fmt(shown.metrics.mass)} / ${fmt(bag.maxMass)} kg`,
      base: `Simple ${fmt(baseline.metrics.payloadUtilization, 1)}%`,
    },
    {
      label: priorityIds.length ? 'Priority access' : 'Delivery access',
      value: fmt(shown.metrics.access),
      unit: '/ 100',
      detail: priorityIds.length
        ? `${priorityIds.join(', ')} only · ${shown.metrics.rehandles} route blocker pairs overall`
        : `${shown.metrics.rehandles} later-stop blocker pairs`,
      base: `Simple ${fmt(baseline.metrics.access)}`,
    },
    {
      label: 'Unused volume',
      value: fmt(shown.metrics.unusedM3, 2),
      unit: 'm³',
      detail: 'Bounding-box free volume',
      base: `Simple ${fmt(baseline.metrics.unusedM3, 2)} m³`,
    },
  ];
  return (
    <div className="cargo-app">
      <header className="cargo-header">
        <a className="cargo-brand" href="#main">
          <Box size={25} />
          <strong>packwise</strong>
          <span>Cargo intelligence</span>
        </a>
        <div className="header-status">
          <span className="mode-label">
            <i />
            {api.available ? 'Astra configured' : 'Demo · runtime AI offline'}
          </span>
          <button
            className="icon-button"
            aria-label="Model assumptions"
            onClick={() => setInfo(true)}
          >
            <Info size={18} />
          </button>
          <button
            className="quiet-button"
            onClick={() =>
              download('packwise-load-plan.json', {
                schemaVersion: 2,
                units: {
                  dimensions: 'cm',
                  mass: 'kg',
                  occupiedVolume: 'litres',
                  unusedVolume: 'm3',
                },
                asset: bag,
                cargo: items,
                constraints: prefs,
                selected: view,
                plan,
                baseline,
                disclaimer:
                  'Decision support; not certified loading or securing approval.',
              })
            }
          >
            <Download size={16} />
            Export load plan
          </button>
        </div>
      </header>
      <main id="main">
        <div className="planning-heading">
          <div>
            <h1>
              Load planning{' '}
              <span>{synthetic ? 'SG-042' : 'Working manifest'}</span>
            </h1>
            <p>
              {items.length} cargo units · {routeStops.length} delivery{' '}
              {routeStops.length === 1 ? 'stop' : 'stops'} · One transport asset
            </p>
          </div>
          <div className="heading-actions">
            <button className="quiet-button" disabled={busy} onClick={reset}>
              <RotateCcw size={15} />
              Reset demo
            </button>
            <button
              className="primary"
              onClick={() => void optimize()}
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Layers size={17} />
              )}
              Optimize load
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
        <div className="route-line">
          <button onClick={() => setAssetOpen(true)} className="asset-link">
            <Truck size={19} />
            <strong>{bag.name}</strong>
            <span>{bag.dims.map((n) => fmt(n / 100, 1)).join(' × ')} m</span>
            <SlidersHorizontal size={15} />
          </button>
          <div className="route-stops">
            {routeStops.map((s) => (
              <span key={s.id}>
                <i style={{ background: s.color }} />
                {s.id}. {s.name}
                {s.id !== routeStops.at(-1)?.id && <ChevronRight size={13} />}
              </span>
            ))}
          </div>
          <span className="synthetic-note">
            {synthetic ? 'Synthetic dispatch scenario' : 'Operator manifest'}
          </span>
        </div>
        <section
          className={`kpi-strip ${allMetrics ? 'show-all-metrics' : ''}`}
          aria-label="Load performance"
        >
          {kpis.map((k) => (
            <div className="kpi" key={k.label}>
              <span>{k.label}</span>
              <strong>
                {k.value}
                <small>{k.unit}</small>
              </strong>
              <p>{k.detail}</p>
              <em>{k.base}</em>
            </div>
          ))}
        </section>
        <button
          className="mobile-metrics-toggle"
          aria-expanded={allMetrics}
          onClick={() => setAllMetrics((v) => !v)}
        >
          {allMetrics
            ? 'Show key metrics'
            : 'Show payload, access and unused volume'}
          <ChevronRight size={14} />
        </button>
        <div className="load-workspace">
          <section className="digital-twin">
            <div className="twin-toolbar">
              <div>
                <h2>Load digital twin</h2>
                <span>
                  {view === 'baseline' ? 'Simple loading' : 'Optimized load'} ·
                  rear-door insertion
                </span>
              </div>
              <Tabs
                value={view}
                onValueChange={(v) => {
                  setView(String(v));
                  setStep(30);
                  setPlaying(false);
                }}
              >
                <TabsList>
                  <TabsTrigger value="baseline">Simple</TabsTrigger>
                  <TabsTrigger value="optimized">Optimized</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="cargo-scene-wrap">
              <Scene
                plan={shown}
                selected={selected}
                onSelect={pick}
                exploded={exploded}
                step={step}
                moved={moved}
              />
              <div className="twin-controls">
                <button
                  aria-pressed={exploded}
                  onClick={() => setExploded((v) => !v)}
                >
                  <Layers size={15} />
                  {exploded ? 'Collapse layers' : 'Separate layers'}
                </button>
                <span>
                  {exploded
                    ? 'Exploded view; extra vertical spacing'
                    : 'Drag to rotate · scroll to zoom'}
                </span>
              </div>
              <div className="twin-legend">
                {routeStops.map((s) => (
                  <span key={s.id}>
                    <i style={{ background: s.color }} />
                    Stop {s.id}
                  </span>
                ))}
                <span>
                  <i className="com-dot" />
                  Centre of mass
                </span>
              </div>
            </div>
            <div className="twin-selection">
              <span className="selected-id">{selected ?? 'Select cargo'}</span>
              <div>
                <strong>{selectedUnit?.name ?? 'Inspect a shipment'}</strong>
                <p>
                  {placed
                    ? `${placed.dims.map((n) => fmt(n)).join(' × ')} cm · ${fmt(loads.get(placed.item.id) ?? 0)} kg on top · ${unloadBlockers(placed, shown.placements).length} extraction blockers`
                    : selectedUnit
                      ? 'Not loaded in this plan. See the pending-cargo explanation.'
                      : 'Choose cargo in the model or manifest.'}
                </p>
              </div>
              {selectedUnit && (
                <button
                  className="twin-edit"
                  onClick={() => setEditing(selectedUnit)}
                  aria-label={`Edit ${selectedUnit.id}`}
                >
                  <SlidersHorizontal size={16} />
                  Edit
                </button>
              )}
            </div>
            <div className="sequence-control">
              <button
                className="play-button"
                disabled={!shown.placements.length}
                aria-label={
                  playing ? 'Pause loading sequence' : 'Play loading sequence'
                }
                onClick={() => {
                  if (!playing) setStep(0);
                  setPlaying(!playing);
                }}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <span>Load sequence</span>
              <Slider
                aria-label="Loading step"
                min={0}
                max={Math.max(1, shown.placements.length)}
                step={1}
                value={[Math.min(step, shown.placements.length)]}
                onValueChange={(v) => {
                  setStep(Array.isArray(v) ? v[0] : v);
                  setPlaying(false);
                }}
              />
              <span>
                {Math.min(step, shown.placements.length)} /{' '}
                {shown.placements.length}
              </span>
            </div>
          </section>
          <aside className="operations-panel">
            <div className="ops-heading">
              <ScanLine size={20} />
              <h2>Cargo intelligence</h2>
            </div>
            <p className="intelligence-source">
              Manifest facts + deterministic checks
            </p>
            <div className="semantic-list">
              {(selectedUnit
                ? [
                    selectedUnit,
                    ...items
                      .filter(
                        (i) =>
                          i.id !== selectedUnit.id &&
                          (i.fragile || i.mass >= 650),
                      )
                      .slice(0, 2),
                  ]
                : items.slice(0, 3)
              ).map((i) => (
                <button onClick={() => setSelected(i.id)} key={i.id}>
                  <span className="cargo-code">{i.id}</span>
                  <div>
                    <strong>{i.name}</strong>
                    <p>
                      {i.mustUnloadFirst
                        ? 'First to unload · clear rear path required'
                        : i.stackable === false
                          ? `No top loading${i.orientation === 'upright' ? ' · keep upright' : i.orientation === 'flat' ? ' · keep flat' : ''}`
                          : i.mass >= 650
                            ? `${fmt(i.mass)} kg · floor loading checked`
                            : `Stop ${i.deliveryStop ?? 1} · top-load limit ${fmt(i.maxTopLoad)} kg`}
                    </p>
                    <small>
                      {i.source === 'astra_estimate'
                        ? 'AI inferred · review required'
                        : i.source === 'sample'
                          ? i.provenance?.handling === 'manual'
                            ? 'Sample dimensions · operator rule'
                            : 'Synthetic manifest fact'
                          : `${i.source} provided`}
                    </small>
                  </div>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
            <div className="balance-panel">
              <h3>Payload distribution</h3>
              <div className="balance-labels">
                <span>
                  Front half <b>{fmt(shown.metrics.frontMass)} kg</b>
                </span>
                <span>
                  Rear half <b>{fmt(shown.metrics.rearMass)} kg</b>
                </span>
              </div>
              <div className="mass-bar">
                <span
                  style={{
                    width: `${shown.metrics.mass ? (shown.metrics.frontMass / shown.metrics.mass) * 100 : 0}%`,
                  }}
                />
              </div>
              <dl>
                <div>
                  <dt>Lateral balance</dt>
                  <dd>{fmt(shown.metrics.balance)} / 100</dd>
                </div>
                <div>
                  <dt>COM from bulkhead</dt>
                  <dd>{fmt(shown.metrics.com[2] / 100, 2)} m</dd>
                </div>
                <div>
                  <dt>Peak footprint load</dt>
                  <dd>{fmt(shown.metrics.floorPeakKgM2)} kg/m²</dd>
                </div>
              </dl>
              <p>Front/rear cargo mass, not axle loads.</p>
            </div>
            <div className="constraints-summary">
              <ShieldCheck size={18} />
              <div>
                <strong>
                  {shown.unpacked.length
                    ? 'Feasible partial load'
                    : 'Geometry checks satisfied'}
                </strong>
                <p>Payload · door path · support · top load</p>
                <button onClick={() => setInfo(true)}>
                  Review model assumptions
                  <ArrowUpRight size={13} />
                </button>
              </div>
            </div>
          </aside>
        </div>
        <section className="copilot-panel">
          <div className="copilot-title">
            <Route size={22} />
            <div>
              <h2>Change the operation. Recalculate the load.</h2>
              <p>
                {api.available
                  ? 'Astra turns operator intent into explicit constraints.'
                  : 'Offline demo rules · connect Astra for open-ended cargo reasoning.'}
              </p>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void request(prompt);
            }}
          >
            <input
              aria-label="Operator request"
              value={prompt}
              maxLength={1500}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Shipment P14 must be unloaded first."
              disabled={busy}
            />
            <button
              className="primary"
              disabled={busy || !prompt.trim()}
              type="submit"
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <ArrowRight size={17} />
              )}
              Replan
            </button>
          </form>
          <div className="request-suggestions">
            <button
              disabled={busy}
              onClick={() =>
                void request('Shipment P14 must be unloaded first.')
              }
            >
              <ArrowDownToLine size={14} />
              P14 unloads first
            </button>
            <button
              disabled={busy}
              onClick={() => void request('Do not stack anything on C08.')}
            >
              <ShieldCheck size={14} />
              No stacking on C08
            </button>
            <button
              disabled={busy}
              onClick={() => void request('Prioritize balance')}
            >
              <Truck size={14} />
              Prioritize balance
            </button>
            <button
              disabled={busy}
              onClick={() => void request('Respect delivery stops')}
            >
              <Route size={14} />
              Respect delivery stops
            </button>
          </div>
          {patch && (
            <div className="constraint-patch">
              <strong>
                {api.available
                  ? 'Astra interpreted'
                  : 'Offline rule interpreted'}
              </strong>
              {patch.changes.map((c) => (
                <span key={c.id}>
                  {c.id}
                  {c.first ? ' → FIRST UNLOAD' : ''}
                  {c.stop ? ` · STOP ${c.stop}` : ''}
                  {c.noStack ? ' · NO TOP LOAD' : ''}
                  {c.remove ? ' · REMOVE' : ''}
                </span>
              ))}
              {patch.balance && <span>BALANCE PRIORITY → HIGH</span>}
              {patch.route && <span>DELIVERY ORDER → HIGH</span>}
              <ArrowRight size={15} />
              <span>Deterministic solver</span>
            </div>
          )}
          <div className="result-explanation" aria-live="polite">
            <Check size={17} />
            <div>
              <p>{message}</p>
              {change && (
                <strong>
                  {change.id
                    ? `${change.id} extraction blockers: ${change.beforeBlockers} → ${change.afterBlockers}. `
                    : ''}
                  {change.moved} cargo units moved. Cubic utilization{' '}
                  {delta(change.utilization)} pp; same-target access{' '}
                  {delta(change.access)} points.
                </strong>
              )}
            </div>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="manifest-section">
          <div className="manifest-heading">
            <div>
              <h2>
                Cargo manifest <span>{items.length} units</span>
              </h2>
              <p>
                Measurements and company handling rules take precedence over AI
                estimates.
              </p>
            </div>
            <div>
              <button
                className="quiet-button"
                onClick={() => setPhotoOpen(true)}
              >
                <Camera size={16} />
                Analyze photos
              </button>
              <button
                className="quiet-button"
                onClick={() => setManifestOpen(true)}
              >
                <Download size={16} />
                Import manifest
              </button>
              <button
                className="quiet-button"
                onClick={() => {
                  if (items.length >= 30) {
                    setError('The prototype supports at most 30 cargo units.');
                    return;
                  }
                  setEditing({
                    id: `N${Date.now().toString().slice(-6)}`,
                    name: 'New cargo',
                    dims: [120, 100, 100],
                    mass: 300,
                    color: stops[0].color,
                    rigidity: 'rigid',
                    minRatio: 1,
                    fragile: false,
                    orientation: 'upright',
                    access: 'normal',
                    required: true,
                    maxTopLoad: 0,
                    stackable: false,
                    deliveryStop: 1,
                    destination: stops[0].name,
                    source: 'manual',
                    confidence: 1,
                    notes:
                      'Enter verified external dimensions and handling limits.',
                  });
                }}
              >
                <Plus size={16} />
                Add cargo
              </button>
            </div>
          </div>
          <div className="manifest-filter">
            <label>
              <Search size={16} />
              <input
                aria-label="Search cargo"
                placeholder="Search ID, cargo or destination"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Tabs
              value={stopFilter}
              onValueChange={(v) => setStopFilter(String(v))}
            >
              <TabsList>
                <TabsTrigger value="all">All stops</TabsTrigger>
                {routeStops.map((s) => (
                  <TabsTrigger key={s.id} value={String(s.id)}>
                    Stop {s.id}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <button
              className="text-button"
              onClick={() =>
                download('cargo-manifest.json', manifestText(items))
              }
            >
              Download JSON
            </button>
          </div>
          <Table className="cargo-table">
            <TableHeader>
              <TableRow>
                <TableHead>Cargo ID / description</TableHead>
                <TableHead>W × H × L · cm</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Stacking</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Edit cargo</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const loaded = shown.placements.find((p) => p.item.id === i.id);
                return (
                  <TableRow key={i.id} data-selected={selected === i.id}>
                    <TableCell>
                      <button
                        className="manifest-select"
                        onClick={() => setSelected(i.id)}
                      >
                        <span
                          style={{
                            background:
                              stops[((i.deliveryStop ?? 1) - 1) % 3].color,
                          }}
                        />
                        <strong>{i.id}</strong>
                        <span>{i.name}</span>
                      </button>
                    </TableCell>
                    <TableCell>{i.dims.join(' × ')}</TableCell>
                    <TableCell>{fmt(i.mass)} kg</TableCell>
                    <TableCell>
                      <b>Stop {i.deliveryStop ?? 1}</b>
                      <small>{i.destination}</small>
                    </TableCell>
                    <TableCell>
                      {i.stackable === false ? (
                        <span className="no-stack">No top loading</span>
                      ) : (
                        `${fmt(i.maxTopLoad)} kg max`
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`load-status ${loaded ? 'loaded' : 'pending'}`}
                      >
                        {loaded ? <Check size={12} /> : <Box size={12} />}{' '}
                        {loaded ? `Loaded · ${loaded.order}` : 'Pending'}
                      </span>
                      {i.mustUnloadFirst && (
                        <small className="first-note">First unload</small>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        className="icon-button"
                        aria-label={`Edit cargo ${i.id}`}
                        onClick={() => setEditing(i)}
                      >
                        <SlidersHorizontal size={16} />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!filtered.length && (
            <p className="empty-state">
              {items.length
                ? 'No cargo matches these filters. Clear the search or choose All stops.'
                : 'No cargo units. Import a manifest, add cargo, or reset the demo.'}
            </p>
          )}
        </section>
        {shown.unpacked.length > 0 && (
          <section className="pending-section">
            <h2>{shown.unpacked.length} cargo units need assignment</h2>
            {shown.unpacked.map((u) => (
              <div key={u.item.id}>
                <strong>
                  {u.item.id} · {u.item.name}
                </strong>
                <p>{u.reason}</p>
                <button
                  className="text-button"
                  onClick={() => setEditing(u.item)}
                >
                  Review cargo
                  <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </section>
        )}
        <section className="loading-instructions">
          <div>
            <h2>Loading sequence</h2>
            <span>Rear-door insertion · {shown.placements.length} steps</span>
          </div>
          <ol>
            {shown.placements.map((p) => (
              <li key={p.item.id}>
                <button
                  onClick={() => {
                    setSelected(p.item.id);
                    setStep(p.order);
                    setPlaying(false);
                    document
                      .getElementById('main')
                      ?.scrollIntoView({ behavior: 'auto' });
                  }}
                >
                  <span>{String(p.order).padStart(2, '0')}</span>
                  <strong>{p.item.id}</strong>
                  <p>{instruction(p, shown)}</p>
                  <ChevronRight size={15} />
                </button>
              </li>
            ))}
          </ol>
        </section>
        <footer>
          <span>Packwise Cargo · Operational decision support</span>
          <span>
            {plan.tried} reproducible candidate plans · No certified loading
            approval
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
      {assetOpen && (
        <BagEditor
          bag={bag}
          onClose={() => setAssetOpen(false)}
          onSave={(b) => recompute(items, b)}
        />
      )}
      {manifestOpen && (
        <ManifestInput
          items={items}
          onClose={() => setManifestOpen(false)}
          onApply={(i) =>
            recompute(
              i,
              bag,
              { ...defaultPreferences, route: 1 },
              'Company manifest imported. Quantities expanded; supplied measurements are authoritative.',
            )
          }
        />
      )}
      {photoOpen && (
        <PhotoInput
          asset={bag}
          available={api.available}
          onClose={() => setPhotoOpen(false)}
          onApply={(i) =>
            recompute(
              mergePhotoCargo(items, i),
              bag,
              prefs,
              'Reviewed AI cargo added. Existing manifest IDs and asset measurements were preserved.',
            )
          }
        />
      )}
      <Dialog open={info} onOpenChange={setInfo}>
        <DialogContent className="info-dialog">
          <DialogTitle>Load model and constraints</DialogTitle>
          <DialogDescription>
            Transparent prototype assumptions. Geometry is calculated;
            operational approval remains with your team.
          </DialogDescription>
          <div className="model-explainer">
            <h3>Hard constraints</h3>
            <p>
              Rigid rear-door asset; centred, floor-aligned rectangular opening.
              Cargo follows a straight horizontal insertion corridor at its
              packed height. Boxes cannot intersect or exceed the payload, door,
              or asset dimensions. A raised box needs at least 80% contact area
              and a supported projected centre. Top loads propagate through
              supports. Non-stackable units carry no load above. Floor loading
              divides supported mass by the full footprint.
            </p>
            <h3>First to unload</h3>
            <p>
              A first-unload unit must have no cargo in its rear extraction
              corridor and no cargo above its footprint. Forklift, pallet-jack,
              strap, turning and lifting clearance are not simulated. Loading
              playback illustrates sequence; rearrangement animation is not a
              certified motion path.
            </p>
            <h3>Metrics</h3>
            <p>
              Cubic and payload utilization are occupied bounding volume and
              packed mass divided by capacity. Delivery access averages 100/(1 +
              later-stop blockers), or all extraction blockers for priority
              units. Rehandling is a count of later-stop blocker pairs, not
              measured labour time. Balance is normalized COM distance from the
              lateral/longitudinal midline. Front/rear figures are cargo mass in
              each half, not axle loads.
            </p>
            <h3>Fair comparison</h3>
            <p>
              Both algorithms use identical constraints. Multi-start search
              includes the baseline. Required-unit count takes priority,
              followed by total units, occupied volume and soft quality. A
              bounded heuristic can miss a feasible plan. No claim about
              vehicles avoided follows from a partial first-fit result.
            </p>
            <h3>Astra and data authority</h3>
            <p>
              {api.available
                ? 'Runtime Astra is configured; API requests can still fail.'
                : 'The runtime API is offline. The sample manifest and advertised intent rules work without a key.'}{' '}
              Astra interprets cargo photos and operator language. Its patches
              never invent coordinates or KPI improvements. Photo estimates are
              reviewed; existing company IDs and asset measurements cannot be
              overwritten by photo import. Images are only sent on Analyze, not
              stored by this app, and Responses uses store:false.
            </p>
            <h3>Scope</h3>
            <p>
              This synthetic 20-unit truck scenario demonstrates an extensible
              cargo + asset + constraints model. Aircraft contours, vessel
              stability, axle limits, securing, dangerous-goods rules, legal
              compliance and fleet optimization are not implemented.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

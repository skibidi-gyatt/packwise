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
import { saveTextFile } from '@/lib/packing/files';
import { readPhoneDraft, phoneDraftKey } from '@/lib/packing/phone-draft';
import CargoForm from './CargoForm';
import TransportPicker from './TransportPicker';
import GuidedLoading from './GuidedLoading';
import { cargoCheck, checkCargoList, newCargo } from '@/lib/packing/readiness';
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
export default function Planner({
  phoneMode = false,
  initialTransport,
}: {
  phoneMode?: boolean;
  initialTransport?: Container;
}) {
  const [saved] = useState(() => (phoneMode ? readPhoneDraft() : null));
  const [saveError, setSaveError] = useState('');
  const [phase, setPhase] = useState<'cargo' | 'plan' | 'load'>(
    saved?.phase ?? 'cargo',
  );
  const [loadingIndex, setLoadingIndex] = useState(saved?.loadingIndex ?? 0);
  const [loadingCompleted, setLoadingCompleted] = useState(
    saved?.loadingCompleted ?? 0,
  );
  const [advanced, setAdvanced] = useState(false),
    [expertEdit, setExpertEdit] = useState(false),
    [pickerOpen, setPickerOpen] = useState(false),
    [hasPlan, setHasPlan] = useState(saved?.hasPlan ?? false),
    [onlyChecks, setOnlyChecks] = useState(false);
  const [allMetrics, setAllMetrics] = useState(false);
  const [items, setItems] = useState(saved?.items ?? seed.items),
    [bag, setBag] = useState(saved?.bag ?? initialTransport ?? seed.bag),
    [prefs, setPrefs] = useState<Preferences>(
      saved?.prefs ?? {
        ...defaultPreferences,
        route: 1,
      },
    );
  const [plan, setPlan] = useState(
      () =>
        saved?.plan ??
        (initialTransport ? solve(seed.items, initialTransport) : seedPlan),
    ),
    [baseline, setBaseline] = useState(
      () =>
        saved?.baseline ??
        (initialTransport
          ? solve(seed.items, initialTransport, 'baseline')
          : seedBase),
    ),
    [view, setView] = useState<'baseline' | 'optimized'>(
      saved?.view ?? 'baseline',
    );
  const [selected, setSelected] = useState<string | null>(null),
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
    'Your load is ready. Select cargo in the model to see its details.',
  );
  const revision = useRef(0),
    shown = view === 'baseline' ? baseline : plan;
  const pick = useCallback((id: string) => setSelected(id), []);
  const selectedUnit = items.find((i) => i.id === selected),
    placed = shown.placements.find((p) => p.item.id === selected);
  const loads = useMemo(() => topLoads(shown.placements), [shown]);
  const filtered = items.filter(
    (i) =>
      (!onlyChecks || cargoCheck(i).status !== 'ready') &&
      (stopFilter === 'all' || String(i.deliveryStop ?? 1) === stopFilter) &&
      `${i.id} ${i.name} ${i.destination}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  useEffect(() => {
    if (phoneMode) return;
    fetch('/api/astra')
      .then((r) => r.json() as Promise<{ available?: boolean; model?: string }>)
      .then((d) =>
        setApi({
          available: d.available === true,
          model: d.model ?? 'gpt-6-astra',
        }),
      )
      .catch(() => {});
  }, [phoneMode]);
  useEffect(() => {
    if (!phoneMode) return;
    try {
      localStorage.setItem(
        phoneDraftKey,
        JSON.stringify({
          version: 1,
          items,
          bag,
          prefs,
          phase,
          view,
          hasPlan,
          loadingIndex,
          loadingCompleted,
        }),
      );
    } catch {
      queueMicrotask(() =>
        setSaveError(
          'This device could not save your latest progress. Export the manifest before closing.',
        ),
      );
    }
  }, [
    phoneMode,
    items,
    bag,
    prefs,
    phase,
    view,
    hasPlan,
    loadingIndex,
    loadingCompleted,
  ]);
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
  function acceptCargo(nextItems: Item[], nextBag = bag) {
    checkCargoList(nextItems);
    setLoadingIndex(0);
    setLoadingCompleted(0);
    revision.current++;
    setItems(nextItems);
    setSelected((id) => (nextItems.some((i) => i.id === id) ? id : null));
    setBag(nextBag);
    setPhase('cargo');
    setHasPlan(false);
    setEditing(null);
    setExpertEdit(false);
    setAssetOpen(false);
    setPhotoOpen(false);
    setManifestOpen(false);
    setPickerOpen(false);
    setError('');
    setChange(null);
    setPatch(null);
    setPlaying(false);
    return true;
  }
  const checks = items.filter((i) => cargoCheck(i).status !== 'ready');
  function recompute(
    nextItems: Item[],
    nextBag: Container,
    nextPrefs = prefs,
    reason = 'Manifest updated. All placements and checks have been recomputed.',
    intent?: CargoIntent,
  ) {
    try {
      checkCargoList(nextItems);
      if (nextItems.some((i) => cargoCheck(i).status !== 'ready'))
        throw new Error(
          'Check the highlighted cargo measurements before optimizing.',
        );
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
      setLoadingIndex(0);
      setLoadingCompleted(0);
      setPhase('plan');
      setHasPlan(true);
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
      'Load plan ready. Review any cargo left out, then start loading.',
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
    setSelected(null);
    setChange(null);
    setPatch(null);
    setMoved([]);
    setSearch('');
    setStopFilter('all');
    setExploded(false);
    setPhase('cargo');
    setHasPlan(false);
    setOnlyChecks(false);
  }
  function download(name: string, data: unknown) {
    void saveTextFile(
      name,
      typeof data === 'string' ? data : JSON.stringify(data, null, 2),
    ).catch((e) =>
      setError(e instanceof Error ? e.message : 'Could not export this file.'),
    );
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
  const priorityExample =
    items.find((i) => i.id === 'P14')?.id ?? items[0]?.id ?? 'cargo ID';
  const stackExample =
    items.find((i) => i.id === 'C08')?.id ?? items[0]?.id ?? 'cargo ID';
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
      label: 'Cargo in this plan',
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
    <div
      className={`cargo-app ${advanced ? 'expert-mode' : 'operator-mode'} phase-${phase}`}
    >
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
            disabled={!hasPlan}
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
        {phoneMode && (
          <p className={`phone-save-note ${saveError ? 'error' : ''}`}>
            {saveError || 'Saved on this device · offline planning'}
          </p>
        )}
        {phase === 'load' ? (
          <GuidedLoading
            plan={shown}
            index={loadingIndex}
            setIndex={setLoadingIndex}
            completed={loadingCompleted}
            setCompleted={setLoadingCompleted}
            onExit={() => setPhase('plan')}
          />
        ) : (
          <>
            <nav className="workflow" aria-label="Load planning steps">
              <button onClick={() => setPickerOpen(true)}>
                1 <span>Select transport</span>
              </button>
              <button
                aria-current={phase === 'cargo' ? 'step' : undefined}
                onClick={() => {
                  setPhase('cargo');
                  setOnlyChecks(false);
                }}
              >
                2 <span>Add cargo</span>
              </button>
              <button
                onClick={() => {
                  setPhase('cargo');
                  setOnlyChecks(true);
                }}
              >
                3 <span>Check{checks.length ? ` (${checks.length})` : ''}</span>
              </button>
              <button
                disabled={!hasPlan}
                aria-current={phase === 'plan' ? 'step' : undefined}
                onClick={() => setPhase('plan')}
              >
                4 <span>Load plan</span>
              </button>
            </nav>
            <div className="planning-heading">
              <div>
                <h1>
                  {phase === 'cargo' ? 'Prepare your load' : 'Your load plan'}{' '}
                  <span>{synthetic ? 'SG-042' : 'Working manifest'}</span>
                </h1>
                <p>
                  {items.length} cargo units · {routeStops.length} delivery{' '}
                  {routeStops.length === 1 ? 'stop' : 'stops'} · One transport
                  asset
                </p>
              </div>
              <div className="heading-actions">
                <button
                  className="quiet-button"
                  disabled={busy}
                  onClick={reset}
                >
                  <RotateCcw size={15} />
                  Reset demo
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    phase === 'plan' ? setPhase('load') : void optimize()
                  }
                  disabled={
                    busy ||
                    (phase === 'cargo'
                      ? !items.length || checks.length > 0
                      : !shown.placements.length)
                  }
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Layers size={17} />
                  )}
                  {phase === 'plan'
                    ? loadingIndex > 0
                      ? `Resume loading · ${loadingCompleted}/${shown.placements.length}`
                      : 'Start loading'
                    : 'Optimize load'}
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
            <div className="route-line">
              <button
                onClick={() => setPickerOpen(true)}
                className="asset-link"
              >
                <Truck size={19} />
                <strong>{bag.name}</strong>
                <span>
                  {bag.dims.map((n) => fmt(n / 100, 1)).join(' × ')} m
                </span>
                <SlidersHorizontal size={15} />
              </button>
              <div className="route-stops">
                {routeStops.map((s) => (
                  <span key={s.id}>
                    <i style={{ background: s.color }} />
                    {s.id}. {s.name}
                    {s.id !== routeStops.at(-1)?.id && (
                      <ChevronRight size={13} />
                    )}
                  </span>
                ))}
              </div>
              <span className="synthetic-note">
                {bag.measurementSource === 'demo_estimate'
                  ? 'Demo dimensions · approximate'
                  : synthetic
                    ? 'Synthetic dispatch scenario'
                    : 'Operator manifest'}
              </span>
            </div>
            {phase === 'plan' && loadingCompleted > 0 && (
              <p className="notice">
                {loadingCompleted} units marked loaded
                {phoneMode ? ' and saved on this device' : ' on this open page'}
                . Replanning or changing cargo starts a new checklist.
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {phase === 'cargo' &&
              items.reduce(
                (s, i) => s + (Number.isFinite(i.mass) ? i.mass : 0),
                0,
              ) > bag.maxMass && (
                <p className="notice">
                  This manifest is heavier than the transport capacity.
                  Optimization will leave some cargo out; review those units
                  before loading.
                </p>
              )}
            {phase === 'cargo' && (
              <section className="readiness-summary">
                <div>
                  <h2>
                    {checks.length
                      ? `${checks.length} cargo ${checks.length === 1 ? 'unit needs' : 'units need'} a check`
                      : 'Ready when you are'}
                  </h2>
                  <p>
                    {items.length
                      ? 'Add your cargo, check any missing measurements, then optimize.'
                      : 'Scan cargo, import a manifest or add a unit below.'}
                  </p>
                </div>
                <button
                  className="quiet-button"
                  onClick={() => setOnlyChecks((v) => !v)}
                >
                  {onlyChecks
                    ? 'Show all cargo'
                    : `${items.length - checks.length} ready · ${checks.length} to check`}
                </button>
                {synthetic && (
                  <button
                    className="text-button"
                    onClick={() => acceptCargo([])}
                  >
                    Start with an empty manifest
                  </button>
                )}
              </section>
            )}
            {phase === 'plan' && (
              <>
                <section
                  className={`kpi-strip ${allMetrics ? 'show-all-metrics' : ''}`}
                  aria-label="Load performance"
                >
                  {kpis
                    .filter((_, idx) => advanced || idx < 3)
                    .map((k) => (
                      <div className="kpi" key={k.label}>
                        <span>{k.label}</span>
                        <strong>
                          {k.value}
                          <small>{k.unit}</small>
                        </strong>
                        <p>{k.detail}</p>
                        {advanced && <em>{k.base}</em>}
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
                {!advanced && (
                  <p className="balance-note">
                    Weight balance:{' '}
                    {shown.metrics.balance >= 75
                      ? 'Mostly centred'
                      : shown.metrics.balance >= 50
                        ? 'Uneven — review placement'
                        : 'Concentrated to one side — review placement'}{' '}
                    · {shown.unpacked.length} units not loaded.{' '}
                    <button
                      className="text-button"
                      onClick={() => setAdvanced(true)}
                    >
                      See details
                    </button>
                  </p>
                )}
                <div className="load-workspace">
                  <section className="digital-twin">
                    <div className="twin-toolbar">
                      <div>
                        <h2>3D load plan</h2>
                        <span>
                          {view === 'baseline'
                            ? 'Simple loading'
                            : 'Optimized load'}{' '}
                          · rear-door insertion
                        </span>
                      </div>
                      <Tabs
                        value={view}
                        onValueChange={(v) => {
                          setView(v === 'baseline' ? 'baseline' : 'optimized');
                          setLoadingIndex(0);
                          setLoadingCompleted(0);
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
                        showEngineering={advanced}
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
                      <span className="selected-id">
                        {selected ?? 'Select cargo'}
                      </span>
                      <div>
                        <strong>
                          {selectedUnit?.name ?? 'Inspect a shipment'}
                        </strong>
                        <p>
                          {placed
                            ? advanced
                              ? `${placed.dims.map((n) => fmt(n)).join(' × ')} cm · ${fmt(loads.get(placed.item.id) ?? 0)} kg on top · ${unloadBlockers(placed, shown.placements).length} extraction blockers`
                              : `${fmt(placed.item.mass)} kg · ${placed.item.stackable === false ? 'Keep the top clear' : 'Stack within the supplied limit'} · ${placed.item.orientation === 'any' ? 'May be turned' : 'Keep this side up'}`
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
                          playing
                            ? 'Pause loading sequence'
                            : 'Play loading sequence'
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
                      <h2>Need to change the load?</h2>
                      <p>
                        {api.available
                          ? 'Tell Astra what needs to change, using cargo IDs or descriptions.'
                          : 'Offline assistant · use a cargo ID and one of the examples below.'}
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
                      placeholder={`${priorityExample} must be unloaded first.`}
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
                        void request(
                          `${priorityExample} must be unloaded first.`,
                        )
                      }
                    >
                      <ArrowDownToLine size={14} />
                      {priorityExample} unloads first
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void request(
                          `Do not stack anything on ${stackExample}.`,
                        )
                      }
                    >
                      <ShieldCheck size={14} />
                      No stacking on {stackExample}
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
                  {advanced && patch && (
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
                      {advanced && change && (
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
              </>
            )}
            {(phase === 'cargo' || advanced) && (
              <section className="manifest-section">
                <div className="manifest-heading">
                  <div>
                    <h2>
                      Cargo manifest <span>{items.length} units</span>
                    </h2>
                    <p>
                      Measurements and company handling rules take precedence
                      over AI estimates.
                    </p>
                  </div>
                  <div>
                    <button
                      className="quiet-button"
                      onClick={() => setPhotoOpen(true)}
                    >
                      <Camera size={16} />
                      Scan cargo
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
                          setError(
                            'The prototype supports at most 30 cargo units.',
                          );
                          return;
                        }
                        setExpertEdit(false);
                        setEditing(
                          newCargo(`N${Date.now().toString().slice(-6)}`),
                        );
                      }}
                    >
                      <Plus size={16} />
                      Add manually
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
                    {advanced ? 'Download JSON' : 'Export manifest'}
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
                      const loaded = shown.placements.find(
                        (p) => p.item.id === i.id,
                      );
                      return (
                        <TableRow key={i.id} data-selected={selected === i.id}>
                          <TableCell>
                            <button
                              className="manifest-select"
                              onClick={() =>
                                phase === 'cargo'
                                  ? setEditing(i)
                                  : setSelected(i.id)
                              }
                            >
                              <span
                                style={{
                                  background:
                                    stops[((i.deliveryStop ?? 1) - 1) % 3]
                                      .color,
                                }}
                              />
                              <strong>{i.id}</strong>
                              <span>{i.name}</span>
                            </button>
                          </TableCell>
                          <TableCell>
                            {i.dims.map((n) => n || '—').join(' × ')}
                          </TableCell>
                          <TableCell>
                            {i.mass ? `${fmt(i.mass)} kg` : 'Required'}
                          </TableCell>
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
                            {phase === 'cargo' ? (
                              <button
                                className={`cargo-check ${cargoCheck(i).status}`}
                                onClick={() => setEditing(i)}
                              >
                                {cargoCheck(i).label}
                              </button>
                            ) : (
                              <span
                                className={`load-status ${loaded ? 'loaded' : 'pending'}`}
                              >
                                {loaded ? (
                                  <Check size={12} />
                                ) : (
                                  <Box size={12} />
                                )}{' '}
                                {loaded
                                  ? `Planned · ${loaded.order}`
                                  : 'Not loaded'}
                              </span>
                            )}
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
            )}
            {phase === 'plan' && shown.unpacked.length > 0 && (
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
            {phase === 'plan' && advanced && (
              <section className="loading-instructions">
                <div>
                  <h2>Loading sequence</h2>
                  <span>
                    Rear-door insertion · {shown.placements.length} steps
                  </span>
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
            )}
            <div className="advanced-toggle">
              <button
                className="quiet-button"
                aria-expanded={advanced}
                onClick={() => setAdvanced((v) => !v)}
              >
                <SlidersHorizontal size={16} />
                {advanced ? 'Hide advanced settings' : 'Advanced settings'}
              </button>
              {advanced && (
                <button
                  className="quiet-button"
                  onClick={() => setAssetOpen(true)}
                >
                  Transport load limits
                </button>
              )}
            </div>
          </>
        )}
        <footer>
          <span>Packwise Cargo · Operational decision support</span>
          <span>
            {advanced ? `${plan.tried} candidate plans · ` : ''}Check lifting,
            securing and vehicle limits before dispatch
          </span>
        </footer>
      </main>
      {pickerOpen && (
        <TransportPicker
          current={bag}
          onClose={() => setPickerOpen(false)}
          onSelect={(b) => acceptCargo(items, b)}
        />
      )}
      {editing && !expertEdit && (
        <CargoForm
          item={editing}
          items={items}
          onClose={() => setEditing(null)}
          onSave={acceptCargo}
          onDelete={() => acceptCargo(items.filter((i) => i.id !== editing.id))}
          onAdvanced={() => setExpertEdit(true)}
        />
      )}
      {editing && expertEdit && (
        <ItemEditor
          key={editing.id}
          item={editing}
          bag={bag}
          onClose={() => setEditing(null)}
          onSave={(i) =>
            acceptCargo(
              items.some((x) => x.id === i.id)
                ? items.map((x) => (x.id === i.id ? i : x))
                : [...items, i],
              bag,
            )
          }
          onDelete={() =>
            acceptCargo(
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
          onSave={(b) => acceptCargo(items, b)}
        />
      )}
      {manifestOpen && (
        <ManifestInput
          items={items}
          onClose={() => setManifestOpen(false)}
          onApply={acceptCargo}
        />
      )}
      {photoOpen && (
        <PhotoInput
          asset={bag}
          available={api.available}
          onClose={() => setPhotoOpen(false)}
          items={items}
          onApply={(i) => acceptCargo(mergePhotoCargo(items, i))}
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

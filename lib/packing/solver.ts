import { defaultPreferences, validateModel, volume } from './model';
import type {
  Container,
  Item,
  Metrics,
  Placement,
  Plan,
  Preferences,
  Vec3,
} from './model';
const EPS = 1e-5;
const clamp = (x: number) => Math.max(0, Math.min(100, x));
const end = (p: Placement, a: number) => p.pos[a] + p.dims[a];
export const overlaps = (a: Placement, b: Placement) =>
  [0, 1, 2].every(
    (k) => a.pos[k] < end(b, k) - EPS && end(a, k) > b.pos[k] + EPS,
  );
export function contactArea(a: Placement, b: Placement) {
  return (
    Math.max(0, Math.min(end(a, 0), end(b, 0)) - Math.max(a.pos[0], b.pos[0])) *
    Math.max(0, Math.min(end(a, 2), end(b, 2)) - Math.max(a.pos[2], b.pos[2]))
  );
}
export const blockers = (p: Placement, ps: Placement[]) =>
  ps.filter(
    (q) =>
      q.item.id !== p.item.id &&
      q.pos[1] >= end(p, 1) - EPS &&
      contactArea(p, q) > EPS,
  );
export function rearBlockers(p: Placement, ps: Placement[]) {
  return ps.filter(
    (q) =>
      q.item.id !== p.item.id &&
      q.pos[2] >= end(p, 2) - EPS &&
      [0, 1].every(
        (k) => p.pos[k] < end(q, k) - EPS && end(p, k) > q.pos[k] + EPS,
      ),
  );
}
export function unloadBlockers(p: Placement, ps: Placement[]) {
  return [
    ...new Map(
      [...rearBlockers(p, ps), ...blockers(p, ps)].map((q) => [q.item.id, q]),
    ).values(),
  ];
}
export function doorFits(d: Vec3, bag: Container) {
  return (
    d[0] <= bag.opening[0] + EPS &&
    d[bag.loading === 'rear' ? 1 : 2] <= bag.opening[1] + EPS
  );
}
export function rotations(
  i: Item,
): { dims: Vec3; axes: Vec3; ratio: number }[] {
  const permutations: Vec3[] =
    i.orientation === 'any'
      ? [
          [0, 1, 2],
          [2, 1, 0],
          [0, 2, 1],
          [1, 2, 0],
          [1, 0, 2],
          [2, 0, 1],
        ]
      : [
          [0, 1, 2],
          [2, 1, 0],
        ];
  const ratios =
    i.rigidity === 'soft' && i.minRatio < 1
      ? [1, (1 + i.minRatio) / 2, i.minRatio]
      : [1];
  const seen = new Set<string>();
  return ratios
    .flatMap((ratio) =>
      permutations.map((axes) => {
        // Compress original height only, then rotate the resulting proxy.
        const d: Vec3 = [i.dims[0], i.dims[1] * ratio, i.dims[2]];
        return { dims: axes.map((k) => d[k]) as Vec3, axes, ratio };
      }),
    )
    .filter((v) => {
      const key = v.dims.join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
export function topLoads(ps: Placement[]) {
  const loads = new Map(ps.map((p) => [p.item.id, 0]));
  for (const p of [...ps].sort((a, b) => b.pos[1] - a.pos[1])) {
    const supports = ps.filter(
      (q) =>
        q.item.id !== p.item.id &&
        Math.abs(end(q, 1) - p.pos[1]) < EPS &&
        contactArea(p, q) > EPS,
    );
    const area = supports.reduce((s, q) => s + contactArea(p, q), 0);
    for (const q of supports)
      loads.set(
        q.item.id,
        loads.get(q.item.id)! +
          ((p.item.mass + loads.get(p.item.id)!) * contactArea(p, q)) / area,
      );
  }
  return loads;
}
export function validPlacement(
  p: Placement,
  ps: Placement[],
  bag: Container,
): boolean {
  if (ps.some((q) => q.item.id === p.item.id)) return false;
  if ([0, 1, 2].some((k) => p.pos[k] < -EPS || end(p, k) > bag.dims[k] + EPS))
    return false;
  if (!doorFits(p.dims, bag)) return false;
  if (
    ps.some((q) => overlaps(p, q)) ||
    (bag.loading === 'rear' ? rearBlockers(p, ps) : blockers(p, ps)).length
  )
    return false;
  if (bag.loading === 'rear') {
    const margin = (bag.dims[0] - bag.opening[0]) / 2;
    if (
      p.pos[0] < margin - EPS ||
      end(p, 0) > bag.dims[0] - margin + EPS ||
      end(p, 1) > bag.opening[1] + EPS
    )
      return false;
    const all = [...ps, p];
    if (
      all.some((q) => q.item.mustUnloadFirst && unloadBlockers(q, all).length)
    )
      return false;
  }
  if (p.pos[1] > EPS) {
    const supports = ps.filter(
      (q) => Math.abs(end(q, 1) - p.pos[1]) < EPS && contactArea(p, q) > EPS,
    );
    const area = supports.reduce((s, q) => s + contactArea(p, q), 0);
    if (area / (p.dims[0] * p.dims[2]) < 0.8 - EPS) return false;
    const cx = p.pos[0] + p.dims[0] / 2,
      cz = p.pos[2] + p.dims[2] / 2;
    if (
      !supports.some(
        (q) =>
          cx >= q.pos[0] - EPS &&
          cx <= end(q, 0) + EPS &&
          cz >= q.pos[2] - EPS &&
          cz <= end(q, 2) + EPS,
      )
    )
      return false;
  }
  const all = [...ps, p],
    loads = topLoads(all);
  return all.every(
    (q) =>
      loads.get(q.item.id)! <=
        (q.item.stackable === false ? 0 : q.item.maxTopLoad) + EPS &&
      (bag.floorLimitKgM2 === undefined ||
        q.pos[1] > EPS ||
        (loads.get(q.item.id)! + q.item.mass) /
          ((q.dims[0] * q.dims[2]) / 10000) <=
          bag.floorLimitKgM2 + EPS),
  );
}
export function evaluate(
  ps: Placement[],
  bag: Container,
  nominal: Container,
  prefs: Preferences = defaultPreferences,
): Metrics {
  const mass = ps.reduce((s, p) => s + p.item.mass, 0),
    v = ps.reduce((s, p) => s + volume(p.dims), 0);
  const com = [0, 1, 2].map((k) =>
    mass
      ? ps.reduce((s, p) => s + p.item.mass * (p.pos[k] + p.dims[k] / 2), 0) /
        mass
      : 0,
  ) as Vec3;
  const loads = topLoads(ps);
  const frontMass = ps.reduce(
    (s, p) =>
      s +
      (p.item.mass *
        Math.max(0, Math.min(end(p, 2), bag.dims[2] / 2) - p.pos[2])) /
        p.dims[2],
    0,
  );
  const rearMass = mass - frontMass;
  const longitudinalBalance = mass
    ? clamp(100 * (1 - (2 * Math.abs(com[2] - bag.dims[2] / 2)) / bag.dims[2]))
    : 0;
  const floorPeakKgM2 = Math.max(
    0,
    ...ps
      .filter((p) => p.pos[1] < EPS)
      .map(
        (p) =>
          (p.item.mass + loads.get(p.item.id)!) /
          ((p.dims[0] * p.dims[2]) / 10000),
      ),
  );
  // Count later-stop blockers, not units legitimately removed earlier in the route.
  const rehandles =
    bag.loading === 'rear'
      ? ps.reduce(
          (s, p) =>
            s +
            unloadBlockers(p, ps).filter(
              (q) => (q.item.deliveryStop ?? 1) > (p.item.deliveryStop ?? 1),
            ).length,
          0,
        )
      : 0;
  const balance = mass
    ? clamp(100 * (1 - (2 * Math.abs(com[0] - bag.dims[0] / 2)) / bag.dims[0]))
    : 0;
  const requested = ps.filter((p) => p.item.access === 'immediate');
  const targets = requested.length ? requested : ps;
  const access = targets.length
    ? targets.reduce(
        (s, p) =>
          s +
          (100 /
            (1 +
              (bag.loading === 'rear'
                ? unloadBlockers(p, ps).filter(
                    (q) =>
                      p.item.access === 'immediate' ||
                      (q.item.deliveryStop ?? 1) > (p.item.deliveryStop ?? 1),
                  )
                : blockers(p, ps)
              ).length)) *
            (bag.loading === 'rear'
              ? 1
              : 0.65 + (0.35 * end(p, 1)) / bag.dims[1]),
        0,
      ) / targets.length
    : 0;
  const fragile = ps.filter((p) => p.item.fragile);
  const protection = fragile.length
    ? fragile.reduce((s, p) => {
        const clearance = Math.min(
          p.pos[0],
          bag.dims[0] - end(p, 0),
          p.pos[2],
          bag.dims[2] - end(p, 2),
        );
        const soft = ps.some(
          (q) =>
            q.item.rigidity === 'soft' &&
            [0, 1, 2].every(
              (k) =>
                Math.max(p.pos[k] - end(q, k), q.pos[k] - end(p, k), 0) <= 2,
            ),
        );
        return s + Math.min(35, clearance * 7) + 35 + (soft ? 30 : 0);
      }, 0) / fragile.length
    : 100;
  const original = ps.reduce((s, p) => s + volume(p.item.dims), 0);
  const compression = original ? 100 * (1 - v / original) : 0,
    expansion = 100 * (bag.dims[2] / nominal.dims[2] - 1);
  const rear = mass ? 100 * (1 - com[2] / bag.dims[2]) : 0;
  let quality =
    (prefs.comfort * (balance * 0.4 + rear * 0.6) +
      prefs.access * access +
      prefs.protection * protection) /
      (prefs.comfort + prefs.access + prefs.protection) -
    compression * 0.25 -
    expansion * 0.65;
  if (bag.loading === 'rear')
    quality =
      (prefs.comfort * (balance * 0.4 + longitudinalBalance * 0.6) +
        prefs.access * access) /
        (prefs.comfort + prefs.access) -
      rehandles * (prefs.route ?? 1) * 2 -
      (com[1] / bag.dims[1]) * 8;
  return {
    mass,
    volume: v / 1000,
    utilization: (100 * v) / volume(bag.dims),
    com,
    balance,
    rearMoment: (mass * com[2] * 9.81) / 100,
    access,
    protection,
    compression,
    expansion,
    quality,
    payloadUtilization: (mass / bag.maxMass) * 100,
    unusedM3: (volume(bag.dims) - v) / 1e6,
    frontMass,
    rearMass,
    longitudinalBalance,
    rehandles,
    floorPeakKgM2,
  };
}
function points(ps: Placement[], bag: Container, d: Vec3): Vec3[] {
  const axis = (k: number) =>
    [
      ...new Set(
        [
          0,
          ...(bag.loading === 'rear' && k === 0
            ? [
                (bag.dims[0] - bag.opening[0]) / 2,
                (bag.dims[0] + bag.opening[0]) / 2 - d[k],
              ]
            : []),
          bag.dims[k] - d[k],
          ...ps.flatMap((p) => [p.pos[k], end(p, k), p.pos[k] - d[k]]),
        ]
          .filter((x) => x >= -EPS && x + d[k] <= bag.dims[k] + EPS)
          .map((x) => Math.max(0, x)),
      ),
    ].sort((a, b) => a - b);
  const xs = axis(0),
    zs = axis(2),
    ys = [...new Set([0, ...ps.map((p) => end(p, 1))])].sort((a, b) => a - b);
  return ys.flatMap((y) => zs.flatMap((z) => xs.map((x) => [x, y, z] as Vec3)));
}
function placeScore(
  p: Placement,
  ps: Placement[],
  bag: Container,
  prefs: Preferences,
) {
  if (bag.loading === 'rear') {
    const cx = p.pos[0] + p.dims[0] / 2,
      cz = p.pos[2] + p.dims[2] / 2;
    let score = (p.pos[2] / bag.dims[2]) * 35 + (p.pos[1] / bag.dims[1]) * 18;
    score +=
      prefs.comfort *
      (((Math.abs(cx - bag.dims[0] / 2) / bag.dims[0]) * p.item.mass) / 100 +
        ((Math.abs(cz - bag.dims[2] / 2) / bag.dims[2]) * p.item.mass) / 250);
    if (p.item.mustUnloadFirst || p.item.access === 'immediate')
      score -= (cz / bag.dims[2]) * 90;
    if ((prefs.route ?? 1) > 1)
      score +=
        Math.abs(cz / bag.dims[2] - (1 - (p.item.deliveryStop ?? 2) / 4)) *
        (prefs.route ?? 1) *
        12;
    return score;
  }
  const x = p.pos[0] + p.dims[0] / 2,
    z = p.pos[2] + p.dims[2] / 2;
  const heavy = p.item.mass;
  let cost =
    p.pos[1] * 0.45 +
    prefs.comfort *
      (z * heavy * 2 + Math.abs(x - bag.dims[0] / 2) * heavy * 0.5) +
    (1 - p.ratio) * 18;
  // High-access items are ordered late; prefer a high placement only when supported.
  if (p.item.access === 'immediate') cost -= prefs.access * end(p, 1) * 1.5;
  if (p.item.fragile) {
    cost -=
      prefs.protection *
      Math.min(
        p.pos[0],
        bag.dims[0] - end(p, 0),
        p.pos[2],
        bag.dims[2] - end(p, 2),
      ) *
      2;
    if (
      ps.some(
        (q) =>
          q.item.rigidity === 'soft' &&
          Math.abs(end(q, 1) - p.pos[1]) < EPS &&
          contactArea(p, q) > 0,
      )
    )
      cost -= prefs.protection * 12;
  }
  return cost;
}
function failure(i: Item, bag: Container, mass: number): string {
  if (mass + i.mass > bag.maxMass + EPS)
    return `Weight limit: ${i.mass.toFixed(2)} kg would exceed ${bag.maxMass} kg. Remove an item or raise a verified limit.`;
  const rs = rotations(i);
  if (!rs.some((r) => doorFits(r.dims, bag)))
    return 'Opening too small for an allowed orientation. Verify the door measurement or assign a larger transport asset.';
  if (!rs.some((r) => r.dims.every((x, k) => x <= bag.dims[k] + EPS)))
    return 'Dimensions exceed the allowed envelope. Reduce a soft item or use a larger container.';
  return bag.loading === 'rear'
    ? 'No feasible placement found with the current door path, support, stacking and unloading constraints. Review dimensions or assign this unit to a later load. This is a bounded search, not proof of impossibility.'
    : 'No supported, load-safe insertion found in this search. Try fewer items, verify dimensions, or allow more depth expansion.';
}
function run(
  order: Item[],
  bag: Container,
  nominal: Container,
  mode: Plan['mode'],
  prefs: Preferences,
): Plan {
  const ps: Placement[] = [],
    unpacked: Plan['unpacked'] = [];
  let mass = 0;
  for (const item of order) {
    let best: Placement | undefined,
      bestCost = Infinity;
    if (mass + item.mass <= bag.maxMass + EPS) {
      outer: for (const r of rotations(item)) {
        if (!doorFits(r.dims, bag)) continue;
        const candidates = points(ps, bag, r.dims);
        if (bag.loading === 'rear' && mode === 'optimized')
          candidates.sort(
            (a, b) =>
              placeScore({ item, pos: a, ...r, order: 0 }, ps, bag, prefs) -
              placeScore({ item, pos: b, ...r, order: 0 }, ps, bag, prefs),
          );
        for (const pos of candidates) {
          const p: Placement = { item, pos, ...r, order: ps.length + 1 };
          if (!validPlacement(p, ps, bag)) continue;
          if (mode === 'baseline') {
            best = p;
            break outer;
          }
          const cost = placeScore(p, ps, bag, prefs);
          if (cost < bestCost) {
            bestCost = cost;
            best = p;
          }
          if (bag.loading === 'rear') break;
        }
      }
    }
    if (best) {
      ps.push(best);
      mass += item.mass;
    } else unpacked.push({ item, reason: failure(item, bag, mass) });
  }
  return {
    placements: ps,
    unpacked,
    container: bag,
    metrics: evaluate(ps, bag, nominal, prefs),
    tried: 1,
    mode,
    complete: !unpacked.some((u) => u.item.required),
  };
}
export function objective(p: Plan) {
  return (
    p.placements.filter((x) => x.item.required).length *
      (p.container.loading === 'rear' ? 1e9 : 1e6) +
    p.placements.length * (p.container.loading === 'rear' ? 1e6 : 1e4) +
    (p.container.loading === 'rear'
      ? p.metrics.utilization * 100 + p.metrics.quality * 3
      : p.metrics.quality)
  );
}
export function solve(
  items: Item[],
  nominal: Container,
  mode: Plan['mode'] = 'optimized',
  prefs: Preferences = defaultPreferences,
): Plan {
  const errors = validateModel(items, nominal);
  if (errors.length) throw new Error(errors.join(' '));
  const factors = [...new Set([0, nominal.expansion / 2, nominal.expansion])];
  let best: Plan | undefined,
    tried = 0,
    seed = 179;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Include baseline in the search so optimization never regresses the common objective.
  for (const factor of factors) {
    const bag = {
      ...nominal,
      dims: [
        nominal.dims[0],
        nominal.dims[1],
        nominal.dims[2] * (1 + factor),
      ] as Vec3,
    };
    // The measured opening does not automatically expand with the envelope.
    const baseline = run(items, bag, nominal, 'baseline', prefs);
    tried++;
    if (!best || objective(baseline) > objective(best)) best = baseline;
    if (mode === 'baseline') continue;
    for (let n = 0; n < (nominal.loading === 'rear' ? 22 : 14); n++) {
      const ranked = items.map((i) => ({ i, r: random() }));
      const order = ranked
        .sort((a, b) => {
          if (Boolean(a.i.mustUnloadFirst) !== Boolean(b.i.mustUnloadFirst))
            return a.i.mustUnloadFirst ? 1 : -1;
          if (a.i.required !== b.i.required) return a.i.required ? -1 : 1;
          if (a.i.access !== b.i.access)
            return a.i.access === 'immediate' ? 1 : -1;
          if (n === 0) return volume(b.i.dims) - volume(a.i.dims);
          if (n === 1) return b.i.mass - a.i.mass;
          if (n === 2)
            return (
              Number(a.i.fragile) - Number(b.i.fragile) ||
              b.i.dims[1] - a.i.dims[1]
            );
          if (n === 3 && nominal.loading === 'rear')
            return (
              (b.i.deliveryStop ?? 1) - (a.i.deliveryStop ?? 1) ||
              volume(b.i.dims) - volume(a.i.dims)
            );
          return a.r - b.r;
        })
        .map((x) => x.i);
      const candidate = run(order, bag, nominal, 'optimized', prefs);
      tried++;
      if (objective(candidate) > objective(best)) best = candidate;
    }
  }
  return { ...best!, mode, tried };
}
export function instruction(p: Placement, plan: Plan): string {
  if (plan.container.loading === 'rear') {
    const zone =
      end(p, 2) > plan.container.dims[2] * 0.75
        ? 'near the rear doors'
        : p.pos[2] < plan.container.dims[2] * 0.3
          ? 'toward the bulkhead'
          : 'in the central bay';
    const supports = plan.placements.filter(
      (q) =>
        q.item.id !== p.item.id &&
        Math.abs(end(q, 1) - p.pos[1]) < EPS &&
        contactArea(p, q) > EPS,
    );
    return `Load ${p.item.id} ${zone}, ${p.pos[1] < EPS ? 'on the floor' : `on ${supports.map((q) => q.item.id).join(' + ')}`}. ${p.item.orientation !== 'any' ? 'Keep upright. ' : ''}${p.item.stackable === false ? 'No cargo above. ' : ''}Stop ${p.item.deliveryStop ?? 1}: ${p.item.destination ?? 'delivery'}.${p.item.mustUnloadFirst ? ' First to unload; clear extraction path required.' : ''}`;
  }
  const [w, h, d] = plan.container.dims;
  const zone =
    p.pos[1] < 1
      ? 'on the bottom'
      : end(p, 1) > h * 0.72
        ? 'in the upper layer'
        : 'in the middle layer';
  const side =
    p.pos[2] < 2
      ? 'against the back panel'
      : p.pos[2] + p.dims[2] / 2 > d * 0.65
        ? 'toward the front'
        : 'near the centre';
  const lateral =
    p.pos[0] + p.dims[0] / 2 < w * 0.3
      ? ' on the left'
      : p.pos[0] + p.dims[0] / 2 > w * 0.7
        ? ' on the right'
        : '';
  return `Place ${p.item.name.toLowerCase()} ${zone}, ${side}${lateral}.${p.item.orientation === 'upright' ? ' Keep upright.' : ''}${p.ratio < 1 ? ` Compress to about ${Math.round(p.ratio * 100)}% of its original volume.` : ''}${p.item.fragile ? ' Keep weight off this item.' : ''}${p.item.access === 'immediate' ? ` ${blockers(p, plan.placements).length} item(s) sit above its footprint.` : ''}`;
}

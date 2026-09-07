import { z } from 'zod';
import type { Item, Container, Preferences } from './model';
export const cargoIntentSchema = z.object({
  explanation: z.string().max(1400),
  changes: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        first: z.boolean().nullable(),
        stop: z.number().int().min(1).max(20).nullable(),
        noStack: z.boolean().nullable(),
        upright: z.boolean().nullable().default(null),
        remove: z.boolean(),
      }),
    )
    .max(30),
  balance: z.boolean(),
  route: z.boolean(),
});
export type CargoIntent = z.infer<typeof cargoIntentSchema>;
export function cargoOfflineIntent(text: string, items: Item[]): CargoIntent {
  const t = text.trim(),
    matched = items.filter((i) =>
      new RegExp(
        `\\b${i.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i',
      ).test(t),
    );
  const p: CargoIntent = {
    explanation: '',
    changes: [],
    balance: false,
    route: false,
  };
  if (/^(prioritize|improve) balance[.!]?$/i.test(t)) {
    p.balance = true;
    p.explanation = 'Spread the cargo weight more evenly across the truck.';
    return p;
  }
  if (
    /^(respect delivery stops|reduce rehandling|prioritize delivery order)[.!]?$/i.test(
      t,
    )
  ) {
    p.route = true;
    p.explanation = 'Make earlier deliveries easier to reach.';
    return p;
  }
  if (matched.length !== 1)
    throw new Error(
      'Name one cargo ID, for example “P14 must be unloaded first”, or use a suggestion below.',
    );
  const id = matched[0].id;
  if (
    /^(keep .+ upright|do not turn .+ sideways|don't turn .+ sideways)[.!]?$/i.test(
      t,
    )
  ) {
    p.changes = [
      {
        id,
        first: null,
        stop: null,
        noStack: null,
        upright: true,
        remove: false,
      },
    ];
    p.explanation = `${id}: keep this side up when loading.`;
    return p;
  }
  if (
    /\b(no|not|never|except)\b/i.test(t) &&
    !/^do not stack anything on /i.test(t) &&
    !/^no stacking on /i.test(t)
  )
    throw new Error(
      'This request needs live Astra or a manual constraint edit. Offline mode does not infer exceptions.',
    );
  if (/\b(unload(?:ed)? first|first to unload)\b/i.test(t)) {
    p.changes = [
      {
        id,
        first: true,
        stop: null,
        noStack: true,
        upright: null,
        remove: false,
      },
    ];
    p.explanation = `${id}: keep the path to the rear doors clear and put nothing on top, so it can come out first.`;
  } else if (
    /^do not stack anything on /i.test(t) ||
    /^no stacking on /i.test(t)
  ) {
    p.changes = [
      {
        id,
        first: null,
        stop: null,
        noStack: true,
        upright: null,
        remove: false,
      },
    ];
    p.explanation = `${id}: put nothing on top.`;
  } else if (/^remove /i.test(t)) {
    p.changes = [
      {
        id,
        first: null,
        stop: null,
        noStack: null,
        upright: null,
        remove: true,
      },
    ];
    p.explanation = `Remove ${id} from this load and recompute the remaining manifest.`;
  } else
    throw new Error(
      'Offline rules support first-unload, no-stack, remove, balance and delivery-order requests. Use the cargo editor for other constraints.',
    );
  return p;
}
export function applyCargoIntent(
  p: CargoIntent,
  items: Item[],
  bag: Container,
  prefs: Preferences,
) {
  const patch = cargoIntentSchema.parse(p);
  const ids = new Set(items.map((i) => i.id));
  if (
    patch.changes.some((c) => !ids.has(c.id)) ||
    new Set(patch.changes.map((c) => c.id)).size !== patch.changes.length
  )
    throw new Error(
      'Astra proposed an unknown or duplicate cargo ID. No changes applied.',
    );
  if (patch.changes.filter((c) => c.first).length > 1)
    throw new Error('Only one unit may be first to unload.');
  const first = patch.changes.some((c) => c.first);
  const next = items.flatMap<Item>((i) => {
    const c = patch.changes.find((c) => c.id === i.id);
    const base = first
      ? { ...i, mustUnloadFirst: false, access: 'normal' as const }
      : i;
    if (!c) return [base];
    if (c.remove) return [];
    return [
      {
        ...base,
        deliveryStop: c.stop ?? i.deliveryStop,
        provenance: {
          ...i.provenance,
          dims: i.provenance?.dims ?? 'manual',
          mass: i.provenance?.mass ?? 'manual',
          handling: 'manual',
        },
        mustUnloadFirst: c.first ?? base.mustUnloadFirst,
        access:
          c.first === null
            ? base.access
            : c.first
              ? ('immediate' as const)
              : ('normal' as const),
        orientation: c.upright ? 'upright' : i.orientation,
        stackable: c.noStack === null ? i.stackable : !c.noStack,
        maxTopLoad: c.noStack ? 0 : i.maxTopLoad,
      },
    ];
  });
  return {
    items: next,
    bag,
    prefs: {
      ...prefs,
      comfort: patch.balance ? 5 : prefs.comfort,
      route: patch.route ? 5 : (prefs.route ?? 1),
    },
  };
}

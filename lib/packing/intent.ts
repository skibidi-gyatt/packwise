import type { Container, Item, Preferences } from './model';
export type IntentPatch = {
  explanation: string;
  changes: {
    id: string;
    access: 'immediate' | null;
    fragile: boolean | null;
    remove: boolean;
  }[];
  comfort: boolean;
  reduceBulging: boolean;
  protection: boolean;
};
export function offlineIntent(text: string, items: Item[]): IntentPatch {
  const t = text.toLowerCase().trim();
  const patch: IntentPatch = {
    explanation: '',
    changes: [],
    comfort: false,
    reduceBulging: false,
    protection: false,
  };
  if (/\b(no|not|don't|never|except|instead)\b/.test(t))
    throw new Error(
      'Offline mode cannot reliably interpret negations. Edit item properties directly or connect Astra.',
    );
  if (/headphones/.test(t) && /flight|access|first|need|reach/.test(t)) {
    const i = items.find((i) => /headphone/i.test(i.name));
    if (!i) throw new Error('There are no headphones in this kit.');
    patch.changes.push({
      id: i.id,
      access: 'immediate',
      fragile: null,
      remove: false,
    });
    patch.explanation =
      'Headphones now have immediate-access priority. Recompute their retrieval path.';
  } else if (/protect.*camera|camera.*protect/.test(t)) {
    const i = items.find((i) => /camera/i.test(i.name));
    if (!i) throw new Error('There is no camera in this kit.');
    patch.changes.push({
      id: i.id,
      access: null,
      fragile: true,
      remove: false,
    });
    patch.protection = true;
    patch.explanation =
      'Camera top-load limit is zero; give clearance and nearby soft material more weight.';
  } else if (/comfort|balance/.test(t)) {
    patch.comfort = true;
    patch.explanation =
      'Give rear-panel mass placement and lateral balance more weight.';
  } else if (/bulg|expansion/.test(t)) {
    patch.reduceBulging = true;
    patch.explanation =
      'Disallow depth expansion. The solver may need to leave items out.';
  } else if (/^remove\s+/.test(t)) {
    const query = t.replace(/^remove\s+(the\s+)?/, '').replace(/[.!]$/, '');
    const match = items.filter(
      (i) => i.name.toLowerCase() === query || i.id === query,
    );
    if (match.length !== 1)
      throw new Error(
        'Name one exact item to remove, for example “Remove shoes”.',
      );
    patch.changes.push({
      id: match[0].id,
      access: null,
      fragile: null,
      remove: true,
    });
    patch.explanation = `Remove ${match[0].name} and recompute the remaining kit.`;
  } else
    throw new Error(
      'Offline mode supports the four suggestion buttons and “Remove shoes”. For other requests, edit properties or connect Astra.',
    );
  return patch;
}
export function applyIntent(
  patch: IntentPatch,
  items: Item[],
  bag: Container,
  prefs: Preferences,
) {
  const ids = new Set(items.map((i) => i.id));
  if (patch.changes.some((c) => !ids.has(c.id)))
    throw new Error('The proposed change references an unknown item.');
  if (new Set(patch.changes.map((c) => c.id)).size !== patch.changes.length)
    throw new Error('The proposed change repeats an item.');
  const updated = items.flatMap((i) => {
    const c = patch.changes.find((c) => c.id === i.id);
    if (!c) return [i];
    if (c.remove) return [];
    return [
      {
        ...i,
        access: c.access ?? i.access,
        fragile: c.fragile ?? i.fragile,
        maxTopLoad: c.fragile === true ? 0 : i.maxTopLoad,
      },
    ];
  });
  return {
    items: updated,
    bag: patch.reduceBulging ? { ...bag, expansion: 0 } : bag,
    prefs: {
      comfort: patch.comfort ? 4 : prefs.comfort,
      protection: patch.protection ? 4 : prefs.protection,
      access: prefs.access,
    },
  };
}

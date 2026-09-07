import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePhoneDraft, type PhoneDraft } from '../lib/packing/phone-draft';
import { freshCargo } from '../lib/packing/cargo-demo';
import { defaultPreferences } from '../lib/packing/model';
import { saveTextFile, setFileExporter } from '../lib/packing/files';
function draft(): PhoneDraft {
  const d = freshCargo();
  return {
    version: 1,
    ...d,
    prefs: { ...defaultPreferences, route: 1 },
    phase: 'load',
    view: 'optimized',
    hasPlan: true,
    loadingIndex: 3,
    loadingCompleted: 3,
  };
}
void test('iPhone draft restores cargo, the reproducible plan and loading confirmations', () => {
  const d = parsePhoneDraft(JSON.stringify(draft()));
  assert.equal(d.phase, 'load');
  assert.equal(d.loadingCompleted, 3);
  assert.equal(d.plan.placements.length, 20);
  assert.equal(d.plan.metrics.mass, 7300);
  assert.equal(d.plan.metrics.utilization.toFixed(1), '72.0');
});
void test('incomplete cargo cannot restore an executable phone load plan', () => {
  const raw = draft();
  raw.items[0].mass = 0;
  const d = parsePhoneDraft(JSON.stringify(raw));
  assert.equal(d.hasPlan, false);
  assert.equal(d.phase, 'cargo');
  assert.equal(d.loadingCompleted, 0);
  assert.equal(d.items[0].mass, 0);
});
void test('corrupt and incompatible drafts are rejected, and viewing cannot skip unconfirmed cargo', () => {
  assert.throws(() => parsePhoneDraft('{'));
  assert.throws(() =>
    parsePhoneDraft(JSON.stringify({ ...draft(), version: 2 })),
  );
  assert.throws(() =>
    parsePhoneDraft(
      JSON.stringify({
        ...draft(),
        prefs: { comfort: 0, access: 0, protection: 0 },
      }),
    ),
  );
  const d = parsePhoneDraft(
    JSON.stringify({ ...draft(), loadingIndex: 19, loadingCompleted: 3 }),
  );
  assert.equal(d.loadingIndex, 3);
});
void test('native exports retain UTF-8 file content and MIME type', async () => {
  const seen: string[][] = [];
  setFileExporter(async (...args) => {
    seen.push(args);
  });
  await saveTextFile('cargo.csv', 'ID,Destination\nA,新加坡', 'text/csv');
  assert.deepEqual(seen, [
    ['cargo.csv', 'ID,Destination\nA,新加坡', 'text/csv'],
  ]);
});
void test('native project bundles assets, uses Mac-compatible package paths and declares file privacy reason', () => {
  const config = readFileSync('capacitor.config.ts', 'utf8');
  assert.match(config, /mobile-dist/);
  assert.doesNotMatch(config, /server\s*:/);
  const spm = readFileSync('ios/App/CapApp-SPM/Package.swift', 'utf8');
  assert.doesNotMatch(spm, /\\/);
  assert.match(spm, /CapacitorFilesystem/);
  assert.match(
    readFileSync('ios/App/App/PrivacyInfo.xcprivacy', 'utf8'),
    /C617.1/,
  );
  assert.match(
    readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8'),
    /PrivacyInfo.xcprivacy in Resources/,
  );
});

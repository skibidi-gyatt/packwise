# Packwise Cargo

An enterprise load-planning prototype evolved from Packwise. One truck, 20 synthetic cargo units, three stops, and an operator-request → constraint → deterministic geometry loop. Built with Astra in Codex; runtime AI is optional.

## Run

For the native iPhone project and Mac installation steps, see [Packwise for iPhone](docs/IPHONE_APP.md).

```sh
npm install
npm run dev
```

Open the URL printed by Vinext. The sample manifest, manual editor, optimizer and advertised offline requests need no key. Cargo and loading state live in browser memory; reload restores the demo. Saved transport assets persist on this device. Export manifest saves JSON; Export load plan saves both algorithms, coordinates, constraints and metrics.

## 90-second demo

1. Select a saved transport or use the clearly labelled T-07 sample. Start with the 20 ready sample units, or choose Scan cargo, Import manifest, or Add manually. CSV quantities expand into distinct units; missing measurements block optimization.
2. Select **Optimize load**: **20/20 units in the plan, 72.0%, 7,300 kg**. The operator view shows the 3D result and excluded units. Advanced exposes the simple **14/20, 50.5%** comparison and engineering metrics. Six more units fit; this does not prove a vehicle was eliminated.
3. Select **P14 unloads first**. All 20 units remain assigned; Advanced shows **2 → 0 extraction blockers**, 7 moved units and the interpreted rule. Destination and stop are retained.
4. Select **Start loading**. Confirm a unit, return to the plan, then Resume. Previous shows an earlier unit without erasing confirmations. Complete the checklist.
5. Scan guidance includes a printable 20 cm marker and single/batch modes. Without a runtime API key, use CSV or manual entry. See [operator workflow and validation](docs/OPERATOR_WORKFLOW.md).

## Optional runtime AI

Copy `.env.example` to `.dev.vars`, set `OPENAI_API_KEY` and `ASTRA_MODEL`, and restart the local server. Hosted values must be configured separately through Sites. Never expose keys in client environment variables. The default `gpt-6-astra` supports image input, Responses and structured outputs according to [official model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra). Account access still needs verification.

Configured status does not mean a live call succeeded. Without a key, clearly labelled offline rules support first unload, no stacking, removal of one ID, balance and delivery-order preferences. Photo analysis stays disabled. Runtime failures preserve the current plan.

Photos are resized locally, sent only on Check photo, and not stored by this app; requests use `store:false`. Critical inferred measurements need checking. Scans fill gaps in matching cargo while preserving known measurements and transport ratings. Missing marker or weight data remains Required. The marker is an approximate visual scale reference, not calibrated computer vision. Live scan accuracy has not been tested.

## Validation

```sh
npm test
npm run typecheck
npm run build
```

22 tests cover original behavior and cargo geometry, support, mass conservation, top/floor loads, first extraction, deterministic search, manifest authority, invalid intent and mocked Responses transport. Live API and vision quality are not validated without credentials.

## Scope

One rigid rear-door asset; at most 30 units; bounded heuristic search. No fleet routing, axle certification, securing approval, dangerous-goods compliance, aircraft contours, vessel stability or global-optimum guarantee. Floor loading uses full footprints. Forklifts, straps and swept turning/lifting clearance are absent. Replan animation illustrates change, not an executable rearrangement path.

See [enterprise build brief](docs/BUILD_BRIEF.md) for reuse, architecture, rubric risks and one-day priorities; [validation record](docs/VALIDATION.md) for verification.

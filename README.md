# Packwise Cargo

An enterprise load-planning prototype evolved from Packwise. One truck, 20 synthetic cargo units, three stops, and an operator-request → constraint → deterministic geometry loop. Built with Astra in Codex; runtime AI is optional.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vinext. The sample manifest, manual editor, optimizer and advertised offline requests need no key. State lives in browser memory; reload restores the demo. Download JSON saves the manifest. Export load plan saves both algorithms, coordinates, constraints and metrics.

## 90-second demo

1. Start with Simple: **14/20 units, 50.5% utilization**.
2. Select **Optimize load**: **20/20 units, 72.0%, 7,300 kg**. Show the rear door, stop colors and centre of mass. Six more units fit; this does not prove a vehicle was eliminated.
3. Select P14 and inspect its **2 extraction blockers**. Select **P14 unloads first**, or type “Shipment P14 must be unloaded first.” Inspect the constraint patch, movement and **0 blockers**, while all 20 units remain loaded. Destination and stop are retained; this is a first-extraction override, not route optimization.
4. Play the loading sequence and Separate layers. Edit cargo weight or door width. A 90 cm door rejects the demo pallets with a reason.
5. Reset to rehearse again. Import manifest accepts pasted or uploaded JSON and expands quantities into distinct IDs.

## Optional runtime AI

Copy `.env.example` to `.dev.vars`, set `OPENAI_API_KEY` and `ASTRA_MODEL`, and restart the local server. Hosted values must be configured separately through Sites. Never expose keys in client environment variables. The default `gpt-6-astra` supports image input, Responses and structured outputs according to [official model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra). Account access still needs verification.

Configured status does not mean a live call succeeded. Without a key, clearly labelled offline rules support first unload, no stacking, removal of one ID, balance and delivery-order preferences. Photo analysis stays disabled. Runtime failures preserve the current plan.

Photos are resized locally, sent only on Analyze, and not stored by this app; requests use `store:false`. New inferred cargo requires review. Existing manifest IDs and asset measurements survive photo import unchanged. Manual measurements take precedence. Inferred mass and load limits are not certified measurements.

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

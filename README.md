# Packwise

A one-day hackathon prototype: editable packing estimates, deterministic 3D packing, static load checks, and intent-driven replanning. Built with Astra in Codex; runtime Astra is optional.

```sh
npm install
npm run dev
```

Open the Local URL printed by Vinext (normally http://localhost:3000). The weekend sample, manual editor and supported intent requests work without a key. State lives in memory; Export plan saves a JSON snapshot. Reloading restores the demo.

## Runtime Astra (optional)

Copy `.env.example` to `.dev.vars` and set `OPENAI_API_KEY` there for the local Cloudflare runtime; restart the development server. Keep secrets on the server, never in a `VITE_` or `NEXT_PUBLIC_` variable. The default model is `gpt-6-astra`. For hosted Sites, configure `OPENAI_API_KEY` as a secret and `ASTRA_MODEL` through Sites environment settings; local variables are not uploaded.

The header reports whether credentials are configured, not whether the key/model has passed a live request. Click Start from photos to select an item photo and optionally a container photo. Add a measured reference, analyze, review inferred dimensions, then import. You can edit all properties and bag settings afterward. If the API fails, the existing plan stays intact; use Reset weekend demo.

Photos are downscaled locally before an explicit analysis request and are not stored by the application. `store:false` is sent to the Responses API. Provider data policies still apply.

## Validation

```sh
npm test
npm run typecheck
npm run build
```

Tests cover deterministic search, independent geometric checks, load propagation, rotation, opening and weight bounds, invalid data, baseline fairness, empty/full failure cases, intent handling and mocked Responses transport. A live API call needs credentials and is not implied by those tests.

## Demo

1. Compare First fit and Optimized.
2. Select an item; inspect top load and retrieval blockers.
3. Click Headphones during the flight. Watch movement and actual deltas.
4. Play the packing sequence, then test a smaller opening in Bag settings.
5. Reset and export the result.

See [the product and architecture brief](docs/BUILD_BRIEF.md) for rubric risks, frozen scope, data flow, schemas, algorithm, exact scores and the 90-second demo.

This is an axis-aligned planning model, not a safety/ergonomics certification. Opening position and zipper/tilting motion are not simulated. Quality scores describe only packed items: always compare counts first.

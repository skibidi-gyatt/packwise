# Operator workflow upgrade

Built on the existing enterprise planner; its geometry, load limits, sample manifest, 3D renderer and comparison engine remain in place.

## Normal use

1. Select transport. Save a measured transport for reuse on this device. Sample truck T-07 is illustrative and must be verified before real use.
2. Add cargo using CSV/JSON import, manual dimensions and weight, or optional runtime camera analysis. The prototype accepts 30 expanded units.
3. Check exceptions. Missing dimensions/weight are Required. AI dimensions, weight and positive stacking ratings need checking. Company measurements are ready; conservative no-stack handling does not require a separate decision. Identical quantity groups can share one checked measurement entry.
4. Optimize load. The result shows cargo assigned, cubic/payload utilization, weight balance, excluded units and a selectable 3D plan.
5. Start loading. Confirm each unit; Previous is a viewing action. Back to plan preserves confirmations and offers Resume. A partial plan requires acknowledging the units left out.

Cargo and loading state remain in memory in the open page. Reload restores the demo; a new/changed plan resets its checklist. Saved transports alone use localStorage. This is a one-day prototype, not a durable dispatch-job system.

## Capture

Single capture + quantity and batch capture share guided instructions. A printable 20 cm square is available at `/cargo-scan-marker.html`. Print at actual size and verify its outer border with a ruler. This is a visual scale reference, not an ArUco decoder or calibrated photogrammetry.

The client checks file type, byte size and minimum resolution, then resizes images. The optional runtime model checks marker visibility, crop, blur, overlap and useful view angle in one structured response. It may request one side view; retake/second-view gates prevent accepting those results. Without a usable marker, estimated dimensions are discarded and marked Required. Weight is requested only from readable labels or supplied facts, never inferred from visual appearance. Returned dimensions and weights still need checking.

Company values win when a readable scan ID matches existing cargo. A scan can fill a missing dimension axis or weight but cannot replace a known value. Scans do not change transport ratings. Photos are sent only on Check photo; this app does not save them. Live visual accuracy has not been evaluated because no runtime API key is configured.

## Language and expert controls

The optional runtime API accepts operator descriptions and emits restricted validated constraints. Offline examples use exact cargo IDs for first-unload, no-stack, upright, removal, balance and delivery-order preferences. Ambiguous unsupported requests produce an explanation. Fleet sizing and enterprise WMS/ERP/TMS connectors are outside this prototype.

Advanced retains baseline comparison, extraction blockers, payload distribution, centre of mass, floor loading, constraint patches, complete manifest, sequence playback, individual handling controls and transport limits. Geometry assumptions and securing/axle limitations remain available.

## Validation

30 automated tests pass, including eight operator tests for CSV quoting/quantities, missing values, duplicate IDs, capture gates, company-data priority, grouped scans, plain upright instructions and a mocked two-image Responses contract. Existing 22 tests continue to pass; failure-message expectations were updated to the new plain language. Type checking and targeted lint pass.

Actual browser flow: imported two identical CSV units with missing weights; Optimize was disabled. Entered 18 kg once and applied it to the identical group; both became ready. Optimized, confirmed one unit, returned to the plan, resumed at unit 2, viewed Previous without losing the first confirmation, and completed both units. Saved and selected T-07; blank manual entry showed a clear error. Readiness remained visible at 768px portrait tablet width. Independent reviewers also inspected 820px and 768px tablets, manual capture fallback, plan and guided loading.

Not a usability study with external warehouse participants. No real cargo measurement, live AI response, securing certification, axle rating validation or operational efficiency claim is implied.

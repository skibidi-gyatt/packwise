# Packwise — 2 minute 45 second pitch

Three speakers, approximately 350 spoken words. Read conversationally, with short pauses for the screen actions. Replace Member 1/2/3 with your names. Record each member on camera at the start of their section, then use their voice over the screen recording. Keep captions on throughout.

| Time | Speaker and exact lines | What the video shows |
| --- | --- | --- |
| 0:00–0:20 | **Member 1:** “The truck looks full. But the delivery you need first is buried at the back. Loading is more than fitting boxes: it is deciding what fits, what stays supported, and what comes out first. We built Packwise to make those decisions visible before loading begins.” | Start with a close-up of boxes blocking a labelled delivery, or the 3D plan with P14 selected. Cut to Member 1, then the Packwise landing page. Caption: **Plan before you load.** |
| 0:20–0:40 | **Member 1:** “Choose your transport, enter its maximum cargo weight, and add your cargo. A phone photo can suggest dimensions, or you can import a manifest. For this demo, photo dimensions are approximate, clearly labelled, and checked by the user.” | Choose Shipping container and Use a photo. Show a real prepared photo, then returned demo dimensions. Show manual maximum weight. Cut to Scan cargo → Choose from gallery → a real result. Keep the approximate label visible. |
| 0:40–1:00 | **Member 2:** “Here is our sample load: twenty cargo units and three delivery stops. The simple loading baseline fits fourteen. Packwise fits all twenty, increasing space utilization from fifty point five to seventy-two percent in this example.” | Start a separate, fresh sample-truck recording: Try the sample truck → Open load planner → Optimize load. Open Advanced settings. Show Simple and Optimized views of the same sample, holding the numbers for three seconds. Caption: **Same sample: 14 → 20 units · 50.5% → 72.0%.** Small label: **Synthetic demo scenario.** |
| 1:00–1:20 | **Member 2:** “Now the job changes: this medical supply crate must come out first. I tell Packwise, ‘P14 unloads first.’ It translates that request into a loading rule and rearranges the plan. All twenty units still fit, and P14's extraction blockers drop from two to zero.” | Enter **P14 unloads first** in the operator request field and apply it. Show the explanation and changed positions. Highlight P14 and the **2 → 0** extraction-blocker result. Use the unchanged sample truck and original sample cargo for these numbers. |
| 1:20–1:43 | **Member 3:** “Under the hood, AI interprets photos and everyday instructions. A deterministic packing engine checks the geometry, door opening, weight, support, and loading constraints. Known measurements take priority over AI estimates. If something cannot fit, the operator sees what was excluded and why.” | Briefly show a simple diagram: **Photos + instructions → structured data and rules → packing engine → checked 3D plan.** Cut to the actual constraints or excluded-unit explanation from a separate clearly labelled example with a reduced opening. Do not mix its metrics with the previous comparison. |
| 1:43–2:05 | **Member 3:** “The result is also a loading workflow. Start loading, follow the highlighted unit, and confirm each step. Operators can return to the plan and resume where they stopped. From initial capture to the last confirmation, the decisions stay connected.” | On the successful sample plan, select Start loading, confirm one unit, return to the plan, and Resume. Hold the highlighted next unit and progress count. |
| 2:05–2:25 | **Member 1:** “For dispatchers and small logistics teams, our goal is less guesswork, better use of space, and fewer surprises at the unloading door. The prototype already connects transport setup, cargo capture, constraint changes, and guided loading in one website.” | Quick four-shot recap of the actual landing page, cargo results, changing 3D plan, and loading checklist. Overlay the benefit words only as goals, not measured savings. |
| 2:25–2:45 | **Member 2:** “We built it with Astra in Codex, an optional runtime AI connection, and a tested packing engine.” **Member 3:** “Next, we want to validate it with real loading teams and measured cargo.” **All three:** “Packwise. Know what fits. Know what comes out first.” | All three on camera, then a clean closing card: Packwise, the live website URL, and the GitHub repository URL once created. Caption: **Working prototype · 46 automated tests passing.** Leave the closing card up for three seconds. |

## Recording preparation

- Record at 1080p landscape. Use close crops of the interface for labels and numbers; avoid showing the whole desktop at unreadable size.
- Prepare one usable transport photo and one cargo photo. Record genuine returned results. Cut out upload and API waiting time; if a wait is visibly compressed, caption it “Processing time shortened.” Never substitute a fabricated response.
- Keep the photo demonstration separate from the sample-truck comparison. The 14/20, 20/20, 50.5%, 72.0%, and P14 blocker results belong to the supplied T-07 sample, not your uploaded photos.
- Reset the sample before recording the comparison. Show the initial optimization before applying the P14 instruction; otherwise the before/after blocker numbers may differ.
- Rehearse the eight sections against the timestamps. If you exceed three minutes, omit the separate excluded-cargo shot and shorten the recap; preserve the comparison and P14 change.
- Do not show account pages, API keys, developer consoles, or private notifications.

## Claims to keep precise

The baseline is this project's simple loading heuristic, not a measured competitor result. The sample demonstrates six additional assigned units; it does not prove a truck, trip, cost, or emissions saving. Photo dimensions are demo assumptions, not verified measurements. The prototype checks its implemented model constraints; it does not certify securing, axle loads, or real-world loading safety. The three speakers should describe their actual contributions if judges ask; the video does not invent individual roles.

## Submission links

- Live demo: https://packwise-field-lab.tangqin918.chatgpt.site/
- GitHub: https://github.com/skibidi-gyatt/packwise (ensure judges have access before submitting).
- Setup and architecture: [README](../README.md).

---
name: Packwise Cargo
description: Dispatch planning beside an inspectable cargo model.
colors:
  primary: '#08765e'
  background: '#f3f5f6'
  ink: '#162835'
  sheet: '#ffffff'
  border: '#d7e0e4'
  stage: '#12232f'
  metadata: '#526b78'
typography:
  headline:
    fontFamily: 'Geist, Arial, sans-serif'
    fontSize: '30px'
    fontWeight: 620
    letterSpacing: '-0.035em'
  title:
    fontFamily: 'Geist, Arial, sans-serif'
    fontSize: '19px'
    fontWeight: 600
  body:
    fontFamily: 'Geist, Arial, sans-serif'
    fontSize: '14px'
  metric:
    fontFamily: 'Geist, Arial, sans-serif'
    fontSize: '35px'
    fontWeight: 570
rounded:
  control: '6px'
  field: '5px'
  panel: '10px'
  dialog: '12px'
spacing:
  compact: '8px'
  control: '12px'
  mobile-gutter: '16px'
  workspace-gap: '20px'
  desktop-gutter: '32px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.sheet}'
    rounded: '{rounded.control}'
    padding: '12px 16px'
  field:
    backgroundColor: '{colors.sheet}'
    textColor: '#244755'
    rounded: '{rounded.field}'
    padding: '10px'
---

# Design System: Packwise Cargo

## Overview

Creative direction: **Dispatch load sheet beside an illuminated CAD viewport.** Mode: Operate. This is the implemented, code-led enterprise console, not an approved image composition or pre-implementation FORM seed. White control sheets and compact operational data surround a live Three.js cargo model.

Preserve the dominant model, compact manifest, computed comparisons, restrained green actions, and explicit distinction between sample facts, operator rules and AI estimates.

## Color and type

Green identifies primary actions and positive constraint states. Cool paper, ink and fine borders organize controls; navy separates the model. Stop colors are amber #de9f4d, blue #598bd6 and green #509c82, paired with readable stop numbers/names or cargo IDs. Warnings use warm amber; errors use rust on pale warm backgrounds.

Small baseline, provenance and table metadata use #526b78. Do not lighten these labels to make them recede. Color supplements readable state and provenance; it does not replace them.

Geist is the interface family; the existing Geist Mono is used for JSON. Measurements use tabular numerals. Typical interface text is 12–14px, with 10–12px metadata. Tiny metadata is an existing density tradeoff, not a target for new explanatory copy. Mobile page headings become 26px and metric values 30px.

## Layout and responsive behavior

The masthead sits above a working area capped at 1700px. Gutters are 32px, 24px below 1200px and 16px below 650px. Route and asset context precede the KPI strip and model. Desktop shows five divided metrics and a model beside a narrow operations panel. Below 950px, model and operations stack.

At 650px and below, show cubic utilization and loaded cargo first. An explicit disclosure reveals payload, access and unused volume. This preserves recognizable geometry in the first viewport. Stops scroll internally when necessary. The 350px mobile model canvas fits cargo into the narrow camera frame.

The manifest retains a 940px minimum width inside a scrolling container. Keep useful columns and measured units readable. Dialogs have 16px outer clearance and an 88vh height limit.

## Depth, shape and motion

Borders, background changes and spacing organize predominantly flat work surfaces. The 3D scene provides depth through perspective, lighting, a floor grid and the asset envelope. Small rounded corners distinguish controls; panels and dialogs use broader corners. Cargo remains rectilinear and dimension driven.

Replan positions interpolate over 550ms with cubic ease-out. Reduced-motion preferences skip interpolation, spinner animation and smooth scrolling. Playback and replanning are illustrative, not certified handling trajectories. The front/rear mass bar changes directly, avoiding width animation.

## Components and states

Primary actions use green/white, 14px text and a minimum 42px height. Secondary actions use white with a cool border. Disabled actions reduce opacity and expose their disabled state. Keyboard focus uses a 3px green outline with a 3px offset. Inputs retain visible labels, units and validation feedback; edits end with Save & recompute.

Simple/Optimized tabs switch actual plans. Orbit, zoom, layer separation, selection and loading controls sit beside the model. Selection also works through manifest buttons. The selected summary shows ID, dimensions, top load and extraction blockers. If WebGL fails, the manifest, metrics and instructions remain available.

The intelligence panel describes actual handling constraints. Non-stackable does not imply upright: derive each phrase from its own field. Provenance distinguishes synthetic facts, sample dimensions with an operator rule, provided data and AI estimates. Front/rear cargo mass is not axle certification.

Metrics show calculated values, units and simple-plan comparisons. Priority access names its target scope. Pending cargo includes a reason and an edit action. Search, stop filters and selected-row tinting support manifest inspection.

The copilot uses concrete suggestions and a request form. Interpretations appear as structured constraint changes followed by computed effects. Keep the P14 blocker counterfactual visible; do not substitute a chat transcript. Runtime availability is explicit.

## Review record

Official Impeccable 4.2.2 installed. Initial context loading encountered a verified Windows-engine download failure. A later single detector run succeeded and its width-animation warning was removed. A fresh reviewer scored the mobile first viewport, orientation truth and small-text contrast fixes resolved. Its final ship disposition covers those scored fixes, not a broad accessibility or 9–10 guarantee.

Six valid viewport captures in `.impeccable/review/` substitute for defective full-page stitching. No formal FORM seed, QUALITY BAR card or approved comp is claimed. Functional checks are recorded separately in `docs/VALIDATION.md`.
# Operator workflow addition — September 2026

The default surface is Operate: select transport, add cargo, check exceptions, optimize, guided loading. Preserve the enterprise palette and 3D renderer. Primary cargo intake has three choices; engineering metrics and full tables are disclosed under Advanced. Tablet layouts prioritize cargo ID and readiness over destination/stacking columns. Loading uses a large ID, one plain placement sentence and a 56px confirmation target. Reviewing previous steps does not undo completed confirmations. Capture guidance includes a front-face marker diagram and a printable verified-size square. Route assignment stays visible in the basic cargo form.

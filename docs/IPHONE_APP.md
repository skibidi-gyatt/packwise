# Packwise Cargo for iPhone

This repository now contains an iPhone app project, using Capacitor and a bundled React application. It does not load the hosted Packwise website. Its cargo planning, CSV/manual intake, 3D view, operator rules and loading checklist run on the device.

## What is ready

- Complete Xcode project: `ios/App/App.xcodeproj`.
- Bundled app assets and local planner, with iPhone safe-area spacing and touch controls.
- Saved cargo, selected transport, planning preferences and loading confirmations on this device. Restored plans are recalculated and checked against their saved inputs. Incomplete measurements return to Check.
- iOS Share sheet integration for exported plans, manifests and CSV templates; the user selects the destination in the system sheet.
- Camera/photo usage descriptions, app icon, branded launch screen and file-access privacy manifest.
- The existing hosted/web build remains supported.

Photo preparation and calibration guidance are included, but runtime photo AI is not connected in this native build. Manual entry, CSV import and supported offline operator requests work without a server or key. No API secret is included. A future runtime service needs an authenticated native API connection; simply pointing the app at the private Sites endpoint is not sufficient.

## Install on your iPhone using a Mac

Requirements: macOS, Xcode 26 or later, Node.js 22 or later, an iPhone and your Apple account for signing. Capacitor's current iOS target supports iOS 15 or later. See the [official environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup).

1. Unzip the complete project on the Mac. In Terminal, open the extracted `Packwise-iPhone` folder.
2. Run `npm ci`, then `npm run ios:sync`. This builds the bundled planner and updates the iOS project.
3. Run `npm run ios:open`, or open `ios/App/App.xcodeproj` in Xcode.
4. Select the **App** target. Under **Signing & Capabilities**, select your development team. Replace `app.packwise.cargo` with an identifier available to your team if Xcode requires it.
5. Connect and select your iPhone as the run destination. Follow Xcode's device pairing/developer-mode prompts, then press Run.

Xcode downloads the pinned Capacitor Swift package on first use. The ZIP includes source and built web assets, but not node_modules, Apple signing credentials or a compiled IPA. Do not open the app's HTML directly from Files: it must run inside the iOS project.

TestFlight/App Store distribution is a separate Apple signing and submission step. No upload or public release has been performed.

## Validation and limits

- Mobile web bundle: build passes. Existing web build and TypeScript checking pass.
- 35 tests pass, including native draft restoration, incomplete-data protection, corrupted-draft handling, file-export contract and iOS configuration checks.
- iPhone-sized browser check at 393 × 852: optimized the 20-unit sample, confirmed one loading step, reloaded, and restored Load 2 of 20 with 1 unit confirmed. Cargo dimensions, mass and plan are preserved. No overflow in the main page.
- The browser preview is the app's actual bundled React UI. It is not an iOS Simulator.
- This Windows computer cannot run Xcode, compile/sign an IPA, or verify UIKit, real camera access, system file sharing and physical-device WebGL behavior. Those checks remain for the Mac/iPhone step.
- Storage is local to this app/device, not a multi-user dispatch database. Export important manifests; removing the app removes its local data.

## Developer commands

`npm run mobile:dev` starts the phone UI preview at http://127.0.0.1:3001/.

`npm run mobile:build` creates `mobile-dist/` from the shared planner.

`npm run ios:sync` refreshes bundled assets and native plugins. The preparation script normalizes Windows-generated Swift package paths for macOS and preserves the privacy resource.

`npm run ios:open` opens Xcode on a Mac.

Capacitor CLI is pinned to 8.4.3 because 8.5.1's development dependency chain triggered an audit finding. Runtime packages remain 8.5.1; the generated Swift package uses that exact runtime version. `npm audit` reports no known vulnerabilities for the resulting lockfile at build time.

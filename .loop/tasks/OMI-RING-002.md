# OMI-RING-002 - Capacitor iOS foundation

## Objective
Turn the Vite build into a Capacitor application while preserving the browser demo and hash routing.

## Allowed files
- package.json, package-lock.json
- capacitor.config.ts
- .gitignore
- Minimal Vite/bootstrap files required by Capacitor

## Dependencies
OMI-RING-001.

## Non-goals
Do not generate ios/ yet, implement BLE, redesign pages, or alter domain policies.

## Implementation notes
Use Capacitor packages compatible with the installed Node toolchain. Add scripts for sync/open/run. Keep native-only imports lazy so web tests remain safe. Do not commit secrets or machine-specific paths.

## Acceptance criteria
- Production assets build to the configured Capacitor web directory.
- Browser demo and tests remain unchanged.
- Capacitor config has a stable reverse-DNS app id and product name Loop.

## Required checks
npm install, npm run typecheck, npm test, npm run build, Capacitor config validation.

## Real-device validation status
Requires later native project and signed device build.

## Conflict boundary
Do not add ios/, device adapters, or feature UI.


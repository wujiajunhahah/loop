# Integration Risks

## INT-RISK-001 In-memory persistence

Reloading the page resets the demo state. This is intentional for the offline
MVP and must be replaced by durable storage before production use.

## INT-RISK-002 Placeholder media

The demo audio URI is a playback contract placeholder. No real recording or
hardware SDK is required for the presentation, but a bundled media asset is
needed for a production-quality media demo.

## INT-RISK-003 Mock identity proof

`LOOP-DEMO` is only a local simulator proof. It demonstrates the verification
boundary and must not be treated as authentication outside the demo.

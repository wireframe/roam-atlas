# Structure: roam-atlas build (with {{[[atlas]]}} rename)
Date: 2026-07-05
Decisions: [decisions.md](decisions.md)
Research: [research.md](research.md)

Five phases, each independently shippable, testable, and revertable. Phases 2 and
3 are siblings (both build only on Phase 1) and could be done in either order.
TDD throughout: tests first, red-green-refactor.

## Phase 1: Bootstrap & test harness
**Goal:** A buildable, testable skeleton. `npm install` the pinned deps; add the
extension entry that detects Roam's rendered `{{[[atlas]]}}` / `{{atlas}}`
component element and replaces it in place with the map — automatically on
insert, no click (via `createButtonObserver`; the `.bp3-button` Roam emits for
the component is the transient element we swap out). An empty OSM map (no Mapbox
token) renders on type. Also stand up the greenfield test infrastructure that
research flagged is missing — a `tests/` dir plus a local helper that installs a
fake `window.roamAlphaAPI` and stubs outbound network, with one trivial passing
test proving the harness runs.
**Files touched:** `src/index.ts`, `tests/helpers/roam.ts` (fake `roamAlphaAPI` +
network stub), `tests/harness.test.ts`, `package.json` (verify scripts).
**Depends on:** nothing.
**Verification:** `npm install` succeeds; `npm test` runs and the trivial test
passes; `npm run build:roam` (samepage build --dry) succeeds; loading the built
extension in Roam and typing `{{[[atlas]]}}` (and `{{atlas}}`) renders an empty
OSM map (manual — confirms D1's dual-form match live).

## Phase 2: Graph-data layer (references + location)
**Goal:** The pure graph read/write layer. `references.ts` parses a map block's
children into resolved targets tagged `page` or `block`. `location.ts` reads a
node's `Location::` / `Coordinates::` child attributes and does the idempotent
`writeCoordinates` (never overwrites existing, refuses on unparseable). No UI, no
network.
**Files touched:** `src/references.ts`, `src/location.ts`,
`tests/references.test.ts`, `tests/location.test.ts`.
**Depends on:** Phase 1 (test harness).
**Verification:** `npm test` — references parses page refs, block refs, mixed
lists, and ignores non-reference children; `getLocation`/`getCoordinates` read
the right values; `writeCoordinates` is idempotent (second call is a no-op) and
never overwrites human-typed coords. All against the fake `roamAlphaAPI`.

## Phase 3: Geocoding layer
**Goal:** `geocode.ts` — a Nominatim client wrapped in a serialized 1-req/sec
queue with an in-flight dedupe set keyed by node UID, sending the required
identifying User-Agent. Pure text-in / coords-out; no graph or UI dependency.
**Files touched:** `src/geocode.ts`, `tests/geocode.test.ts`.
**Depends on:** Phase 1 (test harness / network stub).
**Verification:** `npm test` with a stubbed Nominatim — requests serialize (never
fire in parallel), the in-flight set dedupes concurrent asks for the same node,
the 1-req/sec throttle holds, and a failed lookup resolves to a no-result value
(no throw).

## Phase 4: Map render pipeline
**Goal:** Wire Phases 2+3 into the live map. `Maps.tsx`: resolve references →
render cached pins immediately → drain the geocode queue for uncached nodes,
writing `Coordinates::` back and pinning progressively → auto-fit the viewport to
the marker bounds as they arrive. Popups reuse the Roam-markup renderer; click
opens the page/block, shift-click opens the sidebar (type-branch page vs block).
Per-marker failures skip with a visible "couldn't map (N)" notice. **Reactivity:**
the map re-reads and refreshes its markers when children are added/removed under
the map block — via `roamAlphaAPI.data.addPullWatch` on the block subtree
(preferred) or a DOM `MutationObserver` fallback; the exact mechanism is settled
in `/plan` (research did not pin it down).
**Files touched:** `src/components/Maps.tsx`, `src/components/AliasPreview.tsx`,
`src/components/hooks.ts`, `src/index.ts` (wire render), `tests/flow.test.ts`.
**Depends on:** Phase 2, Phase 3.
**Verification:** `npm test` flow test (mocked API + geocoder) — a cached node
pins with zero network calls; an uncached node geocodes once and writes back.
Manual in Roam: reference located pages and a block under `{{[[atlas]]}}`; pins
appear and auto-fit; clicking navigates; a page missing `Location::` shows in the
notice.

## Phase 5: Widget UX (resize + full-screen)
**Goal:** Resize via a bottom-edge drag handle → `invalidateSize()` → persist the
chosen height to the map block's `:block/props` (D3), restored on next render.
Full-screen toggle button → fixed CSS overlay → `invalidateSize()` on
enter/exit → `Esc` to exit (session-only). Confirm `:block/props` write
persistence early (the one research caveat).
**Files touched:** `src/components/Maps.tsx`, `src/index.ts` (overlay styles),
`src/location.ts` or new `src/blockProps.ts` (props read/write helper),
`tests/blockProps.test.ts`.
**Depends on:** Phase 4.
**Verification:** `npm test` — height read/write against the fake API. Manual in
Roam: drag to resize, reload the page, height is retained (confirms props
persist); full-screen button fills the viewport and the map renders correctly;
`Esc` exits.

## Out of Scope
- Inline-param component config (`{{[[atlas]]: height=500}}`) — rejected in D3.
- Query/tag-scoped, context-scoped, and "all located pages" marker selection.
- Alternative map styles / multiple tile providers (single OSM layer only).
- Automatic re-geocoding when a `Location::` changes (manual: clear `Coordinates::`).
- Graph-wide reactivity to edits on referenced nodes elsewhere in the graph.
- Manual `Center::` / `Zoom::` overrides (auto-fit only).

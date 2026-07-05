# Plan: roam-atlas build (with {{[[atlas]]}} rename)
Date: 2026-07-05
Decisions: [decisions.md](decisions.md)
Research: [research.md](research.md)
Structure: [structure.md](structure.md)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A clean-room Roam extension that renders `{{[[atlas]]}}` as an interactive OpenStreetMap map of curated page/block references, geocoding each `Location::` once via Nominatim and caching coordinates back into the graph.

**Architecture:** Pure, dependency-injected core modules (`references`, `location`, `geocode`, `markers`, `blockProps`) hold all logic and are unit-tested with injected deps and a small fake `roamAlphaAPI`. `components/Maps.tsx` is a thin react-leaflet@3 view that calls the core, manages React state, watches the map block via `addPullWatch`, and handles resize/full-screen. No Mapbox, no API token.

**Tech Stack:** TypeScript, React 17, react-leaflet@3.0.2 / leaflet@1.7.1, roamjs-components@0.80.3, `@samepage/scripts` build+test (Playwright + jsdom), Nominatim geocoding, OpenStreetMap tiles.

**Conventions:** TDD (failing test first, then implement). Commits carry no Claude attribution (user preference). All paths are relative to the repo root `~/Projects/roam-atlas`.

---

## Phase 1: Bootstrap & test harness

- [x] Task 1.1: Install pinned dependencies
  - File: `package.json` (already present)
  - Change: run `npm install` to materialize `node_modules` for the pinned deps.
  - Test: `ls node_modules/react-leaflet node_modules/roamjs-components` both exist; `npx tsc --noEmit` runs (may report no files yet — acceptable).

- [x] Task 1.2: Trivial passing test to prove the runner works
  - File: `tests/harness.test.ts` (new)
  - Change: add `import { test, expect } from "@playwright/test";` and one test asserting `expect(1 + 1).toBe(2)`.
  - Test: `npm test` discovers `tests/` (unit project = non-`integration` match, per research.md FA6) and the test passes.

- [x] Task 1.3: Fake `roamAlphaAPI` test helper (in-memory graph)
  - File: `tests/helpers/roam.ts` (new)
  - Change: export `installFakeRoam(blocks)` that sets `window.roamAlphaAPI` with an in-memory block store and implements the methods the core uses: `createBlock`, `updateBlock` (incl. `props` merge), `pull`, `q`, `ui.mainWindow.openPage/openBlock`, `data.addPullWatch/removePullWatch`. Store blocks as `{uid, string, order, props, children[]}`. Export a `reset()`.
  - Test: `tests/helpers/roam.test.ts` (new) — after `installFakeRoam`, `createBlock` then `pull("[:block/string]", [":block/uid", uid])` returns the string; `npm test` green.

- [x] Task 1.4: Extension entry renders an empty OSM map on `{{[[atlas]]}}`
  - File: `src/index.ts` (new), `src/components/Maps.tsx` (new, minimal)
  - Change: `runExtension(async () => { createButtonObserver({ shortcut: "atlas", attribute: "atlas", render }); addStyle(...leaflet...); return cleanup })`. Match logic per research.md FA2 (`shortcut: "atlas"` catches both `{{atlas}}` and `{{[[atlas]]}}`). `render(b)` does `ReactDOM.render(<Maps blockId={b.closest(".roam-block").id} />, b.parentElement)`. Minimal `Maps.tsx`: `MapContainer` + single OSM `TileLayer` (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, attribution `&copy; OpenStreetMap contributors`), fixed default height/center, `whenCreated` stashing the instance + `invalidateSize()` (research.md FA5). Inject leaflet CSS `<link>` like the reference (`~/Projects/mapbox/src/index.ts:17-20`).
  - Test: `npm run build:roam` (samepage build --dry) succeeds. Manual: load `build/main.js` in Roam, type `{{[[atlas]]}}` and `{{atlas}}` — an empty OSM map renders with no click (confirms D1 live).

- [x] Commit Phase 1 — "Bootstrap: OSM map renders on {{[[atlas]]}}, test harness with fake roamAlphaAPI"

## Phase 2: Graph-data layer (references + location)

- [x] Task 2.1: `classifyReference` (pure) — RED
  - File: `tests/references.test.ts` (new)
  - Change: assert `classifyReference("[[Ferry Building]]") === {type:"page", key:"Ferry Building"}`; `"#[[Ferry Building]]"` and `"#Ferry"` → page; `"((abc123def))"` → `{type:"block", key:"abc123def"}`; plain text `"Zoom"` → `null`.
  - Test: `npm test` — fails (function absent).

- [x] Task 2.2: `classifyReference` — GREEN
  - File: `src/references.ts` (new)
  - Change: implement using regex. Block: `/^\(\(([^)]+)\)\)$/`. Page: use `roamjs-components/util/extractTag` semantics (`#[[..]]`, `[[..]]`, leading `#`) — if the text is a bare page ref, return its title; else `null`. (research.md FA4 `extractTag`.)
  - Test: `npm test` — 2.1 tests pass.

- [x] Task 2.3: `getReferences(mapBlockUid)` wiring — RED then GREEN
  - File: `tests/references.test.ts`, `src/references.ts`
  - Change (test): with `installFakeRoam`, a map block with children `[[A]]`, `((b1))`, and `Zoom` → returns `[{uid: uidA, type:"page"}, {uid:"b1", type:"block"}]` (Zoom ignored). Change (impl): read children via `getFullTreeByParentUid(mapBlockUid)` (research.md FA4), `classifyReference` each child's `text`; for page refs resolve title→uid with `getPageUidByPageTitle`; for block refs the key is the uid; drop `null` and unresolved (`""`) refs.
  - Test: `npm test` green.

- [x] Task 2.4: `parseCoordinates` (pure) — RED/GREEN
  - File: `tests/location.test.ts` (new), `src/location.ts` (new)
  - Change: `parseCoordinates("37.7955, -122.3937") === [37.7955,-122.3937]`; extra spaces ok; `"garbage"`, `"1,2,3"`, `""` → `null`.
  - Test: `npm test` green.

- [x] Task 2.5: `getAttributeValue` (pure) + `getLocation`/`getCoordinates` — RED/GREEN
  - File: `tests/location.test.ts`, `src/location.ts`
  - Change: `getAttributeValue(children, "Location")` finds the child whose trimmed `text` starts with `Location::` and returns the trimmed remainder (research.md FA4 string-route: block string is literally `"Location:: value"`). `getLocation(uid)` / `getCoordinates(uid)` = read `getFullTreeByParentUid(uid).children` then `getAttributeValue` (+ `parseCoordinates` for coords). Test both with `installFakeRoam`.
  - Test: `npm test` green.

- [x] Task 2.6: `writeCoordinates(uid, coords)` idempotent — RED then GREEN
  - File: `tests/location.test.ts`, `src/location.ts`
  - Change (test): node with no `Coordinates::` → after `writeCoordinates(uid,[1,2])` a child `"Coordinates:: 1, 2"` exists; calling again does NOT add a second (idempotent, D2); a node with an existing `Coordinates::` is left untouched (never overwrite human data — structure error-handling). Change (impl): read children; if a `Coordinates::` child exists, return without writing; else `createBlock({location:{"parent-uid":uid, order:"last"}, block:{string: \`Coordinates:: ${lat}, ${lng}\`}})` (research.md FA4).
  - Test: `npm test` green.

- [x] Commit Phase 2 — "Graph-data layer: reference parsing, Location/Coordinates read, idempotent write-back"

## Phase 3: Geocoding layer

- [ ] Task 3.1: `createGeocoder` — Nominatim URL + parsing — RED
  - File: `tests/geocode.test.ts` (new)
  - Change: with an injected `fetchImpl` stub returning `[{lat:"37.79", lon:"-122.39"}]`, `geocode("u1","Ferry Building")` resolves `[37.79,-122.39]`; empty array `[]` resolves `null`; a throwing `fetchImpl` resolves `null` (no throw — structure error-handling).
  - Test: `npm test` — fails.

- [ ] Task 3.2: `createGeocoder` — GREEN
  - File: `src/geocode.ts` (new)
  - Change: `createGeocoder({ fetchImpl = window.fetch, delay = (ms)=>new Promise(r=>setTimeout(r,ms)), minIntervalMs = 1000 })`. `geocode(uid, text)` hits `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<encodeURIComponent(text)>`, parses first result to `[parseFloat(lat), parseFloat(lon)]`, `null` on empty/error. (Browser fetch cannot set User-Agent; Nominatim identifies via Referer — note in code comment, research constraint.)
  - Test: `npm test` — 3.1 passes.

- [ ] Task 3.3: In-flight dedupe by uid — RED/GREEN
  - File: `tests/geocode.test.ts`, `src/geocode.ts`
  - Change (test): two concurrent `geocode("u1", "X")` calls → `fetchImpl` invoked exactly once, both resolve same value. Change (impl): a `Map<uid, Promise>` in-flight set; return the existing promise if present; delete on settle.
  - Test: `npm test` green.

- [ ] Task 3.4: Serialized 1-req/sec queue — RED/GREEN
  - File: `tests/geocode.test.ts`, `src/geocode.ts`
  - Change (test): with an injected `delay` spy and sequential `fetchImpl` that records active-count, three `geocode` calls for distinct uids → `fetchImpl` never runs concurrently (max active === 1) and `delay` is called with `minIntervalMs` between requests. Change (impl): chain each request onto a shared `queue = queue.then(() => run())`, awaiting `delay(minIntervalMs)` between dequeues.
  - Test: `npm test` green.

- [ ] Commit Phase 3 — "Geocoding: Nominatim client with serialized 1-req/sec queue and in-flight dedupe"

## Phase 4: Map render pipeline

- [ ] Task 4.1: `loadMarkers` orchestration (dependency-injected) — RED
  - File: `tests/markers.test.ts` (new)
  - Change: define `deps = { getReferences, getLabel, getLocation, getCoordinates, geocode, writeCoordinates }` as stubs. Assert: a ref with cached coords → marker produced, `geocode` NOT called; a ref with `Location::` but no coords → `geocode` called once, `writeCoordinates` called with the result, marker produced; a ref with neither → no marker, one entry in `failures`.
  - Test: `npm test` — fails.

- [ ] Task 4.2: `loadMarkers` — GREEN
  - File: `src/markers.ts` (new)
  - Change: `type Marker = {uid, type, label, lat, lng}`. `loadMarkers(mapBlockUid, deps)`: `getReferences` → for each ref, `getCoordinates(uid)`; if present, build marker; else `getLocation(uid)` → if present `geocode(uid, text)` → on result `writeCoordinates` + marker, on null → failure; if no location → failure. Return `{markers, failures}`. Label via `getLabel(ref)` (page: `getPageTitleByPageUid`; block: `getTextByBlockUid`).
  - Test: `npm test` — 4.1 passes.

- [ ] Task 4.3: Wire `loadMarkers` into `Maps.tsx` state
  - File: `src/components/Maps.tsx`
  - Change: on mount, resolve `blockUid` via `getUidsFromId(blockId)` (research.md FA4), call `loadMarkers` with real deps + a module-level `createGeocoder()` instance; store `markers`/`failures` in state; render a `<Marker>` per marker.
  - Test: manual in Roam — reference two located pages under `{{[[atlas]]}}`; two pins appear; a page missing `Location::` increments a "couldn't map (N)" notice (Task 4.6).

- [ ] Task 4.4: Auto-fit viewport via a child `FitBounds` component
  - File: `src/components/Maps.tsx`
  - Change: child component calling `useMap()` (research.md FA5); in an effect keyed on `markers`, when ≥1 marker, `map.fitBounds(L.latLngBounds(markers.map(m=>[m.lat,m.lng])), { padding:[24,24], maxZoom: 15 })`. Progressive: refits as markers state grows.
  - Test: manual — map frames all pins; adding a marker re-fits.

- [ ] Task 4.5: Popup + click/shift-click navigation (page vs block)
  - File: `src/components/Maps.tsx`, `src/components/AliasPreview.tsx` (new, clean-room reimplement of Roam-markup popup via `roamjs-components/marked` `getParseInline`), `src/components/hooks.ts` (new, `useTreeByHtmlId` helper)
  - Change: `<Popup>` renders the node's rendered markup. On marker click: `type==="page"` → `ui.mainWindow.openPage({page:{uid}})`, `type==="block"` → `ui.mainWindow.openBlock({block:{uid}})`; shift-click → `openBlockInSidebar(uid)` (research.md FA4).
  - Test: manual — click a page pin opens the page; click a block pin opens the block; shift-click opens sidebar.

- [ ] Task 4.6: "couldn't map (N)" notice
  - File: `src/components/Maps.tsx`
  - Change: if `failures.length`, render a small overlay listing count + labels; never blanks the map (structure error-handling).
  - Test: manual — a referenced page with no `Location::` appears in the notice, other pins still render.

- [ ] Task 4.7: Reactivity via `addPullWatch` — RED/GREEN + manual
  - File: `tests/reactivity.test.ts` (new), `src/components/Maps.tsx`
  - Change (impl): on mount, `window.roamAlphaAPI.data.addPullWatch("[:block/children :block/string]", \`[:block/uid "${blockUid}"]\`, cb)` where `cb` re-runs `loadMarkers`; cleanup calls `removePullWatch` with the identical `(pattern, entityId, cb)` tuple (research.md FA7). Extract the register/unregister into a testable `watchBlockChildren(blockUid, cb)` returning a cleanup fn. Change (test): with `installFakeRoam`, `watchBlockChildren` registers a watch; the fake firing a child change invokes `cb`; cleanup calls `removePullWatch`.
  - Test: `npm test` green. Manual: add a new `[[Page]]` child under the map block → a new pin appears without editing/re-rendering the block.

- [ ] Commit Phase 4 — "Map render pipeline: markers, auto-fit, popups, navigation, failure notice, live reactivity"

## Phase 5: Widget UX (resize + full-screen)

- [ ] Task 5.1: Confirm `:block/props` persistence early (manual spike)
  - File: n/a (Roam console)
  - Change: in Roam, `await window.roamAlphaAPI.updateBlock({block:{uid:"<a real block>", props:{":roamjs-atlas":{height:321}}}})` then `window.roamAlphaAPI.pull("[:block/props]", [":block/uid","<uid>"])` — confirm the prop persists (resolves research.md FA3 caveat before building on it).
  - Test: manual — the pulled props contain `{":roamjs-atlas":{height:321}}`. If it does NOT persist, stop and fall back to session-only height (structure Out-of-Scope note).

- [ ] Task 5.2: `blockProps` height read/write — RED/GREEN
  - File: `tests/blockProps.test.ts` (new), `src/blockProps.ts` (new)
  - Change: `getMapHeight(uid)` reads `pull("[:block/props]", [":block/uid",uid])?.[":block/props"]?.[":roamjs-atlas"]?.height`; `setMapHeight(uid,h)` `updateBlock` merging existing props (don't clobber other `:roamjs-*` keys). Test with `installFakeRoam`: set then get returns the value; setting height preserves an unrelated existing prop key.
  - Test: `npm test` green.

- [ ] Task 5.3: Resize drag handle
  - File: `src/components/Maps.tsx`
  - Change: bottom-edge handle; on drag, `setHeight` (React state) and `map.invalidateSize()` (research.md FA5); on drag-end, `setMapHeight(blockUid, h)`. On mount, initialize height from `getMapHeight(blockUid)` (fallback to default).
  - Test: manual — drag resizes the map; reload the page → height retained.

- [ ] Task 5.4: Full-screen toggle (session-only)
  - File: `src/components/Maps.tsx`, `src/index.ts` (overlay CSS)
  - Change: control button toggles a `position:fixed` full-viewport class on the container; call `map.invalidateSize()` on enter and exit (research.md FA5); `Esc` key exits. No persistence.
  - Test: manual — button fills viewport and tiles render correctly; `Esc` exits back to inline size.

- [ ] Commit Phase 5 — "Widget UX: drag-resize persisted to :block/props, session full-screen overlay"

---

## Definition of done
- `npm test` green (Phases 1–5 unit/flow tests).
- `npm run build:roam` succeeds.
- Manual in Roam: `{{[[atlas]]}}`/`{{atlas}}` renders on type; curated page + block refs pin and auto-fit; geocode caches `Coordinates::` back once; clicks navigate; adding a child adds a pin live; resize persists across reload; full-screen toggles.

# Research: roam-atlas build (with {{[[atlas]]}} rename)
Date: 2026-07-05
Decisions: [decisions.md](decisions.md)

Sources: pinned library docs/GitHub (react-leaflet@3.0.2, leaflet@1.7.1,
roamjs-components@0.80.3, @samepage/scripts) and the reference implementation on
disk at `/Users/ryansonnek/Projects/mapbox`. `node_modules` is not installed in
either repo and Context7 is not a connected MCP in this session, so library
internals were read from GitHub source at the pinned versions.

## FA1: Inline-param component `{{[[atlas]]: height=500}}` — feasibility (drives D3)
**Findings:**
- A block's string is plain text; the `{{...}}` render is derived from `:block/string` at display time. `updateBlock({ block: { uid, string } })` can rewrite that string (e.g. `{{[[atlas]]}}` → `{{[[atlas]]: height=500}}`) and Roam re-derives `:block/refs` automatically. Mechanism confirmed; no verbatim official example of rewriting a component's inline arg specifically. Ref: roamjs-components `types/native.ts:420-455`, `types/index.ts:97-98`.
- **Risk — the trigger match may break.** `createButtonObserver` matches on strict case-insensitive equality of the rendered button's `innerText` against the shortcut (see FA2). If an inline `: height=500` bleeds into the button's visible `innerText` (rendering as `atlas: height=500`), the `=== "ATLAS"` gate fails and the component would not render. Whether Roam (a) still renders `{{[[atlas]]: height=500}}` as a `.bp3-button` at all, and (b) what `innerText` it emits, is **not determinable from library source** — it depends on Roam's own DOM rendering and needs a live browser check.
- Net: the write path (rewrite block string) is confirmed; the *render/match* path for inline params is unconfirmed and is the single feasibility gate for D3's preferred option.

## FA2: `createButtonObserver` — does one observer match both `{{atlas}}` and `{{[[atlas]]}}`? (drives D1)
**Findings:**
- Signature: `createButtonObserver({ attribute, render, shortcut = attribute })`. Delegates to `createHTMLObserver({ tag: "BUTTON", className: "bp3-button" })`, firing on every existing and newly-inserted `<button class="bp3-button">`. Ref: roamjs-components `dom/createButtonObserver.ts`, `dom/createHTMLObserver.ts`.
- Match gate (case-insensitive strict equality, not substring):
  `b.innerText.toUpperCase() === attribute.toUpperCase().replace(/-/g," ")` **or** `=== shortcut.toUpperCase()`. A `data-roamjs-${attribute}` attribute is set as a render-once guard.
- The observer does no bracket-stripping. Roam renders both `{{atlas}}` and `{{[[atlas]]}}` as a `.bp3-button` whose `innerText` is the bare word `atlas`, so a single `shortcut: "atlas"` observer matches **both** forms. Confirmed at the logic level (equality is the only gate); the claim that both forms yield `innerText === "atlas"` rests on Roam's rendering, **not on library source** — partially unconfirmed until seen live.
- Reference uses `createButtonObserver({ shortcut: "maps", attribute: "leaflet", render })` at `~/Projects/mapbox/src/index.ts:12-16`.

## FA3: Reading/writing `:block/props` (D3 fallback)
**Findings:**
- Read: `window.roamAlphaAPI.pull("[:block/props]", [":block/uid", uid])`. `:block/props` is a nested map storing per-block render metadata (image/iframe sizes, slider/pomodoro state) and arbitrary extension data under `:roamjs-*` keys. Ref: roamjs-components `types/native.ts:255-270`; `getFullTreeByParentUid` already pulls `:block/props` and normalizes it to `props.imageResize`/`props.iframe` (`native.ts:365-384`).
- Write: community typings put `props?: Record<string, unknown>` on the write actions' `block`/`page`, i.e. `updateBlock({ block: { uid, props } })` / `createBlock(... props ...)`. Ref: `native.ts:449`.
- **Unconfirmed:** no official-doc statement that `updateBlock` persists `:block/props`; the write path rests only on the community typing. Treat as needing a live confirm if used.

## FA4: roamjs-components utilities for attributes, child writes, ref resolution, navigation
**Findings:**
- **Read a tree:** `queries/getFullTreeByParentUid(uid): TreeNode` — recursive pull, children sorted by `:block/order`; returns `{text, uid, order, children[], props, ...}`. Used in reference `hooks.ts:3,10`.
- **Attribute/value readers (exist, unused by reference):**
  - `util/getSettingValueFromTree({ key, parentUid?, tree?, defaultValue? }): string` — finds the `key` child (flexible/case-insensitive regex on trimmed text), returns its **first child's** text. The standard "read one attribute value by key" helper.
  - `util/getSettingValuesFromTree({ tree, key, defaultValue }): string[]` — same, returns **all** children's text (multi-value).
  - `util/getSubTree({ key, parentUid?, order, tree? }): RoamBasicNode` — finds (or, if `parentUid` given, creates) the `key` child node.
- **Idempotent config write-back:** `util/setInputSetting({ blockUid, value, key, index=0 }): Promise<string>` — finds the `key` child under `blockUid`; updates its first child if present, else creates key + value blocks. Imported at reference `Maps.tsx:25` **but never called** (dead import — the intended write-back path).
- **Low-level writes (from roamAlphaAPI):** `createBlock({ location:{ "parent-uid", order }, block:{ string, uid? } })` (`order`: `0` top, `-1`/`"last"` bottom; `uid` optional/self-suppliable); `updateBlock({ block:{ uid, string? } })`. Ref: `native.ts:420-455`.
- **Reading `Attribute:: value`:** stored as a child whose `:block/string` is literally `"Location:: <value>"`, plus a `:block/refs` edge to the `[[Location]]` page. Two reliable read routes: (a) string route — read children strings, match those starting with `Location::`, split on `::` (this matches the reference's own child-matching style in `Maps.tsx:48-102`); (b) ref route — datalog join `[?c :block/refs ?a] [?a :node/title "Location"]`. Roam's internal `:entity/attrs`/`:attrs/lookup` index exists (`native.ts:242-254`) but has **no documented usage example** — treat direct querying of it as unconfirmed; use string or `:block/refs` routes.
- **Ref resolution (page vs block):** `:block/refs` holds both page and block refs and doesn't label the kind. Distinguish by child string pattern (`[[...]]`/`#...` = page ref; `((uid))` = block ref, 9-char uid) or by pulling the target (page target has `:node/title`; block target has `:block/string`). Resolve a page title to uid with `queries/getPageUidByPageTitle(title): string` (= `pull("[:block/uid]", [":node/title", title])`); a block ref's uid is the `((uid))` contents itself. Ref: `native.ts:272,281-283`; reference `Maps.tsx:140,232-238`, `AliasPreview.tsx:7`.
- **Navigation:** `ui.mainWindow.openPage({ page: { uid } })`, `ui.mainWindow.openBlock({ block: { uid } })`; sidebar via `ui.rightSidebar.addWindow({ window: { type: "block", "block-uid": uid } })` (also `outline`→`page-uid`, `mentions`→`mentions-uid`). Helper `writes/openBlockInSidebar(uid)` checks `getWindows()` then adds/opens. Reference: plain click → `openPage` (`Maps.tsx:145-147`), shift-click → `openBlockInSidebar` (`Maps.tsx:143`).
- **DOM/text helpers used by reference:** `dom/getUidsFromId(id): {blockUid, windowId}` (blockUid = last 9 chars); `queries/getTextByBlockUid`, `getPageTitleByPageUid`, `getPageTitleByBlockUid`; `util/extractTag(tag)` (strips `#[[...]]`/`[[...]]`/leading `#`/trailing `::`).

## FA5: react-leaflet@3 — auto-fit bounds + invalidateSize
**Findings:**
- **Map instance in v3:** `MapContainer` has a `whenCreated?: (map) => void` prop (fires once). **Removed in v4** (v4 uses a `ref` instead) — so the extension must stay on v3 patterns. Alternatively `useMap()` inside a child component returns the instance. Reference uses both: `whenCreated` stashing into a ref (`Maps.tsx:298-312`) and `useMap()` in the child `Markers` (`Maps.tsx:112`). `MapContainer` props besides `children` are immutable after first render. Ref: react-leaflet `v3.0.2/packages/react-leaflet/src/MapContainer.tsx`; CHANGELOG v4.
- **Auto-fit:** `map.fitBounds(bounds, { padding?, maxZoom? })` where `bounds` = `L.latLngBounds(latlngs)` or an array `[[lat,lng], ...]`. `maxZoom` caps over-zoom on a single/tight cluster; `padding` is px kept clear. For progressive marker loads, hold the instance (stashed ref or `useMap`) and call `fitBounds` in an effect keyed on the markers state as it grows. Reference does **not** currently fit bounds — it sets static `center`/`zoom` (`Maps.tsx:307-309`). API stable across leaflet 1.x. Ref: leafletjs.com/reference.html.
- **`invalidateSize(options|animate)`:** re-reads container size and re-renders after a dynamic resize or hidden→visible transition (Leaflet does not observe the container). Options: `animate`, `pan` (default true), `debounceMoveend`. Reference calls it in `whenCreated` (`Maps.tsx:301`) and in `fixHeight` after height change (`Maps.tsx:255`).
- **Full-screen via CSS overlay:** promote the container to `position: fixed` full-viewport, then call `invalidateSize()` after the box actually changes (and again on exit). Same mechanism the reference uses for dynamic height. No Leaflet.fullscreen plugin or browser Fullscreen API needed.

## FA6: `samepage test` harness — mocking roamAlphaAPI + network
**Findings:**
- `samepage test` (from `@samepage/scripts`) wraps **Playwright Test** in **c8** coverage. Tests live in a top-level `tests/` dir; two projects — `unit` (`testMatch` = anything not "integration") and `integration` (`/integration/`). Ref: samepage.network `package/scripts/test.ts`, `package/testing/playwright.config.ts`.
- Unit tests run in **Node + jsdom** (`package/testing/setupJsdom.ts` — `runScripts:"dangerously"`, assigns `global.window`/`document`, `MutationObserver`, event constructors, `setupRegistry({ appRoot: document.body })`). Because they run in jsdom (not a real browser page), Playwright `page.route()` network interception does **not** apply to unit tests.
- **Mocking is not a built-in feature.** `setupJsdom.ts` does **not** define `window.roamAlphaAPI` and does **not** mock `fetch`/`axios`; jsdom provides no global `fetch`. Each test must assign `window.roamAlphaAPI = { pull, q, createBlock, updateBlock, ui:{...} }` and stub network itself. The exact convention is **unconfirmed** from source. Confirmed: the `test` script exists, runner is Playwright+c8, `tests/` layout with unit/integration split, jsdom is provided. The reference repo has **no `tests/` dir and no tests**.

## Patterns Observed
- Reference reads config by matching child block text (`getZoom`/`getCenter`/`getFilter`/`getMarkers`, `Maps.tsx:48-102`) rather than using the library's `getSettingValueFromTree`/`getSubTree` helpers — those helpers exist and do the same job more robustly.
- Marker interaction is wired imperatively after render via `map._layers` and a `MutationObserver` on popups (`Maps.tsx:129-202`), not through react-leaflet event props.
- Page-title→uid and click-through use roamjs-components query helpers + `ui.mainWindow`/`openBlockInSidebar` (`Maps.tsx:139-148`).
- Extension bootstrap is `runExtension(async () => { createButtonObserver(...); addStyle(...); return cleanup })` (`index.ts`).

## Constraints Discovered
- **D3 preferred option (inline params) has an unverified render/match gate.** `createButtonObserver` matches on exact `innerText === "ATLAS"`; if Roam renders `{{[[atlas]]: height=500}}` with the param in the button's `innerText`, the match fails and nothing renders. Feasibility of the inline-param form cannot be settled from source and needs a live browser spike before committing. The `:block/props` fallback (FA3) is confirmable in code, though its write persistence is only community-typed, not officially documented.
- **Must pin react-leaflet at v3.** `whenCreated` (used for grabbing the map instance to call `fitBounds`/`invalidateSize`) does not exist in v4+; upgrading would force a `ref`-based rewrite.
- **Test infrastructure is greenfield.** No `tests/` dir, no roamAlphaAPI/fetch mock convention in the harness. TDD requires first establishing a local test helper that installs a fake `window.roamAlphaAPI` and stubs the geocoder's network call; the harness gives jsdom but nothing Roam-specific.
- **Nominatim client is fully custom.** No roamjs-components/geocoding helper exists; the serialized 1-req/sec queue, in-flight dedupe, and User-Agent/identification requirement are all new code (consistent with the design doc).
- **Attribute reads have no first-class API.** Reading `Location::`/`Coordinates::` values is via string-parse or `:block/refs` join; the internal `:entity/attrs` index is undocumented for direct use.

## FA7 (addendum): Reactivity — refresh on child add/remove (drives Phase 4)
**Findings:**
- **API path/signature (confirmed):** `window.roamAlphaAPI.data.addPullWatch(pullPattern: string, entityId: string, callback: (before: PullBlock|null, after: PullBlock|null) => void): boolean`. Cleanup: `removePullWatch(pullPattern, entityId, callback)` with the **identical** three arguments; a different pattern string or callback closure won't match and leaks the watch. Source: roamjs-components `types/native.ts:509-513`, `types/index.ts:111-165`.
- **Direct-child add/remove fires — confirmed by live usage.** RoamJS `workbench` `src/features/tagCycle.ts:122-179` watches a block with pattern `"[:block/children :block/string]"` and entity-id `[:block/uid "<uid>"]`, then diffs `before[":block/children"]` vs `after[":block/children"]` by `:db/id`. Adding/removing/reordering a **direct child** fires; editing a direct child's string (in-pattern) fires.
- **Descendants do NOT fire a single-level watch** (partially unconfirmed for recursive patterns). A grandchild change alters the grandchild's parent's `:block/children`, not the watched block's projection. **Not a problem here:** our marker references are direct children of the `{{[[atlas]]}}` block, and referenced nodes' `Location::` edits live on *other* pages — already out of scope (block-scoped reactivity only, per structure).
- **Entity-id format:** a Datalog lookup-ref string, e.g. `[:block/uid "abc123"]` (passed as its string serialization) or numeric `:db/id`.
- **Callback delivers before/after; you diff yourself** — there is no "child added" event. For our case we can simply re-read the markers on any fire rather than diffing.
- **MutationObserver fallback** (what the reference uses): `new MutationObserver(...)` + `observe(container, { childList: true, subtree: true })` + `disconnect()` on cleanup (reference `Maps.tsx:153-201`). Observes rendered DOM (only expanded/rendered blocks), not graph data.
- **Decision for /plan:** use `addPullWatch` on the map block (`[:block/uid "<blockUid>"]`, pattern `"[:block/children :block/string]"`), re-read markers on fire, `removePullWatch` on unmount. Sources: workbench `tagCycle.ts:122-179`; reference `Maps.tsx:153-201`.

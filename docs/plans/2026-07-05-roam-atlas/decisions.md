# Decisions: roam-atlas build (with {{[[atlas]]}} rename)
Date: 2026-07-05

Context: Build the Roam Atlas extension per
`docs/plans/2026-07-05-roam-atlas-design.md`. This QRSPI run was triggered by
the component rename and captures decisions the rename surfaces. The design doc
remains the authority for the data model, geocoding, view behavior, and scope;
these decisions refine or supersede specific points in it.

## D1: Component trigger form
**Question:** Which trigger form(s) should activate the Atlas component?
**Options considered:**
- `{{[[atlas]]}}` only — strict page-ref form, cleanest break from `{{maps}}`; bare `{{atlas}}` renders nothing.
- Both `{{[[atlas]]}}` and `{{atlas}}` — tolerant, mirrors how Roam accepts `{{kanban}}` and `{{[[kanban]]}}`.
**Chosen:** Both `{{[[atlas]]}}` and `{{atlas}}`.
**Rationale:** Matches Roam's own leniency and avoids "why is nothing rendering"
confusion, while the documented/canonical form stays `{{[[atlas]]}}`. This
supersedes the design doc's `{{maps}}` trigger throughout.

## D2: Plugin-written attribute naming
**Question:** How should the plugin-written attributes be named?
**Options considered:**
- Generic (`Coordinates::`) — reusable by other tools, readable, minor collision risk.
- Atlas-namespaced (`atlas/coordinates::`) — collision-proof but noisier and not reusable.
**Chosen:** `Coordinates::` stays generic. `Location::` is unchanged (the user's
existing text convention). **No `Height::` attribute** — see D3.
**Rationale:** Coordinates are genuinely reusable graph data; a generic name lets
the page and other tools use them. Collision risk is low and acceptable.

## D3: Map height persistence (no attribute page)
**Question:** How should a resized map's height persist without polluting the
graph? (A `Height::` attribute would spawn a `[[Height]]` page and backlink it
from every resized map — rejected.)
**Options considered:**
- Inline param in the component definition, e.g. `{{[[atlas]]: height=500}}` — self-describing, no page, no props lookup, no child clutter. Feasibility unconfirmed.
- Block props — store in the map block's hidden `:block/props` via roamAlphaAPI; persists, invisible, page-free.
- Session-only — no persistence; resets on reload.
- Plain child text block — visible, page-free, but clutters the marker list.
**Chosen (FINAL):** Session-only — resize adjusts height in React state for the
current session; it resets to the auto-fit default on reload. No persistence, no
graph writes.
**Rationale:** The block-props plan was invalidated by live spikes (research.md
FA3, 2026-07-05). `updateBlock` REPLACES the entire `:block/props` map (not
merge), and Roam applies a non-uniform colon keyword transform to keys on the
read/write round-trip, with no roamjs-components helper to abstract it. Safely
persisting our height without clobbering other extensions' props would require a
fragile recursive colon-normalized read-modify-write carrying real
data-corruption risk — not worth it for a height nicety. The inline-param form
was already rejected (render/match gate, FA1/FA2). Session-only is zero-write,
zero-pollution (aligns with the user's stance against graph pollution), and
zero-risk. Persistence can be revisited if a robust props approach emerges.

## Unchanged from the design doc
- Located node = any page or block with a `Location::` text attribute; one code path, type-branch only at label/navigation.
- Graph is the cache: geocode once, write `Coordinates::` back, reuse everywhere.
- Zero Mapbox: OpenStreetMap tiles, Nominatim geocoding.
- Curated references (page refs + block refs) as the map's children.
- Serialized 1-req/sec geocode queue, idempotent write-back, in-flight dedupe.
- Auto-fit viewport (no manual center/zoom in v1); progressive pin-in.
- Full-screen as a session-only CSS overlay.
- Block-scoped reactivity (re-read on the map block's own child changes only).
- Deferred: query/tag/context selection, alternative styles, auto-re-geocoding, graph-wide reactivity.

## Research Focus Areas
- Does Roam render `{{[[atlas]]: height=500}}` (or another inline-param syntax) as a clickable component? Can the containing block's text be read and updated via roamAlphaAPI to persist the param on resize? (Drives D3.)
- How does `roamjs-components/dom/createButtonObserver` match triggers — does one observer catch both `{{atlas}}` and `{{[[atlas]]}}`, or is separate detection needed? (Drives D1.)
- How to read/write a block's `:block/props` via roamAlphaAPI (D3 fallback).
- Which roamjs-components utilities exist for: reading a node's child attributes (`Location::` / `Coordinates::`), creating a child block idempotently (write-back), resolving page refs vs block refs from a block's children, and opening a block vs a page (label/navigation branch).
- react-leaflet@3 API for programmatic bounds fitting (auto-fit) and `invalidateSize` (resize + full-screen), given the pinned versions in package.json.
- samepage `test` harness: how to mock `window.roamAlphaAPI` and outbound network so the geocode queue, dedupe, and write-back can be tested TDD-style.

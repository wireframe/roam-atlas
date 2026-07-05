# Roam Atlas — Design

**Date:** 2026-07-05
**Status:** Design agreed, ready for implementation planning
**Audience:** Anyone implementing or reviewing Roam Atlas.

## Purpose

A Roam extension that renders an interactive map of *located* pages and blocks. A located node is any page or block carrying a `Location::` text address. You reference the nodes you want under a `{{maps}}` block; Atlas geocodes each address once, caches the coordinates back into the graph, and pins it. The graph is both the source of truth and the cache.

This is a clean-room implementation. The [RoamJS Mapbox extension](https://github.com/RoamJS/mapbox) is a behavioral reference only — no code is copied.

## Guiding decisions

These were settled during brainstorming and bound the design:

- **Tight Roam integration over map features.** No alternative map styles in v1.
- **Curated references**, not queries: a map lists the specific pages/blocks it shows.
- **The graph is the cache.** Geocoded coordinates are written back onto the node as a sibling attribute, reused by every map and by the page itself.
- **Zero Mapbox dependency.** OpenStreetMap tiles, Nominatim geocoding. Both are free and stay within rate limits because we geocode each node once, ever.

## Data model

The unit is a **located node** — any page or block with a `Location::` attribute among its direct children. Roam attributes are just blocks, so the shape is identical for pages and blocks.

A place page:

```
[[Ferry Building]]
  Location:: Ferry Building, San Francisco, CA
  Coordinates:: 37.7955, -122.3937      ← plugin-written
```

A place block:

```
- Met a client at the Ferry Building ((abc123))
  - Location:: Ferry Building, San Francisco, CA
  - Coordinates:: 37.7955, -122.3937    ← plugin-written
```

A map references either kind by page ref or block ref:

```
{{maps}}
  - [[Ferry Building]]        ← page ref
  - ((abc123))                ← block ref
```

`Location::` is typed by a human. `Coordinates::` is written by the plugin and treated as a cache. `Height::` (see UX) is written by the plugin when the user resizes.

## Core render flow

Per referenced node, one code path for both pages and blocks:

1. Resolve the reference to a node UID.
2. Read the node's child `Coordinates::`. Present and parseable → pin it. No network, no write.
3. Absent → read child `Location::`, geocode the text, **write `Coordinates::` back as a child of that node**, then pin.
4. `Location::` missing, or geocode fails → skip and report visibly.

Type only branches at label and navigation:

- Page ref → label is the page title; click opens the page.
- Block ref → label is the block text; click opens the block (shift-click → sidebar).

## Geocoding & write-back

- **When we geocode:** only when a node has `Location::` but no `Coordinates::`. Cached nodes are pure reads.
- **Rate limiting:** Nominatim's public server allows ~1 request/second and forbids parallel/bulk geocoding. Geocoding runs through a **serialized 1-req/sec queue**. Cached pins render instantly; uncached ones drain through the queue in the background and pin as they resolve.
- **Idempotent write-back:** before writing `Coordinates::`, confirm the node has none. An in-memory in-flight set keyed by node UID dedupes concurrent geocodes when two maps reference the same uncached node.
- **Staleness (v1):** `Coordinates::` present means "don't touch." To refresh after editing a `Location::`, delete the stale `Coordinates::`. Automatic drift detection is deferred.

## Map view behavior

- **Auto-fit only.** The viewport always fits the bounds of the resolved markers. No manual center/zoom config in v1 (dropped for simplicity).
- **Progressive pin-in.** Cached nodes pin immediately; uncached ones appear as the geocode queue drains, and the viewport re-fits as they land.
- **Popups** reuse the existing Roam-markup rendering: a page pin shows page content, a block pin shows block text.
- **Reactivity is block-scoped.** Re-read markers when the `{{maps}}` block's own children change (add/remove a reference). Do not live-watch every referenced node across the graph for `Location::` edits — deferred as a rare, costly need.

## Widget UX

- **Resize:** a drag handle on the bottom edge. On drag, set container height and call `map.invalidateSize()`. Persist the height back to the block as a `Height::` attribute (same write-back pattern), so a resized map stays resized across reloads.
- **Full-screen:** a control button toggling the map into a fixed overlay filling the viewport; `invalidateSize()` on enter, `Esc` to exit. Session-only. Implemented as a CSS overlay (not the browser Fullscreen API) so it stays in Roam's DOM and click-through keeps working.

Both are view-only concerns wrapping `MapContainer`; they never touch the location/geocode layer.

## Architecture

New modules, small and single-purpose:

- **`location.ts`** — the graph-as-cache layer. `getLocation(uid)` / `getCoordinates(uid)` read the `Location::` / `Coordinates::` child attributes; `writeCoordinates(uid, coords)` does the idempotent write-back. Owns the attribute convention.
- **`geocode.ts`** — Nominatim client wrapped in the serialized 1-req/sec queue plus the in-flight dedupe set. Pure text-in, coords-out.
- **`references.ts`** — parses a `{{maps}}` block's children into resolved node UIDs, each tagged `page` or `block` (drives the label/navigation branch).

Composition:

- **`index.ts`** — `runExtension`, the `maps` button observer, and styles (single OSM tile layer, no `LayersControl`, no Mapbox token).
- **`Maps.tsx`** — resolve references → render cached pins → drain the geocode queue → auto-fit. Owns marker interaction, popups, and the resize/full-screen wrapper.

## Error handling

Per-marker failures degrade; they never blank the map:

- No `Location::` on a referenced node → skip, add to a visible "couldn't map (N)" notice.
- Geocode returns nothing / network fails → skip + report, write no `Coordinates::` (retries next render).
- `Coordinates::` present but unparseable → skip with a notice; never overwrite human-typed data.
- Reference points at a deleted node → skip silently.

Map-level failure (can't read the block tree) → render nothing rather than a broken half-state (crash-early).

## Testing

TDD via the `samepage test` runner, red-green-refactor:

- **`references.ts`** — parses page refs, block refs, mixed lists; ignores non-reference children.
- **`location.ts`** — reads attributes; `writeCoordinates` is idempotent and refuses to overwrite existing coords.
- **`geocode.ts`** — with a mocked Nominatim: requests serialize (never parallel), the in-flight set dedupes, the 1-req/sec throttle holds.
- **Flow test** — mocked `roamAlphaAPI` + mocked geocoder: a cached node pins with zero network calls; an uncached node geocodes once and writes back.

## Deferred (not v1)

- Query/tag-scoped and context-scoped marker selection.
- Alternative map styles / tile providers.
- Automatic re-geocoding on `Location::` change.
- Graph-wide reactivity to remote node edits.

## Related documents

- [README](../../README.md) — usage.
- [RoamJS Mapbox](https://github.com/RoamJS/mapbox) — behavioral reference implementation.

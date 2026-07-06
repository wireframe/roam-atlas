# Roam Atlas Backlog

**Purpose:** A running list of enhancement ideas for Roam Atlas, with enough context to pick one up later.
**Audience:** Anyone extending Atlas — capture the idea, the reason, and any constraints before you build.

Atlas's guiding constraint is **no account and no API key**. Favor features that stay keyless (native Leaflet, small Leaflet plugins, CARTO/Esri/OpenTopo tiles, client-side turf.js computation) over anything that needs a token or someone's demo server.

## Prioritized

### Scale bar
Add a scale control so readers can orient the map — judging real distances between pins is hard without one.

- **Why:** Orientation. A pin cluster is ambiguous at a glance; a scale bar tells you whether it spans a city block or a country.
- **How:** Native Leaflet (`L.control.scale`), no dependency, no key.

### Marker clustering
Group dense pins at low zoom so overlapping markers stay readable, and spiderfy them on click.

- **Why:** A recurring pain — maps with many nearby locations collapse into an unreadable pile.
- **How:** `leaflet.markercluster` plugin (mature, keyless). Handles both clustering and spiderfying overlapping pins.

### Base-layer toggle

Let readers switch the map's look with a layer control, and follow the Roam theme automatically.

- **Why:** One map style doesn't fit every use — a street map, a dark theme, satellite imagery, and terrain each suit different graphs. All the good options below are keyless.
- **How:** Native Leaflet (`L.control.layers`), no dependency. A tight, all-keyless spread that covers every use without decision fatigue:

  | Layer | Look | Source |
  |---|---|---|
  | Voyager | Colorful default | CARTO |
  | Positron | Light / minimal | CARTO |
  | Dark Matter | Dark | CARTO |
  | Satellite | Aerial imagery | Esri |
  | Terrain | Topo / contours | OpenTopoMap |

- **Theme-aware auto-switch:** Follow the Roam light/dark theme without a manual toggle — Positron in light, Dark Matter in dark.
- **Label-free variants:** CARTO's "no-labels" base maps let pins and their tooltips carry the text without fighting baked-in map labels — cleaner busy maps.
- **Off-limits (need a key):** Stamen (Watercolor/Toner, now via Stadia), Thunderforest, Mapbox, MapTiler, Jawg.

## Other ideas

See the map-features exploration for the fuller catalog. Leverageable and keyless:

- **Color/icon by tag** — DivIcon markers colored by tag with a legend.
- **Drag-to-place pins** — leaflet-geoman / Leaflet.draw, writing coordinates back to the graph.
- **Route/itinerary lines** — native polylines connecting pins in reference order.
- **On-map search box** — leaflet-control-geocoder wrapping Nominatim.
- **Query-driven maps** — populate pins from a Roam query/attribute instead of a manual reference list.
- **GeoJSON import/export** — round-trip located data with other tools.
- **Configurable location/coordinate attributes** — Atlas hardcodes `Location::` and `Coordinates::`; let users point it at their own attribute names (e.g. `Address::`) so it fits existing graph conventions instead of forcing Atlas's. Keyless — just a setting read at parse time. See `src/location.ts`.

## Related Documents

- [Design](plans/2026-07-05-roam-atlas-design.md) — the original Atlas design.
- [README](../README.md) — user-facing overview.

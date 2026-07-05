# Roam Atlas

**Map your located Roam pages and blocks.** Give any page or block a `Location::` attribute with a text address, reference it under a `{{[[atlas]]}}` block, and Atlas geocodes it, caches the coordinates back into your graph, and pins it on an interactive map. Click a pin to open its page or block.

No Mapbox, no API token. Tiles come from OpenStreetMap and geocoding from Nominatim — both free, because Atlas geocodes each place exactly once and stores the result in your graph.

## Usage

**1. Give a page or block a location.** Add a `Location::` attribute with a text address:

```
[[Ferry Building]]
  Location:: Ferry Building, San Francisco, CA
```

A block works the same way — put `Location::` as a child of the block.

**2. Reference it under a map.** Type `{{[[atlas]]}}` (or the bare `{{atlas}}`) in a block and add page or block references as children:

```
{{[[atlas]]}}
  - [[Ferry Building]]
  - [[Golden Gate Park]]
  - ((abc123))
```

When the block renders, Atlas geocodes each `Location::` it hasn't seen before, writes a `Coordinates::` attribute back onto that page/block, and drops a pin. The map auto-fits to show every pin.

The next time any map references the same page, it reuses the cached `Coordinates::` — no geocoding, instant render.

## Reference implementation

This is a clean-room reimplementation. The [RoamJS Mapbox extension](https://github.com/RoamJS/mapbox) (which uses `{{maps}}`) was used only as a behavioral reference for how a `{{...}}` button component renders inside Roam.

See [`docs/plans/2026-07-05-roam-atlas-design.md`](docs/plans/2026-07-05-roam-atlas-design.md) for the full design.

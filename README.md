# Roam Atlas

**Map your located Roam pages and blocks.** Give any page or block a `Location::` attribute with a text address, reference it under a `{{[[atlas]]}}` block, and Atlas geocodes it, caches the coordinates back into your graph, and pins it on an interactive map.

![An Atlas map with pins across Tokyo and an open pin popup showing a place's name and address](https://raw.githubusercontent.com/wireframe/roam-atlas/main/docs/images/map.png)

No Mapbox, no API token. Tiles come from OpenStreetMap (via CARTO) and geocoding from Nominatim — both free, because Atlas geocodes each place exactly once and stores the result in your graph.

## Usage

**1. Give a page or block a location.** Add a `Location::` attribute with a text address:

```
[[Ferry Building]]
  Location:: Ferry Building, San Francisco, CA
```

A block works the same way — put `Location::` as a child of the block. The first time Atlas geocodes a place, it writes a `Coordinates::` attribute back onto the same page or block, so every later render reads the cached pair instead of hitting the network again.

![A located page showing its Location attribute and the Coordinates Atlas wrote back](https://raw.githubusercontent.com/wireframe/roam-atlas/main/docs/images/located-page.png)

**2. Reference the places under a map.** Type `{{[[atlas]]}}` (or the bare `{{atlas}}`) in a block and add page or block references as children:

```
{{[[atlas]]}}
  - [[Ferry Building]]
  - [[Golden Gate Park]]
  - ((abc123))
```

![An atlas block with four page references listed as children](https://raw.githubusercontent.com/wireframe/roam-atlas/main/docs/images/references.png)

The map auto-fits to show every pin and re-renders as you add or remove references. A reference it can't place — no `Location::`, or an address the geocoder doesn't recognize — is listed in a small corner note, so one missing location never blanks the map.

**3. Read and open a pin.** Click a pin to open its popup: the page or block's text, plus its address when one is set. Click the popup heading to jump to that page or block (shift-click opens it in the right sidebar). Drag the map's bottom edge to resize it, or use the ⛶ button in the corner for a full-screen view (Esc exits).

## Reference implementation

This is a clean-room reimplementation. The [RoamJS Mapbox extension](https://github.com/RoamJS/mapbox) (which uses `{{maps}}`) was used only as a behavioral reference for how a `{{...}}` button component renders inside Roam.

See [`docs/plans/2026-07-05-roam-atlas-design.md`](docs/plans/2026-07-05-roam-atlas-design.md) for the full design.

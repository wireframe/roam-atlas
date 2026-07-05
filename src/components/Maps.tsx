import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { MapContainer, Marker as MarkerPin, Popup, TileLayer, useMap } from "react-leaflet";
import L, { Icon, LatLngExpression, LeafletMouseEvent, Map } from "leaflet";
import ComponentContainer from "roamjs-components/components/ComponentContainer";
import getUidsFromId from "roamjs-components/dom/getUidsFromId";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import { getReferences, ResolvedReference } from "../references";
import { getCoordinates, getLocation, writeCoordinates } from "../location";
import { createGeocoder } from "../geocode";
import { loadMarkers, Failure, Marker, MarkerDeps } from "../markers";
import { watchBlockChildren } from "../reactivity";
import AliasPreview from "./AliasPreview";

const DEFAULT_HEIGHT = 400;
const DEFAULT_ZOOM = 13;
const DEFAULT_CENTER = [51.505, -0.09] as LatLngExpression;
const FIT_OPTIONS = { padding: [24, 24] as [number, number], maxZoom: 15 };

const geocoder = createGeocoder();

// Leaflet's bundled default icon resolves its images via relative paths that
// break under a bundler, so pins render invisibly; point it at the CDN assets.
const markerIcon = new Icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const labelOf = (ref: ResolvedReference): string =>
  ref.type === "page"
    ? getPageTitleByPageUid(ref.uid)
    : getTextByBlockUid(ref.uid);

const markerDeps = (): MarkerDeps => ({
  getReferences,
  getLabel: labelOf,
  getLocation,
  getCoordinates,
  geocode: geocoder.geocode,
  writeCoordinates,
});

const openNode = (marker: Marker): void => {
  if (marker.type === "page") {
    window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid: marker.uid } });
  } else {
    window.roamAlphaAPI.ui.mainWindow.openBlock({ block: { uid: marker.uid } });
  }
};

const navigateTo = (marker: Marker) => (e: LeafletMouseEvent): void => {
  if (e.originalEvent.shiftKey) {
    openBlockInSidebar(marker.uid);
  } else {
    openNode(marker);
  }
};

// Auto-fits the viewport to every pin, re-fitting as pins stream in.
const FitBounds = ({ markers }: { markers: Marker[] }): null => {
  const map = useMap();
  useEffect(() => {
    if (!markers.length) return;
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
    map.fitBounds(bounds, FIT_OPTIONS);
  }, [map, markers]);
  return null;
};

const MarkerPins = ({ markers }: { markers: Marker[] }): JSX.Element => (
  <>
    {markers.map((marker) => (
      <MarkerPin
        key={marker.uid}
        position={[marker.lat, marker.lng]}
        icon={markerIcon}
        eventHandlers={{ click: navigateTo(marker) }}
      >
        <Popup>
          <AliasPreview label={marker.label} />
        </Popup>
      </MarkerPin>
    ))}
  </>
);

// Corner overlay naming the refs that could not be mapped. It is layered over
// the map, never in place of it, so a geocoding gap can never blank the view.
const FailureNotice = ({ failures }: { failures: Failure[] }): JSX.Element | null => {
  if (!failures.length) return null;
  return (
    <div className="roamjs-atlas-notice">
      <strong>{`couldn't map (${failures.length})`}</strong>
      <ul>
        {failures.map((failure) => (
          <li key={failure.uid}>{failure.label || failure.uid}</li>
        ))}
      </ul>
    </div>
  );
};

const Maps = ({ blockId }: { blockId: string }): JSX.Element => {
  const { blockUid } = getUidsFromId(blockId);
  const generation = useRef(0);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);

  // A watch-driven reload can start while an earlier load's geocodes are still
  // in flight. Bumping the generation makes each load capture its own id; only
  // the current load may mutate state, so a superseded load's late markers and
  // failures are dropped rather than duplicating pins or writing stale results.
  const reload = useCallback(() => {
    generation.current += 1;
    const loadId = generation.current;
    const isCurrent = () => generation.current === loadId;
    setMarkers([]);
    setFailures([]);
    loadMarkers(blockUid, markerDeps(), (marker) => {
      if (isCurrent()) setMarkers((current) => [...current, marker]);
    }).then((result) => {
      if (isCurrent()) setFailures(result.failures);
    });
  }, [blockUid]);

  useEffect(() => {
    reload();
    return watchBlockChildren(blockUid, reload);
  }, [blockUid, reload]);

  // Leaflet caches the container's pixel size at creation. When the block first
  // paints the container can still be 0/narrow, so an immediate invalidateSize
  // is a no-op; deferring past the first paint lets it pick up the real width.
  const whenCreated = useCallback((m: Map) => {
    requestAnimationFrame(() => m.invalidateSize());
  }, []);

  return (
    <ComponentContainer blockId={blockId} className="roamjs-atlas-container">
      <div style={{ position: "relative", width: "100%" }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: DEFAULT_HEIGHT, width: "100%" }}
          whenCreated={whenCreated}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            detectRetina
          />
          <MarkerPins markers={markers} />
          <FitBounds markers={markers} />
        </MapContainer>
        <FailureNotice failures={failures} />
      </div>
    </ComponentContainer>
  );
};

export const render = (b: HTMLButtonElement): void => {
  const block = b.closest(".roam-block");
  if (!block || !b.parentElement) {
    return;
  }
  b.parentElement.onmousedown = (e: MouseEvent) => e.stopPropagation();
  ReactDOM.render(<Maps blockId={block.id} />, b.parentElement);
};

export default Maps;

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, Marker as MarkerPin, Popup, TileLayer, useMap } from "react-leaflet";
import L, { Icon, LatLngExpression, Map } from "leaflet";
import ComponentContainer from "roamjs-components/components/ComponentContainer";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import getUidsFromId from "roamjs-components/dom/getUidsFromId";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import { getReferences, ResolvedReference } from "../references";
import { getCoordinates, getLocation, writeCoordinates } from "../location";
import { createGeocoder } from "../geocode";
import { loadMarkers, upsertByUid, Failure, Marker, MarkerDeps } from "../markers";
import { watchBlockChildren } from "../reactivity";
import { clampHeight } from "../height";
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

// The marker itself only surfaces the popup; opening the node is a deliberate
// second click on the popup heading. Shift-click sends it to the right sidebar.
const openFromPopup = (marker: Marker) => (e: React.MouseEvent): void => {
  if (e.shiftKey) {
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

// Leaflet caches the container's pixel size, so a state-driven resize or a
// full-screen toggle leaves the map painting at its stale dimensions until we
// tell it to remeasure. Running this through a useMap() child keeps us on the
// react-leaflet v3 idiom rather than reintroducing a stored map ref.
const InvalidateOnChange = ({
  height,
  isFullscreen,
}: {
  height: number;
  isFullscreen: boolean;
}): null => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map, height, isFullscreen]);
  return null;
};

// Popup for a pin: the node's text as a clickable heading that opens it, plus
// the human-readable location line when the source attribute is still present.
const MarkerPopup = ({ marker }: { marker: Marker }): JSX.Element => (
  <div className="roamjs-atlas-popup">
    <span
      className="roamjs-atlas-popup-heading"
      onClick={openFromPopup(marker)}
      title="Open (shift-click for right sidebar)"
    >
      <AliasPreview label={marker.label} />
    </span>
    {marker.location && (
      <div className="roamjs-atlas-popup-location">{marker.location}</div>
    )}
  </div>
);

const MarkerPins = ({ markers }: { markers: Marker[] }): JSX.Element => (
  <>
    {markers.map((marker) => (
      <MarkerPin key={marker.uid} position={[marker.lat, marker.lng]} icon={markerIcon}>
        <Popup>
          <MarkerPopup marker={marker} />
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

// Thin strip along the map's bottom edge; dragging it resizes the widget.
const ResizeHandle = ({
  onResizeStart,
}: {
  onResizeStart: (e: React.MouseEvent) => void;
}): JSX.Element => (
  <div className="roamjs-atlas-resize-handle" onMouseDown={onResizeStart} />
);

const FullscreenToggle = ({
  isFullscreen,
  onToggle,
}: {
  isFullscreen: boolean;
  onToggle: () => void;
}): JSX.Element => (
  <button
    type="button"
    className="roamjs-atlas-fullscreen-toggle"
    onClick={onToggle}
    title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
  >
    {isFullscreen ? "×" : "⛶"}
  </button>
);

const Maps = ({ blockId }: { blockId: string }): JSX.Element => {
  const { blockUid } = getUidsFromId(blockId);
  const generation = useRef(0);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // A watch-driven reload can start while an earlier load's geocodes are still
  // in flight. Each load captures its own generation id; only the current load
  // may mutate state, so a superseded load's streamed and final results are
  // dropped rather than duplicating pins or clobbering the newer load.
  //
  // We never blank the map: pins stream in via upsert over the currently-shown
  // set (cached ones immediately, geocoded ones as they resolve), then the
  // completed load's authoritative result reconciles order and drops refs that
  // are gone. A ref that fails to resolve emits nothing, so it can never remove
  // the pins that did resolve.
  const reload = useCallback(() => {
    generation.current += 1;
    const loadId = generation.current;
    const isCurrent = () => generation.current === loadId;
    loadMarkers(blockUid, markerDeps(), (marker) => {
      if (isCurrent()) setMarkers((current) => upsertByUid(current, marker));
    }).then((result) => {
      if (!isCurrent()) return;
      setMarkers(result.markers);
      setFailures(result.failures);
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

  // Drag-to-resize is session-only: height lives in React state, never in the
  // graph. We track the drag on `document` so the pointer can leave the thin
  // handle mid-drag, and suppress text selection while the button is held.
  // The active drag's teardown is held in a ref so an unmount mid-drag (e.g. a
  // navigation or graph reload) can detach the listeners before a stray mouseup
  // calls setHeight on an unmounted component.
  const endResize = useRef<() => void>();
  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;
      const onMove = (move: MouseEvent) =>
        setHeight(clampHeight(startHeight + (move.clientY - startY)));
      const teardown = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = "";
        endResize.current = undefined;
      };
      function onUp(): void {
        teardown();
      }
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      endResize.current = teardown;
    },
    [height]
  );

  useEffect(() => () => endResize.current?.(), []);

  const toggleFullscreen = useCallback(() => setIsFullscreen((on) => !on), []);

  // Escape exits full screen; the listener only exists while it is on.
  useEffect(() => {
    if (!isFullscreen) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  return (
    <ComponentContainer blockId={blockId} className="roamjs-atlas-container">
      <div
        className={
          isFullscreen
            ? "roamjs-atlas-widget roamjs-atlas-fullscreen"
            : "roamjs-atlas-widget"
        }
        style={{ position: "relative", width: "100%", height }}
      >
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
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
          <InvalidateOnChange height={height} isFullscreen={isFullscreen} />
        </MapContainer>
        <FullscreenToggle isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
        {!isFullscreen && <ResizeHandle onResizeStart={startResize} />}
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
  // renderWithUnmount watches for Roam removing the block DOM (virtualization on
  // scroll, navigation) and unmounts the tree, so every useEffect cleanup runs:
  // the pull-watch is removed, the Escape listener is detached, and any active
  // drag is torn down. Raw ReactDOM.render would leak all three.
  renderWithUnmount(<Maps blockId={block.id} />, b.parentElement);
};

export default Maps;

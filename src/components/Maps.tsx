import React, { useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { MapContainer, TileLayer } from "react-leaflet";
import { LatLngExpression, Map } from "leaflet";
import ComponentContainer from "roamjs-components/components/ComponentContainer";

const DEFAULT_HEIGHT = 400;
const DEFAULT_ZOOM = 13;
const DEFAULT_CENTER = [51.505, -0.09] as LatLngExpression;

const Maps = ({ blockId }: { blockId: string }): JSX.Element => {
  const mapInstance = useRef<Map>();
  const whenCreated = useCallback((m: Map) => {
    mapInstance.current = m;
    m.invalidateSize();
  }, []);
  return (
    <ComponentContainer blockId={blockId}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: DEFAULT_HEIGHT }}
        whenCreated={whenCreated}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
      </MapContainer>
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

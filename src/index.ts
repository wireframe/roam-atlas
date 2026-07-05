import runExtension from "roamjs-components/util/runExtension";
import createButtonObserver from "roamjs-components/dom/createButtonObserver";
import addStyle from "roamjs-components/dom/addStyle";
import { render } from "./components/Maps";

export default runExtension(async () => {
  const observer = createButtonObserver({
    shortcut: "atlas",
    attribute: "atlas",
    render,
  });

  const link = document.createElement("link");
  link.href = "https://unpkg.com/leaflet@1.7.1/dist/leaflet.css";
  link.rel = "stylesheet";
  document.head.appendChild(link);

  const style = addStyle(`.leaflet-pane {
      z-index: 10 !important;
    }

    /* ComponentContainer defaults to width: fit-content, which collapses the
       map to its minWidth; force it to fill the block instead. */
    .roamjs-atlas-container {
      width: 100% !important;
    }

    a.leaflet-popup-close-button {
      display: none;
    }

    /* Popup heading doubles as the open-node affordance; the location line
       below it is read-only context. */
    .roamjs-atlas-popup-heading {
      cursor: pointer;
      font-weight: 600;
      color: #106ba3;
    }

    .roamjs-atlas-popup-heading:hover {
      text-decoration: underline;
    }

    .roamjs-atlas-popup-location {
      margin-top: 4px;
      font-size: 12px;
      color: #5c7080;
    }

    .roamjs-atlas-notice {
      position: absolute;
      bottom: 8px;
      right: 8px;
      z-index: 1000;
      max-width: 240px;
      padding: 6px 10px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      font-size: 12px;
      color: #182026;
    }

    .roamjs-atlas-notice ul {
      margin: 4px 0 0;
      padding-left: 16px;
    }

    /* Subtle grab strip along the map's bottom edge; drag to resize. */
    .roamjs-atlas-resize-handle {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 8px;
      z-index: 1000;
      cursor: ns-resize;
      background: rgba(0, 0, 0, 0.05);
    }

    .roamjs-atlas-resize-handle:hover {
      background: rgba(0, 0, 0, 0.15);
    }

    .roamjs-atlas-fullscreen-toggle {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 1000;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      font-size: 16px;
      line-height: 28px;
      color: #182026;
    }

    /* Session-only full-screen overlay; layered above Roam's UI. */
    .roamjs-atlas-fullscreen {
      position: fixed !important;
      inset: 0;
      z-index: 9999 !important;
      width: 100vw !important;
      height: 100vh !important;
    }
    `);

  return () => {
    observer.disconnect();
    link.remove();
    style.remove();
  };
});

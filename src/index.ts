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
    `);

  return () => {
    observer.disconnect();
    link.remove();
    style.remove();
  };
});

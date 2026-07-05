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

    a.leaflet-popup-close-button {
      display: none;
    }
    `);

  return () => {
    observer.disconnect();
    link.remove();
    style.remove();
  };
});

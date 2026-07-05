import { test, expect } from "@playwright/test";
import {
  parseCoordinates,
  getAttributeValue,
  getLocation,
  getCoordinates,
  writeCoordinates,
} from "../src/location";
import { installFakeRoam, resetFakeRoam } from "./helpers/roam";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";

test.afterEach(() => resetFakeRoam());

// --- parseCoordinates ------------------------------------------------------

test("parseCoordinates reads a lat, lng pair", () => {
  expect(parseCoordinates("37.7955, -122.3937")).toEqual([37.7955, -122.3937]);
});

test("parseCoordinates tolerates surrounding and inner whitespace", () => {
  expect(parseCoordinates("  37.7955 ,   -122.3937  ")).toEqual([
    37.7955, -122.3937,
  ]);
});

test("parseCoordinates rejects non-numeric text", () => {
  expect(parseCoordinates("garbage")).toBeNull();
});

test("parseCoordinates rejects the wrong arity", () => {
  expect(parseCoordinates("1,2,3")).toBeNull();
});

test("parseCoordinates rejects an empty string", () => {
  expect(parseCoordinates("")).toBeNull();
});

test("parseCoordinates rejects a non-finite parse", () => {
  expect(parseCoordinates("37.7955, abc")).toBeNull();
});

test("parseCoordinates rejects a trailing blank component", () => {
  expect(parseCoordinates("37, ")).toBeNull();
});

test("parseCoordinates rejects a trailing empty component", () => {
  expect(parseCoordinates("37,")).toBeNull();
});

test("parseCoordinates rejects two empty components", () => {
  expect(parseCoordinates(",")).toBeNull();
});

// --- getAttributeValue -----------------------------------------------------

test("getAttributeValue reads a Location value", () => {
  const children = [{ text: "Location:: Ferry Building, San Francisco, CA" }];
  expect(getAttributeValue(children, "Location")).toBe(
    "Ferry Building, San Francisco, CA"
  );
});

test("getAttributeValue reads a Coordinates value", () => {
  const children = [{ text: "Coordinates:: 37.7955, -122.3937" }];
  expect(getAttributeValue(children, "Coordinates")).toBe("37.7955, -122.3937");
});

test("getAttributeValue trims the block text and the returned value", () => {
  const children = [{ text: "   Location::   San Francisco   " }];
  expect(getAttributeValue(children, "Location")).toBe("San Francisco");
});

test("getAttributeValue returns undefined when the attribute is absent", () => {
  const children = [{ text: "just a note" }];
  expect(getAttributeValue(children, "Location")).toBeUndefined();
});

test("getAttributeValue is not fooled by :: appearing mid-text", () => {
  const children = [{ text: "see also Location:: elsewhere" }];
  expect(getAttributeValue(children, "Location")).toBeUndefined();
});

// --- getLocation -----------------------------------------------------------

test("getLocation returns the Location attribute value of a node", () => {
  installFakeRoam([
    {
      uid: "node-uid",
      string: "Ferry Building",
      children: [{ string: "Location:: Ferry Building, San Francisco, CA" }],
    },
  ]);
  expect(getLocation("node-uid")).toBe("Ferry Building, San Francisco, CA");
});

test("getLocation returns undefined for a node without a Location", () => {
  installFakeRoam([
    { uid: "node-uid", string: "Ferry Building", children: [{ string: "note" }] },
  ]);
  expect(getLocation("node-uid")).toBeUndefined();
});

// --- getCoordinates --------------------------------------------------------

test("getCoordinates parses the Coordinates attribute of a node", () => {
  installFakeRoam([
    {
      uid: "node-uid",
      string: "Ferry Building",
      children: [{ string: "Coordinates:: 37.7955, -122.3937" }],
    },
  ]);
  expect(getCoordinates("node-uid")).toEqual([37.7955, -122.3937]);
});

test("getCoordinates returns null for a node without Coordinates", () => {
  installFakeRoam([
    { uid: "node-uid", string: "Ferry Building", children: [{ string: "note" }] },
  ]);
  expect(getCoordinates("node-uid")).toBeNull();
});

test("getCoordinates returns null for an unparseable Coordinates value", () => {
  installFakeRoam([
    {
      uid: "node-uid",
      string: "Ferry Building",
      children: [{ string: "Coordinates:: garbage" }],
    },
  ]);
  expect(getCoordinates("node-uid")).toBeNull();
});

// --- writeCoordinates ------------------------------------------------------

const coordinateChildren = (nodeUid: string): string[] =>
  getFullTreeByParentUid(nodeUid)
    .children.map((child) => child.text)
    .filter((text) => text.trim().startsWith("Coordinates::"));

test("writeCoordinates adds exactly one Coordinates child when none exists", async () => {
  installFakeRoam([{ uid: "node-uid", string: "Ferry Building" }]);

  await writeCoordinates("node-uid", [37.7955, -122.3937]);

  expect(coordinateChildren("node-uid")).toEqual([
    "Coordinates:: 37.7955, -122.3937",
  ]);
});

test("writeCoordinates is idempotent across repeated calls", async () => {
  installFakeRoam([{ uid: "node-uid", string: "Ferry Building" }]);

  await writeCoordinates("node-uid", [37.7955, -122.3937]);
  await writeCoordinates("node-uid", [37.7955, -122.3937]);

  expect(coordinateChildren("node-uid")).toEqual([
    "Coordinates:: 37.7955, -122.3937",
  ]);
});

test("writeCoordinates writes exactly one Coordinates child under concurrent same-uid calls", async () => {
  const api = installFakeRoam([{ uid: "node-uid", string: "Ferry Building" }]);
  // Model Roam's async write: the mutation is not observable until the promise
  // settles, so two unguarded writers both read the pre-write state and race.
  const realCreateBlock = api.createBlock;
  api.createBlock = (args) =>
    new Promise((resolve) => setTimeout(() => resolve(realCreateBlock(args)), 0));

  await Promise.all([
    writeCoordinates("node-uid", [37.7955, -122.3937]),
    writeCoordinates("node-uid", [37.7955, -122.3937]),
  ]);

  expect(coordinateChildren("node-uid")).toEqual([
    "Coordinates:: 37.7955, -122.3937",
  ]);
});

test("writeCoordinates never overwrites an existing Coordinates value", async () => {
  installFakeRoam([
    {
      uid: "node-uid",
      string: "Ferry Building",
      children: [{ string: "Coordinates:: 1, 2" }],
    },
  ]);

  await writeCoordinates("node-uid", [37.7955, -122.3937]);

  expect(coordinateChildren("node-uid")).toEqual(["Coordinates:: 1, 2"]);
});

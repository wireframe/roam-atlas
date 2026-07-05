import { test, expect } from "@playwright/test";
import { loadMarkers, Marker, MarkerDeps } from "../src/markers";

const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

const stubDeps = (overrides: Partial<MarkerDeps> = {}): MarkerDeps => ({
  getReferences: () => [],
  getLabel: (ref) => ref.uid,
  getLocation: () => undefined,
  getCoordinates: () => null,
  geocode: async () => null,
  writeCoordinates: async () => {},
  ...overrides,
});

test("a cached ref becomes a marker without geocoding", async () => {
  let geocodeCalls = 0;
  const emitted: Marker[] = [];
  const deps = stubDeps({
    getReferences: () => [{ uid: "u1", type: "page" }],
    getLabel: () => "Ferry Building",
    getCoordinates: (uid) => (uid === "u1" ? [37.8, -122.4] : null),
    geocode: async () => {
      geocodeCalls += 1;
      return null;
    },
  });

  const { markers, failures } = await loadMarkers("map", deps, (m) =>
    emitted.push(m)
  );

  expect(markers).toEqual([
    { uid: "u1", type: "page", label: "Ferry Building", lat: 37.8, lng: -122.4 },
  ]);
  expect(failures).toEqual([]);
  expect(geocodeCalls).toBe(0);
  expect(emitted).toEqual(markers);
});

test("an uncached located ref geocodes, caches, and becomes a marker", async () => {
  const geocoded: [string, string][] = [];
  const written: [string, [number, number]][] = [];
  const emitted: Marker[] = [];
  const deps = stubDeps({
    getReferences: () => [{ uid: "u1", type: "block" }],
    getLabel: () => "Ferry Building",
    getLocation: (uid) => (uid === "u1" ? "Ferry Building" : undefined),
    geocode: async (uid, text) => {
      geocoded.push([uid, text]);
      return [37.8, -122.4];
    },
    writeCoordinates: async (uid, coords) => {
      written.push([uid, coords]);
    },
  });

  const { markers, failures } = await loadMarkers("map", deps, (m) =>
    emitted.push(m)
  );

  expect(geocoded).toEqual([["u1", "Ferry Building"]]);
  expect(written).toEqual([["u1", [37.8, -122.4]]]);
  expect(markers).toEqual([
    {
      uid: "u1",
      type: "block",
      label: "Ferry Building",
      lat: 37.8,
      lng: -122.4,
    },
  ]);
  expect(failures).toEqual([]);
  expect(emitted).toEqual(markers);
});

test("a ref with no coordinates and no location is a no-location failure", async () => {
  let geocodeCalls = 0;
  const deps = stubDeps({
    getReferences: () => [{ uid: "u1", type: "page" }],
    getLabel: () => "Nowhere",
    geocode: async () => {
      geocodeCalls += 1;
      return null;
    },
  });

  const { markers, failures } = await loadMarkers("map", deps);

  expect(markers).toEqual([]);
  expect(failures).toEqual([
    { uid: "u1", type: "page", label: "Nowhere", reason: "no-location" },
  ]);
  expect(geocodeCalls).toBe(0);
});

test("a located ref whose geocode returns null is a geocode-failed failure and is not cached", async () => {
  let writeCalls = 0;
  const deps = stubDeps({
    getReferences: () => [{ uid: "u1", type: "block" }],
    getLabel: () => "Atlantis",
    getLocation: () => "Atlantis",
    geocode: async () => null,
    writeCoordinates: async () => {
      writeCalls += 1;
    },
  });

  const { markers, failures } = await loadMarkers("map", deps);

  expect(markers).toEqual([]);
  expect(failures).toEqual([
    { uid: "u1", type: "block", label: "Atlantis", reason: "geocode-failed" },
  ]);
  expect(writeCalls).toBe(0);
});

test("a mixed set splits into markers and failures, preserving reference order", async () => {
  const emitted: Marker[] = [];
  const deps = stubDeps({
    getReferences: () => [
      { uid: "cached", type: "page" },
      { uid: "located", type: "block" },
      { uid: "lost", type: "page" },
    ],
    getLabel: (ref) => ref.uid,
    getCoordinates: (uid) => (uid === "cached" ? [1, 2] : null),
    getLocation: (uid) => (uid === "located" ? "Somewhere" : undefined),
    geocode: async () => [3, 4],
  });

  const { markers, failures } = await loadMarkers("map", deps, (m) =>
    emitted.push(m)
  );

  expect(markers).toEqual([
    { uid: "cached", type: "page", label: "cached", lat: 1, lng: 2 },
    { uid: "located", type: "block", label: "located", lat: 3, lng: 4 },
  ]);
  expect(failures).toEqual([
    { uid: "lost", type: "page", label: "lost", reason: "no-location" },
  ]);
  expect(emitted.length).toBe(markers.length);
});

test("cached markers emit before slower geocoded markers regardless of reference order", async () => {
  const emitted: string[] = [];
  const deps = stubDeps({
    getReferences: () => [
      { uid: "located", type: "block" },
      { uid: "cached", type: "page" },
    ],
    getLabel: (ref) => ref.uid,
    getCoordinates: (uid) => (uid === "cached" ? [1, 2] : null),
    getLocation: (uid) => (uid === "located" ? "Somewhere" : undefined),
    geocode: async () => {
      await tick();
      return [3, 4];
    },
  });

  const { markers } = await loadMarkers("map", deps, (m) => emitted.push(m.uid));

  expect(emitted).toEqual(["cached", "located"]);
  expect(markers.map((m) => m.uid)).toEqual(["located", "cached"]);
});

test("a throwing dependency for one ref yields a failure without failing the rest", async () => {
  const deps = stubDeps({
    getReferences: () => [
      { uid: "boom", type: "page" },
      { uid: "cached", type: "block" },
    ],
    getLabel: (ref) => {
      if (ref.uid === "boom") throw new Error("bad ref");
      return ref.uid;
    },
    getCoordinates: (uid) => (uid === "cached" ? [1, 2] : null),
  });

  const { markers, failures } = await loadMarkers("map", deps);

  expect(markers).toEqual([
    { uid: "cached", type: "block", label: "cached", lat: 1, lng: 2 },
  ]);
  expect(failures.length).toBe(1);
  expect(failures[0].uid).toBe("boom");
});

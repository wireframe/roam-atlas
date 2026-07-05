import { test, expect } from "@playwright/test";
import { createGeocoder } from "../src/geocode";

const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

// --- parse + errors (3.1 / 3.2) --------------------------------------------

test("geocode resolves the parsed coordinate of the first result", async () => {
  const geocoder = createGeocoder({
    search: async () => [{ lat: "37.79", lon: "-122.39" }],
    delay: async () => {},
  });

  expect(await geocoder.geocode("u1", "X")).toEqual([37.79, -122.39]);
});

test("geocode resolves null when the search returns no results", async () => {
  const geocoder = createGeocoder({
    search: async () => [],
    delay: async () => {},
  });

  expect(await geocoder.geocode("u1", "X")).toBeNull();
});

test("geocode resolves null (never rejects) when the search throws", async () => {
  const geocoder = createGeocoder({
    search: async () => {
      throw new Error("network down");
    },
    delay: async () => {},
  });

  expect(await geocoder.geocode("u1", "X")).toBeNull();
});

test("geocode resolves null when a result parses to a non-finite number", async () => {
  const geocoder = createGeocoder({
    search: async () => [{ lat: "not-a-number", lon: "-122.39" }],
    delay: async () => {},
  });

  expect(await geocoder.geocode("u1", "X")).toBeNull();
});

// --- in-flight dedupe by uid (3.3) -----------------------------------------

test("concurrent geocodes of the same uid share a single search", async () => {
  let calls = 0;
  const geocoder = createGeocoder({
    search: async () => {
      calls += 1;
      return [{ lat: "1", lon: "2" }];
    },
    delay: async () => {},
  });

  const [a, b] = await Promise.all([
    geocoder.geocode("u1", "X"),
    geocoder.geocode("u1", "X"),
  ]);

  expect(calls).toBe(1);
  expect(a).toEqual(b);
});

test("a uid can be geocoded again once its previous call settles", async () => {
  let calls = 0;
  const geocoder = createGeocoder({
    search: async () => {
      calls += 1;
      return [{ lat: "1", lon: "2" }];
    },
    delay: async () => {},
  });

  await geocoder.geocode("u1", "X");
  await geocoder.geocode("u1", "X");

  expect(calls).toBe(2);
});

// --- serialized 1-req/sec queue (3.4) --------------------------------------

test("distinct uids never run their searches in parallel", async () => {
  let active = 0;
  let maxActive = 0;
  const geocoder = createGeocoder({
    search: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await tick();
      active -= 1;
      return [{ lat: "1", lon: "2" }];
    },
    delay: async () => {},
  });

  await Promise.all([
    geocoder.geocode("u1", "A"),
    geocoder.geocode("u2", "B"),
    geocoder.geocode("u3", "C"),
  ]);

  expect(maxActive).toBe(1);
});

test("successive requests are spaced by delay(minIntervalMs)", async () => {
  const delays: number[] = [];
  const geocoder = createGeocoder({
    search: async () => [{ lat: "1", lon: "2" }],
    delay: async (ms) => {
      delays.push(ms);
    },
    minIntervalMs: 5,
  });

  await Promise.all([
    geocoder.geocode("u1", "A"),
    geocoder.geocode("u2", "B"),
    geocoder.geocode("u3", "C"),
  ]);

  // Three requests are spaced by two delays, each of the configured interval.
  expect(delays).toEqual([5, 5]);
});

test("a throwing delay resolves null and does not poison the queue", async () => {
  let searchCalls = 0;
  const geocoder = createGeocoder({
    search: async () => {
      searchCalls += 1;
      return [{ lat: "1", lon: "2" }];
    },
    delay: async () => {
      throw new Error("boom");
    },
    minIntervalMs: 5,
  });

  // First request runs before any spacing delay, so it succeeds.
  expect(await geocoder.geocode("u1", "A")).toEqual([1, 2]);
  // Second request awaits the (throwing) delay; it must degrade to null.
  expect(await geocoder.geocode("u2", "B")).toBeNull();
  // The chain is not poisoned: a third request still runs.
  expect(await geocoder.geocode("u3", "C")).toBeNull();
  expect(searchCalls).toBe(1);
});

test("the default throttle interval is 1000ms", async () => {
  const delays: number[] = [];
  const geocoder = createGeocoder({
    search: async () => [{ lat: "1", lon: "2" }],
    delay: async (ms) => {
      delays.push(ms);
    },
  });

  await Promise.all([
    geocoder.geocode("u1", "A"),
    geocoder.geocode("u2", "B"),
  ]);

  expect(delays).toEqual([1000]);
});

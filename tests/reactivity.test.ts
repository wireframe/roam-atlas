import { test, expect } from "@playwright/test";
import { watchBlockChildren } from "../src/reactivity";
import { installFakeRoam, resetFakeRoam } from "./helpers/roam";

test.afterEach(() => resetFakeRoam());

const seedMap = (): void =>
  installFakeRoam([
    {
      uid: "map-uid",
      string: "{{[[atlas]]}}",
      children: [{ uid: "c1", string: "[[A]]" }],
    },
  ]);

const fire = (): void =>
  (window.roamAlphaAPI as unknown as {
    data: { __fire: (entityId: [string, string]) => void };
  }).data.__fire([":block/uid", "map-uid"]);

test("watchBlockChildren invokes onChange when the block's children change", () => {
  seedMap();
  let changes = 0;

  watchBlockChildren("map-uid", () => (changes += 1));
  fire();

  expect(changes).toBe(1);
});

test("the cleanup removes the watch so later changes no longer invoke onChange", () => {
  seedMap();
  let changes = 0;

  const stop = watchBlockChildren("map-uid", () => (changes += 1));
  fire();
  stop();
  fire();

  expect(changes).toBe(1);
});

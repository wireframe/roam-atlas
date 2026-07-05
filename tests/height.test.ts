import { test, expect } from "@playwright/test";
import { clampHeight, MIN_HEIGHT } from "../src/height";

test("clampHeight keeps a height above the minimum unchanged", () => {
  expect(clampHeight(400)).toBe(400);
});

test("clampHeight raises a below-minimum height up to the minimum", () => {
  expect(clampHeight(20)).toBe(MIN_HEIGHT);
});

test("clampHeight holds a height exactly at the minimum", () => {
  expect(clampHeight(MIN_HEIGHT)).toBe(MIN_HEIGHT);
});

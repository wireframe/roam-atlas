import { test, expect } from "@playwright/test";

test("test runner discovers and executes tests", () => {
  expect(1 + 1).toBe(2);
});

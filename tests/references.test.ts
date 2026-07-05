import { test, expect } from "@playwright/test";
import { classifyReference, getReferences } from "../src/references";
import { installFakeRoam, resetFakeRoam } from "./helpers/roam";

test.afterEach(() => resetFakeRoam());

test("classifyReference reads a bracket page ref", () => {
  expect(classifyReference("[[A]]")).toEqual({ type: "page", key: "A" });
});

test("classifyReference reads a hashed bracket page ref", () => {
  expect(classifyReference("#[[A]]")).toEqual({ type: "page", key: "A" });
});

test("classifyReference reads a bare tag page ref", () => {
  expect(classifyReference("#Tag")).toEqual({ type: "page", key: "Tag" });
});

test("classifyReference reads a block ref", () => {
  expect(classifyReference("((abc123))")).toEqual({
    type: "block",
    key: "abc123",
  });
});

test("classifyReference trims surrounding whitespace", () => {
  expect(classifyReference("  [[A]]  ")).toEqual({ type: "page", key: "A" });
});

test("classifyReference rejects plain text", () => {
  expect(classifyReference("Zoom")).toBeNull();
});

test("classifyReference rejects text with an embedded ref", () => {
  expect(classifyReference("went to [[X]] today")).toBeNull();
});

test("classifyReference rejects an empty string", () => {
  expect(classifyReference("")).toBeNull();
});

test("classifyReference rejects a hashed tag containing a space", () => {
  expect(classifyReference("# Tag")).toBeNull();
});

test("classifyReference rejects two refs that are not a single whole ref", () => {
  expect(classifyReference("((a)) ((b))")).toBeNull();
});

test("getReferences resolves curated page and block refs, dropping the rest", () => {
  installFakeRoam([
    {
      uid: "map-uid",
      string: "{{[[atlas]]}}",
      children: [
        { uid: "c1", string: "[[A]]" },
        { uid: "c2", string: "((b1))" },
        { uid: "c3", string: "Zoom" },
        { uid: "c4", string: "[[Ghost]]" },
      ],
    },
    { uid: "page-a-uid", title: "A" },
  ]);

  expect(getReferences("map-uid")).toEqual([
    { uid: "page-a-uid", type: "page" },
    { uid: "b1", type: "block" },
  ]);
});

test("getReferences returns an empty list for a map block with no children", () => {
  installFakeRoam([{ uid: "empty-map-uid", string: "{{[[atlas]]}}" }]);
  expect(getReferences("empty-map-uid")).toEqual([]);
});

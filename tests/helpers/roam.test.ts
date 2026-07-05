import { test, expect } from "@playwright/test";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { installFakeRoam, resetFakeRoam } from "./roam";

const seedGraph = () =>
  installFakeRoam([
    {
      uid: "page-uid",
      title: "Locations",
      children: [
        { uid: "block-a", string: "Portland", props: { atlas: { lat: 1 } } },
        {
          uid: "block-b",
          string: "Seattle",
          children: [{ uid: "block-b1", string: "Ballard" }],
        },
      ],
    },
  ]);

test.afterEach(() => resetFakeRoam());

test("createBlock then pull round-trips the block string", async () => {
  seedGraph();
  await window.roamAlphaAPI.createBlock({
    location: { "parent-uid": "page-uid", order: "last" },
    block: { string: "New York", uid: "block-c" },
  });
  const result = window.roamAlphaAPI.pull("[:block/string]", [
    ":block/uid",
    "block-c",
  ]);
  expect(result?.[":block/string"]).toBe("New York");
});

test("createBlock generates a uid when none is supplied", async () => {
  seedGraph();
  await window.roamAlphaAPI.createBlock({
    location: { "parent-uid": "page-uid", order: "last" },
    block: { string: "Denver" },
  });
  const tree = getFullTreeByParentUid("page-uid");
  const denver = tree.children.find((c) => c.text === "Denver");
  expect(denver?.uid).toBeTruthy();
});

test("createBlock with numeric order inserts and shifts siblings", async () => {
  seedGraph();
  await window.roamAlphaAPI.createBlock({
    location: { "parent-uid": "page-uid", order: 0 },
    block: { string: "First", uid: "block-first" },
  });
  const tree = getFullTreeByParentUid("page-uid");
  expect(tree.children.map((c) => c.text)).toEqual([
    "First",
    "Portland",
    "Seattle",
  ]);
});

test("getFullTreeByParentUid returns the page title and nested children", () => {
  seedGraph();
  const tree = getFullTreeByParentUid("page-uid");
  expect(tree.text).toBe("Locations");
  expect(tree.children.map((c) => c.text)).toEqual(["Portland", "Seattle"]);
  expect(tree.children[1].children[0].text).toBe("Ballard");
});

test("getPageUidByPageTitle resolves the page uid via :node/title lookup", () => {
  seedGraph();
  expect(getPageUidByPageTitle("Locations")).toBe("page-uid");
  expect(getPageUidByPageTitle("Missing")).toBe("");
});

test("getTextByBlockUid resolves block string via :block/uid lookup", () => {
  seedGraph();
  expect(getTextByBlockUid("block-a")).toBe("Portland");
  expect(getTextByBlockUid("missing")).toBe("");
});

test("updateBlock replaces props wholesale, dropping keys not included", async () => {
  installFakeRoam([
    {
      uid: "block-x",
      string: "Boston",
      props: { atlas: { lat: 1, lng: 2 }, keep: true },
    },
  ]);
  await window.roamAlphaAPI.updateBlock({
    block: { uid: "block-x", props: { atlas: { lng: 9 } } },
  });
  const props = window.roamAlphaAPI.pull("[:block/props]", [
    ":block/uid",
    "block-x",
  ])?.[":block/props"] as Record<string, unknown>;
  expect(props).toEqual({ atlas: { lng: 9 } });
});

test("updateBlock updates the block string", async () => {
  seedGraph();
  await window.roamAlphaAPI.updateBlock({
    block: { uid: "block-a", string: "Portland, OR" },
  });
  expect(getTextByBlockUid("block-a")).toBe("Portland, OR");
});

test("openPage and openBlock record their calls for assertions", async () => {
  const api = installFakeRoam([{ uid: "page-uid", title: "Locations" }]);
  await api.ui.mainWindow.openPage({ page: { uid: "page-uid" } });
  await api.ui.mainWindow.openBlock({ block: { uid: "block-a" } });
  expect(api.ui.mainWindow.__openPageCalls).toEqual([
    { page: { uid: "page-uid" } },
  ]);
  expect(api.ui.mainWindow.__openBlockCalls).toEqual([
    { block: { uid: "block-a" } },
  ]);
});

test("pull watches fire with before/after values and can be removed", async () => {
  seedGraph();
  const fired: unknown[] = [];
  const callback = (_before: unknown, after: unknown) => fired.push(after);
  const pattern = "[:block/string]";
  const entityId: [string, string] = [":block/uid", "block-a"];

  window.roamAlphaAPI.data.addPullWatch(pattern, entityId, callback);
  await window.roamAlphaAPI.updateBlock({
    block: { uid: "block-a", string: "Portland Updated" },
  });
  window.roamAlphaAPI.data.__fire(entityId);
  expect(fired).toEqual([{ ":block/string": "Portland Updated" }]);

  window.roamAlphaAPI.data.removePullWatch(pattern, entityId, callback);
  window.roamAlphaAPI.data.__fire(entityId);
  expect(fired).toHaveLength(1);
});

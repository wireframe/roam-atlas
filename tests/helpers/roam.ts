/**
 * In-memory fake of Roam's `window.roamAlphaAPI`, sized to satisfy the exact
 * `pull`/`q` call patterns that our core modules and the roamjs-components
 * helpers they rely on actually issue. Blocks and pages are modelled uniformly
 * as nodes; pages are simply nodes that carry a `:node/title`.
 */

export type RoamSeedNode = {
  uid?: string;
  title?: string;
  string?: string;
  order?: number;
  props?: Record<string, unknown>;
  children?: RoamSeedNode[];
};

type FakeNode = {
  uid: string;
  string?: string;
  title?: string;
  order: number;
  props: Record<string, unknown>;
  children: FakeNode[];
};

type PullEntityId = [string, string];

type PullWatchCallback = (before: unknown, after: unknown) => void;

type PullWatch = {
  pattern: string;
  key: string;
  callback: PullWatchCallback;
  entityId: PullEntityId;
  lastValue: unknown;
};

type FakeState = {
  nodesByUid: Map<string, FakeNode>;
  watches: PullWatch[];
  openPageCalls: unknown[];
  openBlockCalls: unknown[];
  uidCounter: number;
};

const emptyState = (): FakeState => ({
  nodesByUid: new Map(),
  watches: [],
  openPageCalls: [],
  openBlockCalls: [],
  uidCounter: 0,
});

let state: FakeState = emptyState();

const generateUid = (): string => `fake-uid-${(state.uidCounter += 1)}`;

const requireNode = (uid: string): FakeNode => {
  const node = state.nodesByUid.get(uid);
  if (!node) throw new Error(`Fake roamAlphaAPI: no block with uid "${uid}"`);
  return node;
};

const buildNode = (seed: RoamSeedNode, index: number): FakeNode => {
  const uid = seed.uid || generateUid();
  const node: FakeNode = {
    uid,
    string: seed.string,
    title: seed.title,
    order: seed.order ?? index,
    props: seed.props ? { ...seed.props } : {},
    children: [],
  };
  state.nodesByUid.set(uid, node);
  node.children = (seed.children || []).map(buildNode);
  return node;
};

const sortedChildren = (node: FakeNode): FakeNode[] =>
  node.children.slice().sort((a, b) => a.order - b.order);

const nodeToPullMap = (
  node: FakeNode,
  pattern: string
): Record<string, unknown> => {
  const map: Record<string, unknown> = {};
  if (pattern.includes(":block/uid")) map[":block/uid"] = node.uid;
  if (pattern.includes(":block/string") && node.string !== undefined)
    map[":block/string"] = node.string;
  if (pattern.includes(":node/title") && node.title !== undefined)
    map[":node/title"] = node.title;
  if (pattern.includes(":block/order")) map[":block/order"] = node.order;
  if (pattern.includes(":block/props")) map[":block/props"] = { ...node.props };
  if (/\{:block\/children/.test(pattern) && node.children.length)
    map[":block/children"] = sortedChildren(node).map((child) =>
      nodeToPullMap(child, pattern)
    );
  return map;
};

const findEntity = ([attr, value]: PullEntityId): FakeNode | undefined => {
  if (attr === ":node/title")
    return [...state.nodesByUid.values()].find((node) => node.title === value);
  if (attr === ":block/uid") return state.nodesByUid.get(value);
  throw new Error(`Fake roamAlphaAPI.pull: unsupported lookup ref "${attr}"`);
};

const pull = (
  pattern: string,
  entityId: PullEntityId
): Record<string, unknown> | null => {
  const node = findEntity(entityId);
  return node ? nodeToPullMap(node, pattern) : null;
};

// --- Writes ----------------------------------------------------------------

const insertChild = (parent: FakeNode, child: FakeNode, order: number | "last") => {
  if (order === "last") {
    child.order = parent.children.length
      ? Math.max(...parent.children.map((sibling) => sibling.order)) + 1
      : 0;
  } else {
    child.order = order;
    parent.children
      .filter((sibling) => sibling.order >= order)
      .forEach((sibling) => (sibling.order += 1));
  }
  parent.children.push(child);
};

type CreateBlockArgs = {
  location: { "parent-uid": string; order: number | "last" };
  block: { string: string; uid?: string; props?: Record<string, unknown> };
};

const createBlock = ({ location, block }: CreateBlockArgs): Promise<void> => {
  const parent = requireNode(location["parent-uid"]);
  const child: FakeNode = {
    uid: block.uid || generateUid(),
    string: block.string,
    order: 0,
    props: block.props ? { ...block.props } : {},
    children: [],
  };
  insertChild(parent, child, location.order);
  state.nodesByUid.set(child.uid, child);
  return Promise.resolve();
};

type UpdateBlockArgs = {
  block: { uid: string; string?: string; props?: Record<string, unknown> };
};

const updateBlock = ({ block }: UpdateBlockArgs): Promise<void> => {
  const node = requireNode(block.uid);
  if (block.string !== undefined) node.string = block.string;
  if (block.props !== undefined) node.props = { ...block.props };
  return Promise.resolve();
};

// --- Pull watches ----------------------------------------------------------

const watchKey = (entityId: PullEntityId): string => JSON.stringify(entityId);

const addPullWatch = (
  pattern: string,
  entityId: PullEntityId,
  callback: PullWatchCallback
): boolean => {
  state.watches.push({
    pattern,
    key: watchKey(entityId),
    callback,
    entityId,
    lastValue: pull(pattern, entityId),
  });
  return true;
};

const removePullWatch = (
  pattern: string,
  entityId: PullEntityId,
  callback: PullWatchCallback
): boolean => {
  const key = watchKey(entityId);
  const before = state.watches.length;
  state.watches = state.watches.filter(
    (watch) =>
      !(
        watch.pattern === pattern &&
        watch.key === key &&
        watch.callback === callback
      )
  );
  return state.watches.length < before;
};

/** Test-only: fire every pull-watch registered for the given entity. */
const fireWatch = (entityId: PullEntityId): void => {
  const key = watchKey(entityId);
  state.watches
    .filter((watch) => watch.key === key)
    .forEach((watch) => {
      const after = pull(watch.pattern, watch.entityId);
      watch.callback(watch.lastValue, after);
      watch.lastValue = after;
    });
};

const buildApi = () => ({
  createBlock,
  updateBlock,
  pull,
  ui: {
    mainWindow: {
      openPage: (args: unknown) => {
        state.openPageCalls.push(args);
        return Promise.resolve();
      },
      openBlock: (args: unknown) => {
        state.openBlockCalls.push(args);
        return Promise.resolve();
      },
      __openPageCalls: state.openPageCalls,
      __openBlockCalls: state.openBlockCalls,
    },
  },
  data: {
    addPullWatch,
    removePullWatch,
    __fire: fireWatch,
  },
});

const globalWindow = (): Record<string, unknown> => {
  const globalScope = globalThis as unknown as { window?: Record<string, unknown> };
  if (!globalScope.window) globalScope.window = {};
  return globalScope.window;
};

/** Seed the in-memory graph and install it as `window.roamAlphaAPI`. */
export const installFakeRoam = (blocks: RoamSeedNode[] = []) => {
  state = emptyState();
  blocks.forEach(buildNode);
  const api = buildApi();
  globalWindow().roamAlphaAPI = api;
  return api;
};

/** Clear all in-memory state (graph, watches, recorded UI calls). */
export const resetFakeRoam = (): void => {
  installFakeRoam([]);
};

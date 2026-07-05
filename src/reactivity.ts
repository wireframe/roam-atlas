// Roam's `pull` and pull-watch APIs accept a lookup ref as a `[attr, value]`
// vector; roamjs-components uses this same array form for `pull`. The typings
// narrow `addPullWatch`'s entity id to `string`, so we widen locally.
type PullWatchCallback = () => void;

type PullWatchApi = {
  addPullWatch: (pattern: string, entityId: [string, string], cb: PullWatchCallback) => boolean;
  removePullWatch: (pattern: string, entityId: [string, string], cb: PullWatchCallback) => boolean;
};

// Watch a block's direct children (and their text) so added/removed refs
// trigger a reload; `:block/string` catches a child edited into a valid ref.
const CHILDREN_PATTERN = "[{:block/children [:block/uid :block/string]}]";

const entityId = (blockUid: string): [string, string] => [":block/uid", blockUid];

const pullWatch = (): PullWatchApi =>
  window.roamAlphaAPI.data as unknown as PullWatchApi;

/**
 * Watch a map block's direct children and invoke `onChange` whenever they
 * change. Returns a cleanup that removes the watch with the identical
 * `(pattern, entityId, callback)` tuple Roam requires to deregister it.
 */
export const watchBlockChildren = (
  blockUid: string,
  onChange: () => void
): (() => void) => {
  const eid = entityId(blockUid);
  pullWatch().addPullWatch(CHILDREN_PATTERN, eid, onChange);
  return () => pullWatch().removePullWatch(CHILDREN_PATTERN, eid, onChange);
};

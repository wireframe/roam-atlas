import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";

export type Reference = { type: "page" | "block"; key: string };
export type ResolvedReference = { uid: string; type: "page" | "block" };

const BLOCK_REF = /^\(\(([^()]+)\)\)$/;
const HASHED_PAGE_REF = /^#\[\[([^[\]]+)\]\]$/;
const BRACKET_PAGE_REF = /^\[\[([^[\]]+)\]\]$/;
const BARE_TAG_REF = /^#([^\s#[\]()]+)$/;

const page = (key: string): Reference => ({ type: "page", key });
const block = (key: string): Reference => ({ type: "block", key });

const matchBlockRef = (text: string): Reference | null => {
  const match = text.match(BLOCK_REF);
  return match ? block(match[1]) : null;
};

const matchPageRef = (text: string): Reference | null => {
  const match =
    text.match(HASHED_PAGE_REF) ??
    text.match(BRACKET_PAGE_REF) ??
    text.match(BARE_TAG_REF);
  return match ? page(match[1]) : null;
};

/** Classify text as a single whole-string page or block reference, else null. */
export const classifyReference = (text: string): Reference | null => {
  const trimmed = text.trim();
  return matchBlockRef(trimmed) ?? matchPageRef(trimmed);
};

const resolveUid = (reference: Reference): string =>
  reference.type === "block"
    ? reference.key
    : getPageUidByPageTitle(reference.key);

const resolveReference = (reference: Reference | null): ResolvedReference[] => {
  if (!reference) return [];
  const uid = resolveUid(reference);
  return uid ? [{ uid, type: reference.type }] : [];
};

const dedupeByUid = (refs: ResolvedReference[]): ResolvedReference[] => {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.uid)) return false;
    seen.add(ref.uid);
    return true;
  });
};

/**
 * Resolve a map block's curated child references to node uids, in order.
 * A uid that a child resolves to more than once is kept only on first
 * occurrence, so a repeated ref never pins the same node twice.
 */
export const getReferences = (mapBlockUid: string): ResolvedReference[] =>
  dedupeByUid(
    getFullTreeByParentUid(mapBlockUid).children.flatMap((child) =>
      resolveReference(classifyReference(child.text))
    )
  );

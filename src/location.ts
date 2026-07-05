import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";

/** Parse a `"lat, lng"` string into a coordinate pair, or null if malformed. */
export const parseCoordinates = (value: string): [number, number] | null => {
  const parts = value.split(",").map((part) => part.trim());
  if (parts.length !== 2 || parts.some((part) => part === "")) return null;
  const numbers = parts.map(Number);
  if (!numbers.every(Number.isFinite)) return null;
  return [numbers[0], numbers[1]];
};

const attributePrefix = (key: string): string => `${key}::`;

const attributeValue = (text: string, key: string): string | undefined => {
  const trimmed = text.trim();
  const prefix = attributePrefix(key);
  return trimmed.startsWith(prefix)
    ? trimmed.slice(prefix.length).trim()
    : undefined;
};

/** Find the `` `${key}:: <value>` `` child and return its trimmed value. */
export const getAttributeValue = (
  children: { text: string }[],
  key: string
): string | undefined =>
  children
    .map((child) => attributeValue(child.text, key))
    .find((value) => value !== undefined);

const readAttribute = (nodeUid: string, key: string): string | undefined =>
  getAttributeValue(getFullTreeByParentUid(nodeUid).children, key);

/** Read a node's human-typed `Location::` address, if present. */
export const getLocation = (nodeUid: string): string | undefined =>
  readAttribute(nodeUid, "Location");

/** Read and parse a node's cached `Coordinates::` pair, or null. */
export const getCoordinates = (nodeUid: string): [number, number] | null => {
  const value = readAttribute(nodeUid, "Coordinates");
  return value ? parseCoordinates(value) : null;
};

/** Cache coordinates back into the graph, never overwriting existing data. */
export const writeCoordinates = async (
  nodeUid: string,
  [lat, lng]: [number, number]
): Promise<void> => {
  const { children } = getFullTreeByParentUid(nodeUid);
  if (getAttributeValue(children, "Coordinates") !== undefined) return;
  await window.roamAlphaAPI.createBlock({
    location: { "parent-uid": nodeUid, order: children.length },
    block: { string: `Coordinates:: ${lat}, ${lng}` },
  });
};

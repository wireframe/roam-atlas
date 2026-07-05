// The map widget's height is session-only React state; a resize drag must never
// shrink it past a usable size, so every drag update passes through this clamp.
export const MIN_HEIGHT = 150;

export const clampHeight = (height: number): number =>
  Math.max(MIN_HEIGHT, height);

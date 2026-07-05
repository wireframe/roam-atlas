export type Ref = { uid: string; type: "page" | "block" };

export type Marker = {
  uid: string;
  type: "page" | "block";
  label: string;
  lat: number;
  lng: number;
};

export type Failure = {
  uid: string;
  type: "page" | "block";
  label: string;
  reason: "no-location" | "geocode-failed";
};

export type MarkerDeps = {
  getReferences: (mapBlockUid: string) => Ref[];
  getLabel: (ref: Ref) => string;
  getLocation: (uid: string) => string | undefined;
  getCoordinates: (uid: string) => [number, number] | null;
  geocode: (uid: string, text: string) => Promise<[number, number] | null>;
  writeCoordinates: (uid: string, coords: [number, number]) => Promise<void>;
};

type Slot = { marker?: Marker; failure?: Failure };

type OnMarker = (marker: Marker) => void;

const marker = (ref: Ref, label: string, [lat, lng]: [number, number]): Marker => ({
  uid: ref.uid,
  type: ref.type,
  label,
  lat,
  lng,
});

const failure = (ref: Ref, label: string, reason: Failure["reason"]): Failure => ({
  uid: ref.uid,
  type: ref.type,
  label,
  reason,
});

const emit = (marker: Marker, onMarker?: OnMarker): Slot => {
  onMarker?.(marker);
  return { marker };
};

const attemptRef = async (
  ref: Ref,
  deps: MarkerDeps,
  onMarker?: OnMarker
): Promise<Slot> => {
  const label = deps.getLabel(ref);

  const cached = deps.getCoordinates(ref.uid);
  if (cached) return emit(marker(ref, label, cached), onMarker);

  const location = deps.getLocation(ref.uid);
  if (!location) return { failure: failure(ref, label, "no-location") };

  const coordinates = await deps.geocode(ref.uid, location);
  if (!coordinates) return { failure: failure(ref, label, "geocode-failed") };

  await deps.writeCoordinates(ref.uid, coordinates);
  return emit(marker(ref, label, coordinates), onMarker);
};

// A single misbehaving reference must never sink the whole map render, so an
// unexpected throw degrades to a geocode-failed slot rather than propagating.
const resolveRef = async (
  ref: Ref,
  deps: MarkerDeps,
  onMarker?: OnMarker
): Promise<Slot> => {
  try {
    return await attemptRef(ref, deps, onMarker);
  } catch {
    return { failure: failure(ref, "", "geocode-failed") };
  }
};

const markersOf = (slots: Slot[]): Marker[] =>
  slots.flatMap((slot) => (slot.marker ? [slot.marker] : []));

const failuresOf = (slots: Slot[]): Failure[] =>
  slots.flatMap((slot) => (slot.failure ? [slot.failure] : []));

/**
 * Resolve a map block's references into pinnable markers and reportable
 * failures, geocoding only the uncached located ones.
 *
 * References are processed in a single synchronous pass, so cached and
 * unlocatable refs settle immediately while uncached lookups run concurrently
 * against the internally-serialized geocoder. `onMarker` fires per marker as it
 * becomes available — cached pins therefore emit before any geocode resolves —
 * and the returned arrays preserve reference order regardless of settle order.
 */
export const loadMarkers = async (
  mapBlockUid: string,
  deps: MarkerDeps,
  onMarker?: OnMarker
): Promise<{ markers: Marker[]; failures: Failure[] }> => {
  const slots = await Promise.all(
    deps.getReferences(mapBlockUid).map((ref) => resolveRef(ref, deps, onMarker))
  );
  return { markers: markersOf(slots), failures: failuresOf(slots) };
};

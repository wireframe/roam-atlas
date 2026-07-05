type Coordinate = [number, number];

type NominatimResult = { lat: string; lon: string };

export type GeocoderOptions = {
  search?: (text: string) => Promise<NominatimResult[]>;
  delay?: (ms: number) => Promise<void>;
  minIntervalMs?: number;
};

export type Geocoder = {
  geocode: (uid: string, text: string) => Promise<Coordinate | null>;
};

const nominatimUrl = (text: string): string =>
  `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    text
  )}`;

// Browsers forbid setting a `User-Agent` header on fetch; Nominatim instead
// identifies the caller via the automatically-sent `Referer`, which suffices
// for our low, cache-backed request volume.
const defaultSearch = (text: string): Promise<NominatimResult[]> =>
  window.fetch(nominatimUrl(text)).then((response) => response.json());

const defaultDelay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const toCoordinate = (results: NominatimResult[]): Coordinate | null => {
  if (results.length === 0) return null;
  const coordinate: Coordinate = [
    parseFloat(results[0].lat),
    parseFloat(results[0].lon),
  ];
  return coordinate.every(Number.isFinite) ? coordinate : null;
};

/**
 * Geocode `Location::` text into a coordinate pair via Nominatim.
 *
 * Requests are deduplicated per uid, serialized so only one runs at a time,
 * and spaced by `minIntervalMs` to honor Nominatim's ~1 req/sec policy. A
 * failed lookup resolves to null rather than throwing, so map rendering can
 * degrade gracefully.
 */
export const createGeocoder = (options: GeocoderOptions = {}): Geocoder => {
  const search = options.search ?? defaultSearch;
  const delay = options.delay ?? defaultDelay;
  const minIntervalMs = options.minIntervalMs ?? 1000;

  const inFlight = new Map<string, Promise<Coordinate | null>>();
  let queue: Promise<unknown> = Promise.resolve();
  let hasRun = false;

  // Runs one request: the spacing delay and the lookup both live inside the
  // catch, so the queued callback can never reject regardless of injected
  // deps. That keeps the never-throw guarantee and stops a rejected delay
  // from poisoning the serialized queue chain.
  const runNext = async (text: string): Promise<Coordinate | null> => {
    try {
      if (hasRun) await delay(minIntervalMs);
      hasRun = true;
      return toCoordinate(await search(text));
    } catch {
      return null;
    }
  };

  const enqueue = (text: string): Promise<Coordinate | null> => {
    const result = queue.then(() => runNext(text));
    queue = result;
    return result;
  };

  const geocode = (uid: string, text: string): Promise<Coordinate | null> => {
    const pending = inFlight.get(uid);
    if (pending) return pending;

    const result = enqueue(text);
    inFlight.set(uid, result);
    result.finally(() => inFlight.delete(uid));
    return result;
  };

  return { geocode };
};

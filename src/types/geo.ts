/**
 * Delivery geography, mirroring the backend's `zone-response.dto.ts`.
 *
 * The centre and radius are the point of this: an address is only accepted when
 * its coordinates fall inside a zone, so the client tests the point itself and
 * says so *before* asking the API to save something it will reject.
 */

export interface ZoneCityDto {
  id: string;
  name: string;
  nameUr: string | null;
  slug: string;
  province: string;
}

export interface ZoneDto {
  id: string;
  name: string;
  slug: string;
  centerLat: number;
  centerLng: number;
  /** Service radius from the centre, in metres. */
  radiusMeters: number;
  deliveryFee: number;
  minOrderAmount: number;
  etaMinutes: number;
  city: ZoneCityDto;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METRES = 6_371_000;

/**
 * Great-circle distance between two points, in metres.
 *
 * The same Haversine the backend resolves zones with, so a point this module
 * calls "inside" is one the API will also accept — an approximation that
 * disagreed at the edge would produce exactly the rejection we are trying to
 * prevent.
 */
export function distanceMetres(a: Coordinates, b: Coordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(deltaLng / 2) ** 2;

  return EARTH_RADIUS_METRES * 2 * Math.asin(Math.sqrt(h));
}

export interface ZoneMatch {
  zone: ZoneDto;
  distanceMetres: number;
}

/**
 * The zone covering a point, or null when it falls outside every one.
 *
 * Nearest centre first, then the radius check — the backend's `resolveZone`
 * does exactly this, and picking the nearest *covering* zone instead would
 * disagree with it wherever two service circles overlap.
 */
export function resolveZone(point: Coordinates, zones: readonly ZoneDto[]): ZoneMatch | null {
  let nearest: ZoneMatch | null = null;

  for (const zone of zones) {
    const metres = distanceMetres(point, {
      latitude: zone.centerLat,
      longitude: zone.centerLng,
    });

    if (nearest === null || metres < nearest.distanceMetres) {
      nearest = { zone, distanceMetres: metres };
    }
  }

  if (nearest === null || nearest.distanceMetres > nearest.zone.radiusMeters) {
    return null;
  }

  return nearest;
}

/** Zones grouped under their city, for a picker that reads like a place list. */
export function groupByCity(
  zones: readonly ZoneDto[],
): Array<{ city: ZoneCityDto; zones: ZoneDto[] }> {
  const cities = new Map<string, { city: ZoneCityDto; zones: ZoneDto[] }>();

  for (const zone of zones) {
    const existing = cities.get(zone.city.id);

    if (existing === undefined) {
      cities.set(zone.city.id, { city: zone.city, zones: [zone] });
    } else {
      existing.zones.push(zone);
    }
  }

  return [...cities.values()];
}

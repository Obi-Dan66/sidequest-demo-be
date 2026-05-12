import { Injectable } from '@nestjs/common';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Geolocation helper. MVP strategy: client-supplied lat/lng pairs,
 * Haversine distance in JS, bounding-box pre-filter in SQL.
 *
 * Migration path documented in SKILL.md:
 *   - Phase 1 (MVP): Float columns + bounding box + Haversine refine (this file)
 *   - Phase 2: PostGIS extension + geography(Point, 4326) column + ST_DWithin / ST_Distance
 *   - Phase 3: Spatial indexes (GIST) + tiled caches for hot regions
 */
@Injectable()
export class GeoService {
  private static toRadians(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  /**
   * Distance in meters between two coordinates using the Haversine formula.
   */
  haversineMeters(a: Coordinates, b: Coordinates): number {
    const dLat = GeoService.toRadians(b.latitude - a.latitude);
    const dLng = GeoService.toRadians(b.longitude - a.longitude);
    const lat1 = GeoService.toRadians(a.latitude);
    const lat2 = GeoService.toRadians(b.latitude);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);

    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /**
   * Compute a bounding box (lat/lng min-max) around a center coordinate.
   * Use this for cheap WHERE clauses *before* refining with haversineMeters().
   */
  boundingBox(center: Coordinates, radiusMeters: number) {
    const latDelta = (radiusMeters / EARTH_RADIUS_METERS) * (180 / Math.PI);
    const lngDelta =
      (radiusMeters / (EARTH_RADIUS_METERS * Math.cos(GeoService.toRadians(center.latitude)))) *
      (180 / Math.PI);

    return {
      minLat: center.latitude - latDelta,
      maxLat: center.latitude + latDelta,
      minLng: center.longitude - lngDelta,
      maxLng: center.longitude + lngDelta,
    };
  }

  /**
   * Convenience predicate: is `point` inside a circle defined by (center, radius)?
   */
  isWithinRadius(center: Coordinates, point: Coordinates, radiusMeters: number): boolean {
    return this.haversineMeters(center, point) <= radiusMeters;
  }
}

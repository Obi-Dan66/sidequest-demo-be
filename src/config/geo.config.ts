import { registerAs } from '@nestjs/config';

export interface GeoConfig {
  defaultLat: number;
  defaultLng: number;
  defaultRadiusMeters: number;
}

export default registerAs<GeoConfig>('geo', () => ({
  defaultLat: parseFloat(process.env.GEO_DEFAULT_LAT || '50.0755'),
  defaultLng: parseFloat(process.env.GEO_DEFAULT_LNG || '14.4378'),
  defaultRadiusMeters: parseInt(process.env.GEO_DEFAULT_RADIUS_METERS || '5000', 10),
}));

import { registerAs } from '@nestjs/config';

export interface NotificationsConfig {
  enabled: boolean;
}

export default registerAs<NotificationsConfig>('notifications', () => ({
  enabled: (process.env.NOTIFICATIONS_ENABLED || 'false').toLowerCase() === 'true',
}));

/** Public web URLs for registration / referrals (no Nest imports). */

export function buildPersonalRegisterRefLink(frontendBaseUrl: string, username: string): string {
  const base = frontendBaseUrl.replace(/\/$/, '');
  return `${base}/register?ref=${encodeURIComponent(username)}`;
}

export function buildInviteTokenRegisterLink(frontendBaseUrl: string, token: string): string {
  const base = frontendBaseUrl.replace(/\/$/, '');
  return `${base}/register?invite=${encodeURIComponent(token)}`;
}

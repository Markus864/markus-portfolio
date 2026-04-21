const DEVELOPER_USER_IDS = (import.meta.env.VITE_DEVELOPER_USER_IDS || '').split(',').map((id: string) => id.trim()).filter(Boolean);

export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function isDeveloper(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return DEVELOPER_USER_IDS.includes(userId);
}

export function hasAppAccess(isAuthenticated: boolean, userId: string | null | undefined): boolean {
  return isAuthenticated || isDeveloper(userId);
}

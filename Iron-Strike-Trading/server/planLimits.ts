type UserRole = "free" | "pro" | "premium";

const ALERT_LIMITS: Record<UserRole, number> = {
  free: 3,
  pro: 25,
  premium: 100,
};

export function getAlertLimit(role: UserRole | string): number {
  if (role === "pro") return ALERT_LIMITS.pro;
  if (role === "premium") return ALERT_LIMITS.premium;
  return ALERT_LIMITS.free;
}

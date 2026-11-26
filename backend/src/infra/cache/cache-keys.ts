/** Chaves de cache explícitas: nunca use apenas a URL da requisição. */

export function cacheKey(...parts: Array<string | number>): string {
  return parts.map((part) => String(part)).join(':');
}

export function currentPlanPrefix(userId: number): string {
  return cacheKey('workout-plans', 'current', 'user', userId);
}

export function currentPlanKey(userId: number, role: string): string {
  return cacheKey(currentPlanPrefix(userId), 'role', role);
}

export function adminIndicatorsKey(userId: number, role: string): string {
  return cacheKey('reports', 'admin-indicators', 'user', userId, 'role', role);
}

import type { AuthUser } from '../api/auth'

export function userRoles(user: AuthUser | null | undefined): string[] {
  if (!user) return []
  const roles = user.roles && user.roles.length > 0 ? user.roles : user.role ? [user.role] : []
  if (roles.includes('SUPER_ADMIN') && !roles.includes('ADMIN')) {
    return [...roles, 'ADMIN']
  }
  return roles
}

export function hasRole(user: AuthUser | null | undefined, role: string): boolean {
  return userRoles(user).includes(role)
}

export function isAdminUser(user: AuthUser | null | undefined): boolean {
  return hasRole(user, 'ADMIN')
}

export function isSuperAdminUser(user: AuthUser | null | undefined): boolean {
  return hasRole(user, 'SUPER_ADMIN')
}

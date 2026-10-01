import type { UserType } from '@/app/(auth)/auth'

interface Entitlements {
  maxChatsPerDay: number
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account (anonymous)
   */
  guest: {
    maxChatsPerDay: 5,
  },

  /*
   * For users with an account
   */
  regular: {
    maxChatsPerDay: 50,
  },
}

// For anonymous users (no session)
export const anonymousEntitlements: Entitlements = {
  maxChatsPerDay: 3,
}

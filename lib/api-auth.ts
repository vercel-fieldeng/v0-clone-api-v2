import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/(auth)/auth'
import { getChatOwnership } from '@/lib/db/queries'

/** Best-effort client IP from proxy headers, for anonymous rate limiting. */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP

  return 'unknown'
}

/**
 * Guards a chat mutation: the caller must be authenticated and own the chat.
 * Returns an error `NextResponse` to short-circuit with, or `null` to proceed.
 */
export async function assertChatOwner(
  chatId: string,
): Promise<NextResponse | null> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 },
    )
  }

  const ownership = await getChatOwnership({ v0ChatId: chatId })
  if (!ownership || ownership.user_id !== session.user.id) {
    return NextResponse.json(
      { error: 'Chat not found or access denied' },
      { status: 404 },
    )
  }

  return null
}

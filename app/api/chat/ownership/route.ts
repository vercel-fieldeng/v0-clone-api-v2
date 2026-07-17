import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/(auth)/auth'
import { createChatOwnership, createAnonymousChatLog } from '@/lib/db/queries'
import { getClientIP } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const { chatId } = await request.json()

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 },
      )
    }

    if (session?.user?.id) {
      // Authenticated user - create ownership mapping
      await createChatOwnership({
        v0ChatId: chatId,
        userId: session.user.id,
      })
      console.log('Chat ownership created via API:', chatId)
    } else {
      // Anonymous user - log for rate limiting
      const clientIP = getClientIP(request)
      await createAnonymousChatLog({
        ipAddress: clientIP,
        v0ChatId: chatId,
      })
      console.log('Anonymous chat logged via API:', chatId, 'IP:', clientIP)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to create chat ownership/log:', error)
    return NextResponse.json(
      { error: 'Failed to create ownership record' },
      { status: 500 },
    )
  }
}

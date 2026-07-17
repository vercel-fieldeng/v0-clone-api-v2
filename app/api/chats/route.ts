import { NextResponse } from 'next/server'
import { v0, unwrap } from '@/lib/v0'
import { auth } from '@/app/(auth)/auth'
import { getChatIdsByUserId } from '@/lib/db/queries'

export async function GET() {
  try {
    const session = await auth()

    // Anonymous users don't have saved chats
    if (!session?.user?.id) {
      return NextResponse.json({ data: [] })
    }

    // Get user's chat IDs from our ownership mapping
    const userChatIds = new Set(
      await getChatIdsByUserId({ userId: session.user.id }),
    )

    if (userChatIds.size === 0) {
      return NextResponse.json({ data: [] })
    }

    // v2: List Chats is paginated ({ chats, cursor }); page through until we've
    // seen every owned chat (or run out), so chats past page 1 aren't dropped.
    const userChats: Array<{ id: string }> = []
    let cursor: string | undefined
    let pages = 0
    do {
      const { chats, cursor: next } = unwrap(await v0.chats.list({ cursor }))
      for (const chat of chats) {
        if (userChatIds.has(chat.id)) userChats.push(chat)
      }
      cursor = next ?? undefined
      pages++
    } while (cursor && userChats.length < userChatIds.size && pages < 20)

    return NextResponse.json({ data: userChats })
  } catch (error) {
    console.error('Chats fetch error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch chats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

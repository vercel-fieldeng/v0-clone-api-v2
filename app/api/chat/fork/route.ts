import { NextRequest, NextResponse } from 'next/server'
import { v0, unwrap } from '@/lib/v0'
import { auth } from '@/app/(auth)/auth'
import { createChatOwnership, getChatOwnership } from '@/lib/db/queries'

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

    // Duplicating requires auth + ownership of the source chat.
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

    // v2: "Fork" is now Duplicate Chat. `privacy` is required.
    const forkedChat = unwrap(
      await v0.chats.duplicate({ chatId, privacy: 'private' }),
    )

    // Record ownership for the new chat so the user can open it immediately.
    await createChatOwnership({
      v0ChatId: forkedChat.id,
      userId: session.user.id,
    })

    console.log('Chat duplicated successfully:', forkedChat.id)

    return NextResponse.json(forkedChat)
  } catch (error) {
    console.error('Error duplicating chat:', error)
    return NextResponse.json(
      { error: 'Failed to duplicate chat' },
      { status: 500 },
    )
  }
}

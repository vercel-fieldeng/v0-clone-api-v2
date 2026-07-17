import { NextRequest, NextResponse } from 'next/server'
import { v0, unwrap } from '@/lib/v0'
import { assertChatOwner } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    const { chatId } = await request.json()

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 },
      )
    }

    // Only the authenticated owner may delete a chat.
    const denied = await assertChatOwner(chatId)
    if (denied) return denied

    const result = unwrap(await v0.chats.delete({ chatId }))

    console.log('Chat deleted successfully:', chatId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error deleting chat:', error)
    return NextResponse.json(
      { error: 'Failed to delete chat' },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { v0, unwrap } from '@/lib/v0'
import { assertChatAccess, assertChatOwner } from '@/lib/api-auth'
import { createPreviewCapability } from '@/lib/chat-capability'
import { getPreviewProxyUrl } from '@/lib/preview-url'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { chatId } = await params

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 },
      )
    }

    const denied = await assertChatAccess(request, chatId)
    if (denied) return denied

    // v2: Get Chat + its messages. Versions/`demo` no longer exist in v2 —
    // messages carry structured `parts`, and the preview URL is fetched
    // separately (it can be null while the preview VM boots).
    const [chat, messageList] = await Promise.all([
      v0.chats.get({ chatId }).then(unwrap),
      v0.messages.list({ chatId, limit: 100 }).then(unwrap),
    ])

    // Preview is best-effort: never fail the chat load if it isn't ready yet.
    // `demo` points at our authenticated preview proxy (not the raw v0 URL, which
    // requires an auth-token header the iframe can't send). Null until ready.
    let demo: string | null = null
    try {
      const preview = unwrap(await v0.chats.getPreview({ chatId }))
      demo = preview?.url
        ? getPreviewProxyUrl(chatId, createPreviewCapability(chatId))
        : null
    } catch (error) {
      console.warn('Preview not ready for chat', chatId, error)
    }

    // The API returns messages newest-first; render them oldest-first.
    const messages = [...messageList.messages].reverse().map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      parts: msg.parts,
    }))

    return NextResponse.json({
      id: chat.id,
      title: chat.title,
      privacy: chat.privacy,
      metadata: chat.metadata,
      vercelProjectId: chat.vercelProjectId,
      demo,
      messages,
    })
  } catch (error) {
    console.error('Error fetching chat details:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch chat details',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

// Rename / update metadata. v2: Update Chat.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { chatId } = await params
    const denied = await assertChatOwner(chatId)
    if (denied) return denied

    const { title } = (await request.json()) as { title?: string }
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const updatedChat = unwrap(
      await v0.chats.update({ chatId, title: title.trim() }),
    )
    return NextResponse.json(updatedChat)
  } catch (error) {
    console.error('Error updating chat:', error)
    return NextResponse.json(
      { error: 'Failed to update chat' },
      { status: 500 },
    )
  }
}

// v2: Delete Chat.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { chatId } = await params
    const denied = await assertChatOwner(chatId)
    if (denied) return denied

    const result = unwrap(await v0.chats.delete({ chatId }))
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error deleting chat:', error)
    return NextResponse.json(
      { error: 'Failed to delete chat' },
      { status: 500 },
    )
  }
}

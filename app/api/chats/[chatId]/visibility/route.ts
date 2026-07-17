import { NextRequest, NextResponse } from 'next/server'
import { v0, unwrap } from '@/lib/v0'
import { assertChatOwner } from '@/lib/api-auth'

const VALID_PRIVACY = [
  'public',
  'private',
  'team',
  'team-edit',
  'unlisted',
] as const

type Privacy = (typeof VALID_PRIVACY)[number]

export async function PATCH(
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

    const denied = await assertChatOwner(chatId)
    if (denied) return denied

    const { privacy } = (await request.json()) as { privacy?: Privacy }

    if (!privacy || !VALID_PRIVACY.includes(privacy)) {
      return NextResponse.json(
        { error: 'Invalid privacy setting' },
        { status: 400 },
      )
    }

    // v2: Update Chat (title / privacy / metadata)
    const updatedChat = unwrap(await v0.chats.update({ chatId, privacy }))

    return NextResponse.json(updatedChat)
  } catch (error) {
    console.error('Change Chat Visibility Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to change chat visibility',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

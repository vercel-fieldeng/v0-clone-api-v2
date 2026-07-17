import { NextRequest, NextResponse } from 'next/server'
import { v0 } from '@/lib/v0'
import { auth } from '@/app/(auth)/auth'
import { getChatOwnership } from '@/lib/db/queries'

/**
 * Returns the live preview URL for a chat.
 *
 * In v2 the preview replaces v1's `demo` / `latestVersion.demoUrl`. It may be
 * `null` while the preview VM is still booting, so clients poll this endpoint
 * until `url` is non-null.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const session = await auth()
    const { chatId } = await params

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 },
      )
    }

    // Authenticated users may only read previews for chats they own. Anonymous
    // users can access any chat by URL (matching GET /api/chats/[chatId]).
    if (session?.user?.id) {
      const ownership = await getChatOwnership({ v0ChatId: chatId })
      if (!ownership || ownership.user_id !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // getPreview returns `data: null` while the preview VM boots, and can
    // return an *error* (e.g. "Chat has no previewable files") when the chat
    // hasn't produced a runnable app yet. Both mean "no preview available" —
    // report that as `url: null` (200) rather than 500, so clients can poll
    // without spamming errors.
    const { data, error } = await v0.chats.getPreview({ chatId })

    if (error) {
      return NextResponse.json({ url: null, pending: true })
    }

    return NextResponse.json({ url: data?.url ?? null })
  } catch (error) {
    console.error('Error fetching preview URL:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch preview URL',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

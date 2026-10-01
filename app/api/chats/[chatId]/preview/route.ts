import { NextRequest, NextResponse } from 'next/server'
import { v0 } from '@/lib/v0'
import { assertChatAccess } from '@/lib/api-auth'
import { createPreviewCapability } from '@/lib/chat-capability'
import { getPreviewProxyUrl } from '@/lib/preview-url'

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
    const { chatId } = await params

    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 },
      )
    }

    const denied = await assertChatAccess(request, chatId)
    if (denied) return denied

    const { data, error, response } = await v0.chats.getPreview({ chatId })

    if (error) {
      return NextResponse.json(error, { status: response.status })
    }

    return NextResponse.json({
      url: data?.url
        ? getPreviewProxyUrl(chatId, createPreviewCapability(chatId))
        : null,
    })
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

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/(auth)/auth'
import { v0, v0StreamToSSE, unwrap } from '@/lib/v0'
import { getClientIP } from '@/lib/api-auth'
import {
  createChatOwnership,
  createAnonymousChatLog,
  getChatCountByUserId,
  getChatCountByIP,
} from '@/lib/db/queries'
import {
  entitlementsByUserType,
  anonymousEntitlements,
} from '@/lib/entitlements'
import { ChatSDKError } from '@/lib/errors'

interface Attachment {
  url: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const { message, chatId, streaming, attachments } =
      (await request.json()) as {
        message?: string
        chatId?: string
        streaming?: boolean
        attachments?: Attachment[]
      }

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 },
      )
    }

    // Rate limiting
    if (session?.user?.id) {
      const chatCount = await getChatCountByUserId({
        userId: session.user.id,
        differenceInHours: 24,
      })

      const userType = session.user.type
      if (chatCount >= entitlementsByUserType[userType].maxMessagesPerDay) {
        return new ChatSDKError('rate_limit:chat').toResponse()
      }
    } else {
      const clientIP = getClientIP(request)
      const chatCount = await getChatCountByIP({
        ipAddress: clientIP,
        differenceInHours: 24,
      })

      if (chatCount >= anonymousEntitlements.maxMessagesPerDay) {
        return new ChatSDKError('rate_limit:chat').toResponse()
      }
    }

    const attachmentParam =
      attachments && attachments.length > 0 ? { attachments } : {}

    if (chatId) {
      // --- Continue an existing chat ---
      if (streaming) {
        // v2: Send Message (Streaming) -> SSE of full `parts` snapshots.
        const result = await v0.messages.sendStream({
          chatId,
          message,
          ...attachmentParam,
        })
        return v0StreamToSSE(result)
      }

      // v2: Send Message (blocking) -> returns the assistant Message.
      const sentMessage = unwrap(
        await v0.messages.send({ chatId, message, ...attachmentParam }),
      )
      return NextResponse.json(sentMessage)
    }

    // --- Create a new chat ---
    if (streaming) {
      // v2: Create Chat (Streaming) -> SSE of full `parts` snapshots.
      // Ownership is recorded client-side (via /api/chat/ownership) once the
      // chat id arrives in the stream, matching the previous behavior.
      const result = await v0.chats.createStream({ message, ...attachmentParam })
      return v0StreamToSSE(result)
    }

    // v2: Create Chat (blocking) -> returns { chat, usage }.
    const { chat } = unwrap(
      await v0.chats.create({ message, ...attachmentParam }),
    )

    // Record ownership / anonymous log for the new chat.
    try {
      if (session?.user?.id) {
        await createChatOwnership({
          v0ChatId: chat.id,
          userId: session.user.id,
        })
      } else {
        const clientIP = getClientIP(request)
        await createAnonymousChatLog({
          ipAddress: clientIP,
          v0ChatId: chat.id,
        })
      }
    } catch (error) {
      console.error('Failed to create chat ownership/log:', error)
      // Don't fail the request if the database write fails.
    }

    return NextResponse.json({ id: chat.id, chat })
  } catch (error) {
    console.error('V0 API Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

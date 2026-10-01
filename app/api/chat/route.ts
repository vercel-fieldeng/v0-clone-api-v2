import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/app/(auth)/auth'
import { v0, v0StreamToSSE, unwrap } from '@/lib/v0'
import { assertChatAccess, getClientIP } from '@/lib/api-auth'
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
import {
  chatCapabilityMaxAge,
  createChatCapability,
  getChatCapabilityCookieName,
} from '@/lib/chat-capability'

const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(10_000),
  chatId: z.string().min(1).max(255).optional(),
  streaming: z.boolean().optional(),
  attachments: z
    .array(
      z.object({
        url: z
          .string()
          .max(10_000_000)
          .refine(
            (url) =>
              url.startsWith('data:image/') ||
              url.startsWith('https://') ||
              url.startsWith('http://'),
            'Attachment must be an image data URL or HTTP(S) URL',
          ),
      }),
    )
    .max(10)
    .optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const parsed = chatRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const { message, chatId, streaming, attachments } = parsed.data

    if (chatId) {
      const denied = await assertChatAccess(request, chatId)
      if (denied) return denied
    }

    // The configured limits are chat-creation limits, not per-message limits.
    if (!chatId && session?.user?.id) {
      const chatCount = await getChatCountByUserId({
        userId: session.user.id,
        differenceInHours: 24,
      })

      const userType = session.user.type
      if (chatCount >= entitlementsByUserType[userType].maxChatsPerDay) {
        return new ChatSDKError('rate_limit:chat').toResponse()
      }
    } else if (!chatId) {
      const clientIP = getClientIP(request)
      const chatCount = await getChatCountByIP({
        ipAddress: clientIP,
        differenceInHours: 24,
      })

      if (chatCount >= anonymousEntitlements.maxChatsPerDay) {
        return new ChatSDKError('rate_limit:chat').toResponse()
      }
    }

    const attachmentParam =
      attachments && attachments.length > 0 ? { attachments } : {}

    if (chatId) {
      // --- Continue an existing chat ---
      if (streaming) {
        // v2: Send Message (Streaming) -> SSE of full `parts` snapshots.
        const result = await v0.messages.sendStream(
          { chatId, message, ...attachmentParam },
          { signal: request.signal },
        )
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
      // Persist ownership before the first snapshot exposes the new chat id.
      const result = await v0.chats.createStream(
        { message, ...attachmentParam },
        { signal: request.signal },
      )
      const clientIP = getClientIP(request)

      return v0StreamToSSE(result, {
        onChat: async (chat) => {
          if (session?.user?.id) {
            await createChatOwnership({
              v0ChatId: chat.id,
              userId: session.user.id,
            })
          } else {
            await createAnonymousChatLog({
              ipAddress: clientIP,
              v0ChatId: chat.id,
            })
            return createChatCapability(chat.id)
          }
        },
      })
    }

    // v2: Create Chat (blocking) -> returns { chat, usage }.
    const { chat } = unwrap(
      await v0.chats.create({ message, ...attachmentParam }),
    )

    let capability: string | undefined
    if (session?.user?.id) {
      await createChatOwnership({
        v0ChatId: chat.id,
        userId: session.user.id,
      })
    } else {
      await createAnonymousChatLog({
        ipAddress: getClientIP(request),
        v0ChatId: chat.id,
      })
      capability = createChatCapability(chat.id)
    }

    const response = NextResponse.json({ id: chat.id, chat })
    if (capability) {
      response.cookies.set(getChatCapabilityCookieName(chat.id), capability, {
        httpOnly: true,
        maxAge: chatCapabilityMaxAge,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
    }
    return response
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

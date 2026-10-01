import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  chatCapabilityMaxAge,
  getChatCapabilityCookieName,
  verifyChatCapability,
} from '@/lib/chat-capability'

const capabilitySchema = z.object({
  chatId: z.string().min(1).max(255),
  capability: z.string().min(1).max(512),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = capabilitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { chatId, capability } = parsed.data
  if (!verifyChatCapability(chatId, capability)) {
    return NextResponse.json({ error: 'Invalid capability' }, { status: 403 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(getChatCapabilityCookieName(chatId), capability, {
    httpOnly: true,
    maxAge: chatCapabilityMaxAge,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}

import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
export {
  getChatCapabilityCookieName,
  getPreviewCapabilityCookieName,
} from '@/lib/chat-capability-cookie'

const CAPABILITY_TTL_SECONDS = 7 * 24 * 60 * 60

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is required')
  return secret
}

type CapabilityAudience = 'chat' | 'preview'

function signature(
  audience: CapabilityAudience,
  chatId: string,
  expiresAt: number,
): string {
  return createHmac('sha256', getSecret())
    .update(`${audience}:${chatId}:${expiresAt}`)
    .digest('base64url')
}

function createCapability(
  audience: CapabilityAudience,
  chatId: string,
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + CAPABILITY_TTL_SECONDS
  return `${expiresAt}.${signature(audience, chatId, expiresAt)}`
}

function verifyCapability(
  audience: CapabilityAudience,
  chatId: string,
  token: string,
): boolean {
  const [expiresValue, providedSignature] = token.split('.', 2)
  const expiresAt = Number(expiresValue)
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000) ||
    !providedSignature
  ) {
    return false
  }

  const expected = Buffer.from(signature(audience, chatId, expiresAt))
  const provided = Buffer.from(providedSignature)
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  )
}

export function createChatCapability(chatId: string): string {
  return createCapability('chat', chatId)
}

export function verifyChatCapability(chatId: string, token: string): boolean {
  return verifyCapability('chat', chatId, token)
}

export function createPreviewCapability(chatId: string): string {
  return createCapability('preview', chatId)
}

export function verifyPreviewCapability(chatId: string, token: string): boolean {
  return verifyCapability('preview', chatId, token)
}

export const chatCapabilityMaxAge = CAPABILITY_TTL_SECONDS

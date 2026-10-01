import { NextRequest, NextResponse } from 'next/server'
import { fetchPreview } from 'v0'
import { v0 } from '@/lib/v0'
import {
  chatCapabilityMaxAge,
  getPreviewCapabilityCookieName,
  verifyPreviewCapability,
} from '@/lib/chat-capability'

// The preview must be proxied: the v0 preview URL requires an
// `x-v0-preview-token` header, which an <iframe src> cannot send. `fetchPreview`
// forwards the request (method/headers/body/query) to the preview URL with the
// token attached. See https://v0.app/docs/api/v2.
export const dynamic = 'force-dynamic'

type Preview = { url: string; token: string; expiresAt: Date } | null

// Cache preview tokens per chat so we don't call getPreview on every asset
// request. Tokens are short-lived; we refetch shortly before expiry. Bounded to
// avoid unbounded growth over the life of the server.
const MAX_CACHE = 200
const previewCache = new Map<string, Preview>()

async function getCachedPreview(chatId: string): Promise<Preview> {
  const cached = previewCache.get(chatId)
  if (cached && new Date(cached.expiresAt).getTime() - Date.now() > 10_000) {
    return cached
  }
  try {
    const { data, error } = await v0.chats.getPreview({ chatId })
    if (error) throw new Error(error.message)
    const preview = (data ?? null) as Preview
    if (previewCache.size >= MAX_CACHE) {
      previewCache.delete(previewCache.keys().next().value as string)
    }
    previewCache.set(chatId, preview)
    return preview
  } catch {
    return null
  }
}

async function handler(
  request: NextRequest,
  ctx: { params: Promise<{ chatId: string; path?: string[] }> },
) {
  const { chatId, path } = await ctx.params
  const queryCapability = request.nextUrl.searchParams.get('capability')
  const cookieCapability = request.cookies.get(
    getPreviewCapabilityCookieName(chatId),
  )?.value
  const capability = queryCapability ?? cookieCapability
  if (!capability || !verifyPreviewCapability(chatId, capability)) {
    return NextResponse.json(
      { error: 'Preview not found or access denied' },
      { status: 404 },
    )
  }

  const preview = await getCachedPreview(chatId)

  // Don't leak our session cookie / auth header to the third-party preview VM.
  const forwardHeaders = new Headers(request.headers)
  forwardHeaders.delete('cookie')
  forwardHeaders.delete('authorization')
  const sanitizedRequest = new Request(request, { headers: forwardHeaders })

  const response = await fetchPreview({
    request: sanitizedRequest,
    preview,
    // When the preview isn't ready yet, redirect the iframe to a tiny loading
    // page that retries this route after a short delay.
    fallbackUrl: new URL(
      `/api/preview-loading?chatId=${encodeURIComponent(chatId)}&capability=${encodeURIComponent(capability)}`,
      request.url,
    ),
    path: path ?? [],
    onPreviewRefresh: () => {
      previewCache.delete(chatId)
    },
  })

  const proxied = new NextResponse(response.body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  })
  proxied.headers.set('Referrer-Policy', 'same-origin')
  proxied.cookies.set(getPreviewCapabilityCookieName(chatId), capability, {
    httpOnly: true,
    maxAge: chatCapabilityMaxAge,
    path: '/',
    sameSite: request.nextUrl.protocol === 'https:' ? 'none' : 'lax',
    secure: request.nextUrl.protocol === 'https:',
  })
  return proxied
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const HEAD = handler
export const OPTIONS = handler

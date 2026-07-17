import { NextRequest, NextResponse } from 'next/server'
import { fetchPreview } from 'v0'
import { v0 } from '@/lib/v0'
import { auth } from '@/app/(auth)/auth'
import { getChatOwnership } from '@/lib/db/queries'

// The preview must be proxied same-origin: the v0 preview URL requires an
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
    const { data } = await v0.chats.getPreview({ chatId })
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

// Authenticated users may only view previews for chats they own. Anonymous
// users can view any chat by URL (matching GET /api/chats/[chatId]).
async function forbidden(chatId: string): Promise<boolean> {
  const session = await auth()
  if (!session?.user?.id) return false
  const ownership = await getChatOwnership({ v0ChatId: chatId })
  return !ownership || ownership.user_id !== session.user.id
}

async function handler(
  request: NextRequest,
  ctx: { params: Promise<{ chatId: string; path?: string[] }> },
) {
  const { chatId, path } = await ctx.params

  // Gate only the top-level document request (empty path). Asset sub-requests
  // are reached only after the gated document loads, so we avoid an auth() +
  // DB lookup on every asset.
  if (!path || path.length === 0) {
    if (await forbidden(chatId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const preview = await getCachedPreview(chatId)

  // Don't leak our session cookie / auth header to the third-party preview VM.
  const forwardHeaders = new Headers(request.headers)
  forwardHeaders.delete('cookie')
  forwardHeaders.delete('authorization')
  const sanitizedRequest = new Request(request, { headers: forwardHeaders })

  return fetchPreview({
    request: sanitizedRequest,
    preview,
    // When the preview isn't ready yet, redirect the iframe to a tiny loading
    // page that retries this route after a short delay.
    fallbackUrl: new URL(
      `/api/preview-loading?chatId=${encodeURIComponent(chatId)}`,
      request.url,
    ),
    path: path ?? [],
    onPreviewRefresh: () => {
      previewCache.delete(chatId)
    },
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const HEAD = handler
export const OPTIONS = handler

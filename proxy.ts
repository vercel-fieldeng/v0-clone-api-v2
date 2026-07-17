import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { guestRegex, isDevelopmentEnvironment } from './lib/constants'

// Next.js 16 renamed the `middleware` file convention to `proxy`. The exported
// function is named `proxy`; the matcher `config` export is unchanged.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // --- v0 preview asset routing ---
  // The v2 preview is a Next app served through our same-origin proxy at
  // /api/preview/<chatId>. It emits ROOT-relative asset URLs (/_next/..., fonts,
  // /placeholder.svg, dynamic chunks) that would otherwise resolve to our origin
  // root and bypass the proxy (404). Any request whose Referer points at the
  // preview iframe is re-routed through the proxy so it reaches the preview VM
  // with the auth token attached. This runs before auth and static handling.
  if (!pathname.startsWith('/api/preview')) {
    const referer = request.headers.get('referer')
    const match = referer?.match(/\/api\/preview\/([^/?#]+)/)
    if (match) {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = `/api/preview/${match[1]}${pathname}`
      rewriteUrl.search = search
      return NextResponse.rewrite(rewriteUrl)
    }
  }

  // Let our own static assets and Next internals through untouched.
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next()
  }

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 })
  }

  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Check for required environment variables
  if (!process.env.AUTH_SECRET) {
    console.error(
      '❌ Missing AUTH_SECRET environment variable. Please check your .env file.',
    )
    return NextResponse.next() // Let the app handle the error with better UI
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  })

  if (!token) {
    // Allow API routes to proceed without authentication for anonymous chat creation
    if (pathname.startsWith('/api/')) {
      return NextResponse.next()
    }

    // Allow homepage for anonymous users
    if (pathname === '/') {
      return NextResponse.next()
    }

    // Redirect protected pages to login
    if (['/chats', '/projects'].some((path) => pathname.startsWith(path))) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Allow login and register pages
    if (['/login', '/register'].includes(pathname)) {
      return NextResponse.next()
    }

    // For any other protected routes, redirect to login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const isGuest = guestRegex.test(token?.email ?? '')

  if (token && !isGuest && ['/login', '/register'].includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // NOTE: unlike the usual Next.js matcher, this intentionally DOES run on
  // `/_next/*` so the preview-asset rewrite above can intercept the preview
  // iframe's root-relative `/_next/...` requests (identified by Referer). Our
  // own `/_next/*` requests are short-circuited with `NextResponse.next()`.
  matcher: ['/((?!favicon.ico|sitemap.xml|robots.txt).*)'],
}

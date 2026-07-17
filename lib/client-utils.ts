'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect if the current viewport is mobile size (< 768px)
 * Updates on window resize
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // Check on mount
    checkMobile()

    // Listen for resize
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

/**
 * Polls the chat preview endpoint until a preview URL is available.
 *
 * v2 replaces v1's `demo` / `latestVersion.demoUrl` with a preview that is
 * provisioned asynchronously, so the URL can be `null` for a short while after
 * generation finishes. Returns the URL once ready, or `null` if it never
 * becomes available within the attempt budget.
 */
export async function pollPreviewUrl(
  chatId: string,
  { attempts = 20, intervalMs = 2000 }: { attempts?: number; intervalMs?: number } = {},
): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(`/api/chats/${chatId}/preview`)
      if (response.ok) {
        const data = (await response.json()) as { url?: string | null }
        if (data.url) return data.url
      }
    } catch (error) {
      console.error('Preview poll failed:', error)
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return null
}

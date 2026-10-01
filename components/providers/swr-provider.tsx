'use client'

import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'

interface SWRProviderProps {
  children: ReactNode
}

interface FetchError extends Error {
  info?: unknown
  status?: number
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher: async (url: string) => {
          const response = await fetch(url)
          if (!response.ok) {
            const error = new Error(
              'An error occurred while fetching the data.',
            ) as FetchError
            error.info = await response.json().catch(() => null)
            error.status = response.status
            throw error
          }
          return response.json()
        },
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        refreshInterval: 0,
        errorRetryCount: 3,
        errorRetryInterval: 5000,
      }}
    >
      {children}
    </SWRConfig>
  )
}

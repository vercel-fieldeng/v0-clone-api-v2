import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStreaming } from '@/contexts/streaming-context'
import useSWR, { mutate } from 'swr'
import type { V0MessagePart } from '@/components/v0/message-parts'
import type { MessageBinaryFormat } from '@v0-sdk/react'
import type { MessageContent } from '@/lib/chat-types'
import { pollPreviewUrl } from '@/lib/client-utils'

interface ChatApiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  parts?: V0MessagePart[]
}

interface Chat {
  id: string
  demo?: string | null
  url?: string
  title?: string
  messages?: ChatApiMessage[]
}

interface ChatMessage {
  type: 'user' | 'assistant'
  content: MessageContent
  isStreaming?: boolean
  stream?: ReadableStream<Uint8Array> | null
}

function toChatMessage(msg: ChatApiMessage): ChatMessage {
  // Assistant messages render from structured `parts`; user messages are text.
  if (msg.role === 'assistant') {
    return { type: 'assistant', content: msg.parts ?? [] }
  }
  return { type: 'user', content: msg.content }
}

export function useChat(chatId: string) {
  const router = useRouter()
  const { handoff, clearHandoff } = useStreaming()
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])

  // Use SWR to fetch chat data
  const {
    data: currentChat,
    error,
    isLoading: isLoadingChat,
  } = useSWR<Chat>(chatId ? `/api/chats/${chatId}` : null, {
    onError: (error) => {
      console.error('Error loading chat:', error)
      router.push('/')
    },
    onSuccess: (chat) => {
      // Seed chat history with existing messages, unless we're mid-handoff
      // (streaming continued from the homepage) to avoid duplicates.
      if (
        chat.messages &&
        chatHistory.length === 0 &&
        !(handoff.chatId === chatId && handoff.stream)
      ) {
        setChatHistory(chat.messages.map(toChatMessage))
      }
    },
  })

  // Handle streaming from context (when redirected from homepage)
  useEffect(() => {
    if (handoff.chatId === chatId && handoff.stream && handoff.userMessage) {
      setChatHistory((prev) => [
        ...prev,
        { type: 'user', content: handoff.userMessage! },
      ])

      setIsStreaming(true)
      setChatHistory((prev) => [
        ...prev,
        {
          type: 'assistant',
          content: [],
          isStreaming: true,
          stream: handoff.stream,
        },
      ])

      clearHandoff()
    }
  }, [chatId, handoff, clearHandoff])

  const handleSendMessage = async (
    e: React.FormEvent<HTMLFormElement>,
    attachments?: Array<{ url: string }>,
  ) => {
    e.preventDefault()
    if (!message.trim() || isLoading || !chatId) return

    const userMessage = message.trim()
    setMessage('')
    setIsLoading(true)

    setChatHistory((prev) => [...prev, { type: 'user', content: userMessage }])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          chatId,
          streaming: true,
          ...(attachments && attachments.length > 0 && { attachments }),
        }),
      })

      if (!response.ok) {
        let errorMessage =
          'Sorry, there was an error processing your message. Please try again.'
        try {
          const errorData = await response.json()
          if (errorData.message) {
            errorMessage = errorData.message
          } else if (response.status === 429) {
            errorMessage =
              'You have exceeded your maximum number of messages for the day. Please try again later.'
          }
        } catch {
          if (response.status === 429) {
            errorMessage =
              'You have exceeded your maximum number of messages for the day. Please try again later.'
          }
        }
        throw new Error(errorMessage)
      }

      if (!response.body) {
        throw new Error('No response body for streaming')
      }

      setIsStreaming(true)
      setChatHistory((prev) => [
        ...prev,
        {
          type: 'assistant',
          content: [],
          isStreaming: true,
          stream: response.body,
        },
      ])
    } catch (error) {
      console.error('Error:', error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Sorry, there was an error processing your message. Please try again.'

      setChatHistory((prev) => [
        ...prev,
        { type: 'assistant', content: errorMessage },
      ])
      setIsLoading(false)
    }
  }

  const handleStreamingComplete = async (finalParts: MessageBinaryFormat) => {
    setIsStreaming(false)
    setIsLoading(false)

    // Freeze the final content on the last streaming message.
    setChatHistory((prev) => {
      const updated = [...prev]
      const lastIndex = updated.length - 1
      if (lastIndex >= 0 && updated[lastIndex].isStreaming) {
        updated[lastIndex] = {
          ...updated[lastIndex],
          content: finalParts,
          isStreaming: false,
          stream: undefined,
        }
      }
      return updated
    })

    // v2: the preview URL is fetched separately and may lag the stream, so poll
    // until it's ready, then push it into the SWR cache for the preview panel.
    try {
      const previewUrl = await pollPreviewUrl(chatId)
      // Point the iframe at the same-origin proxy once the preview is ready.
      const demo = previewUrl ? `/api/preview/${chatId}` : null
      mutate(
        `/api/chats/${chatId}`,
        (existing: Chat | undefined) =>
          existing ? { ...existing, demo } : existing,
        false,
      )
    } catch (error) {
      console.error('Error resolving preview URL:', error)
      mutate(`/api/chats/${chatId}`)
    }
  }

  const handleChatData = async (_chatData: { id: string }) => {
    // On an existing chat page the chat id is already known; nothing to do.
  }

  return {
    message,
    setMessage,
    currentChat,
    error,
    isLoading,
    setIsLoading,
    isStreaming,
    chatHistory,
    isLoadingChat,
    handleSendMessage,
    handleStreamingComplete,
    handleChatData,
  }
}

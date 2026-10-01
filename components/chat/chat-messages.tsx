'use client'

import React, { useRef, useEffect } from 'react'
import { Message } from '@/components/ai-elements/message'
import {
  Conversation,
  ConversationContent,
} from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'
import { MessageRenderer } from '@/components/message-renderer'
import { V0StreamingMessage } from '@/components/v0/streaming-message'
import type { Message as V0Message } from '@v0-sdk/react'
import type { MessageContent } from '@/lib/chat-types'

interface ChatMessage {
  type: 'user' | 'assistant'
  content: MessageContent
  isStreaming?: boolean
  stream?: ReadableStream<Uint8Array> | null
}

interface Chat {
  id: string
  demo?: string | null
  url?: string
}

interface ChatMessagesProps {
  chatHistory: ChatMessage[]
  isLoading: boolean
  currentChat: Chat | null
  onStreamingComplete: (finalParts: V0Message['parts']) => void
  onChatData: (chatData: { id: string }, capability?: string) => void | Promise<void>
  onStreamingStarted?: () => void
}

export function ChatMessages({
  chatHistory,
  isLoading,
  onStreamingComplete,
  onChatData,
  onStreamingStarted,
}: ChatMessagesProps) {
  const streamingStartedRef = useRef(false)

  // Reset the streaming started flag when a new message starts loading
  useEffect(() => {
    if (isLoading) {
      streamingStartedRef.current = false
    }
  }, [isLoading])

  if (chatHistory.length === 0) {
    return (
      <Conversation>
        <ConversationContent>
          <div>
            {/* Empty conversation - messages will appear here when they load */}
          </div>
        </ConversationContent>
      </Conversation>
    )
  }

  return (
    <Conversation>
      <ConversationContent>
        {chatHistory.map((msg, index) => (
          <Message from={msg.type} key={index}>
            {msg.isStreaming && msg.stream ? (
              <V0StreamingMessage
                stream={msg.stream}
                onComplete={onStreamingComplete}
                onChatData={onChatData}
                onChunk={() => {
                  // Hide external loader once content starts arriving (once).
                  if (onStreamingStarted && !streamingStartedRef.current) {
                    streamingStartedRef.current = true
                    onStreamingStarted()
                  }
                }}
              />
            ) : (
              <MessageRenderer
                content={msg.content}
                role={msg.type}
                messageId={`msg-${index}`}
              />
            )}
          </Message>
        ))}
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="flex justify-center py-4"
          >
            <Loader size={16} className="text-muted-foreground" />
            <span className="sr-only">Loading…</span>
          </div>
        )}
      </ConversationContent>
    </Conversation>
  )
}

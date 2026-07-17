import type { MessageBinaryFormat } from '@v0-sdk/react'
import type { V0MessagePart } from '@/components/v0/message-parts'

/**
 * The content a chat message can carry in the UI:
 *  - `string`            — plain user text or an error message
 *  - `MessageBinaryFormat` — the v0 binary format emitted by the live stream
 *  - `V0MessagePart[]`   — clean parts loaded from `messages.list` (history)
 */
export type MessageContent = string | MessageBinaryFormat | V0MessagePart[]

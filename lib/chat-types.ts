import type { Message } from '@v0-sdk/react'

/**
 * The content a chat message can carry in the UI:
 *  - `string` - plain user text or an error message
 *  - `Message['parts']` - structured v2 parts from streams and history
 */
export type MessageContent = string | Message['parts']

export function getChatCapabilityCookieName(chatId: string): string {
  const safeId = chatId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128)
  return `v0_chat_${safeId}`
}

export function getPreviewCapabilityCookieName(chatId: string): string {
  const safeId = chatId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128)
  return `v0_preview_${safeId}`
}

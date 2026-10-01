import 'server-only'

export function getPreviewProxyUrl(
  chatId: string,
  capability: string,
): string {
  const path = `/api/preview/${encodeURIComponent(chatId)}`
  const configuredOrigin = process.env.V0_PREVIEW_ORIGIN
  const url = configuredOrigin
    ? new URL(configuredOrigin)
    : new URL(path, 'http://local')

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('V0_PREVIEW_ORIGIN must use HTTP or HTTPS')
  }

  url.pathname = path
  url.search = ''
  url.searchParams.set('capability', capability)
  url.hash = ''

  return configuredOrigin ? url.toString() : `${url.pathname}${url.search}`
}

import { NextRequest } from 'next/server'

// Rendered inside the preview iframe while the preview VM boots. Retries the
// proxy route after a short delay until the preview becomes available.
export async function GET(request: NextRequest) {
  const chatId = new URL(request.url).searchParams.get('chatId') || ''
  const target = `/api/preview/${encodeURIComponent(chatId)}`

  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Preview starting…</title></head>
  <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#8b8b8b">
    <div style="text-align:center">
      <div style="width:20px;height:20px;margin:0 auto 12px;border:2px solid #333;border-top-color:#888;border-radius:50%;animation:spin 0.8s linear infinite"></div>
      <div style="font-size:13px">Preview is starting…</div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    <script>setTimeout(function(){window.location.replace(${JSON.stringify(target)})},2500)</script>
  </body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

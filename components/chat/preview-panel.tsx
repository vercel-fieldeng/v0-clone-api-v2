import {
  WebPreview,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
  WebPreviewBody,
} from '@/components/ai-elements/web-preview'
import { RefreshCw, Monitor, Maximize, Minimize } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Chat {
  id: string
  demo?: string | null
  url?: string
}

interface PreviewPanelProps {
  currentChat: Chat | null
  isFullscreen: boolean
  setIsFullscreen: (fullscreen: boolean) => void
  refreshKey: number
  setRefreshKey: (key: number | ((prev: number) => number)) => void
}

export function PreviewPanel({
  currentChat,
  isFullscreen,
  setIsFullscreen,
  refreshKey,
  setRefreshKey,
}: PreviewPanelProps) {
  return (
    <div
      className={cn(
        'flex flex-col h-full transition-all duration-300',
        isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-black' : 'flex-1',
      )}
    >
      <WebPreview defaultUrl={currentChat?.demo || ''}>
        <WebPreviewNavigation>
          <WebPreviewNavigationButton
            onClick={() => {
              // Force refresh the iframe by updating the refresh key
              setRefreshKey((prev) => prev + 1)
            }}
            tooltip="Refresh preview"
            disabled={!currentChat?.demo}
          >
            <RefreshCw className="h-4 w-4" />
          </WebPreviewNavigationButton>
          <WebPreviewUrl
            readOnly
            placeholder="Your app will appear here..."
            value={currentChat?.demo || ''}
          />
          <WebPreviewNavigationButton
            onClick={() => setIsFullscreen(!isFullscreen)}
            tooltip={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            disabled={!currentChat?.demo}
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </WebPreviewNavigationButton>
        </WebPreviewNavigation>
        {currentChat?.demo ? (
          <WebPreviewBody key={refreshKey} src={currentChat.demo} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Monitor className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  No preview yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Start a conversation to see your app render here.
                </p>
              </div>
            </div>
          </div>
        )}
      </WebPreview>
    </div>
  )
}

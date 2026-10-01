import { cn } from '@/lib/utils'

/**
 * One shared typographic scale for assistant message prose, tuned for a chat
 * surface (compact, semantic tokens, modest headings). Applied to Streamdown
 * output (`Response`) via child selectors so markdown headings/lists/code match
 * the surrounding task + reasoning UI instead of ballooning to article sizes.
 */
export const PROSE_CLASS = cn(
  'text-sm leading-relaxed text-foreground',
  '[&_p]:my-2 [&_p]:text-sm [&_p]:leading-relaxed',
  '[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-foreground',
  '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground',
  '[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-foreground',
  '[&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-sm [&_h4]:font-medium [&_h4]:text-foreground',
  '[&_h5]:mt-3 [&_h5]:mb-1 [&_h5]:text-sm [&_h5]:font-medium [&_h5]:text-foreground',
  '[&_h6]:mt-3 [&_h6]:mb-1 [&_h6]:text-sm [&_h6]:font-medium [&_h6]:text-muted-foreground',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1',
  '[&_li]:text-sm [&_li]:text-foreground',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-xs',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
  '[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4',
  '[&_strong]:font-semibold [&_strong]:text-foreground',
  '[&_em]:italic',
)

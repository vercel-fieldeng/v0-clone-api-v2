'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { PROSE_CLASS } from '@/lib/prose'
import { Response } from '@/components/ai-elements/response'
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from '@/components/ai-elements/reasoning'
import {
  Task,
  TaskTrigger,
  TaskContent,
  TaskItem,
  TaskItemFile,
} from '@/components/ai-elements/task'

/**
 * Loosely-typed mirror of the v2 `Message['parts']` union.
 *
 * We deliberately do NOT import the type from the `v0` package here: that
 * package statically imports server-only modules (`@vercel/oidc`) and must stay
 * out of client bundles. The API layer forwards these parts verbatim as JSON.
 */
export interface V0MessagePart {
  type: string
  text?: string
  paths?: string[]
  operation?: 'create' | 'update' | 'delete' | 'rename' | 'patch'
  path?: string
  toPath?: string
  scope?: 'repo' | 'web'
  query?: string
  command?: string
  output?: string
  name?: string
  input?: unknown
  startedAt?: string | Date
  finishedAt?: string | Date
  [key: string]: unknown
}

const baseName = (p: string) => p.split('/').pop() || p

const humanize = (s: string | undefined | null) =>
  (s ?? '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

const durationSeconds = (part: V0MessagePart): number | undefined => {
  if (!part.startedAt || !part.finishedAt) return undefined
  const start = new Date(part.startedAt).getTime()
  const end = new Date(part.finishedAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return undefined
  return Math.max(0, Math.round((end - start) / 1000))
}

const isAction = (type: string) =>
  type === 'file-read' ||
  type === 'file-edit' ||
  type === 'search' ||
  type === 'bash' ||
  type === 'tool-call' ||
  type === 'agent-action'

function ActionItem({ part }: { part: V0MessagePart }) {
  switch (part.type) {
    case 'file-read':
      return (
        <TaskItem>
          Read{' '}
          {(part.paths ?? []).map((p, i) => (
            <TaskItemFile key={i}>{baseName(p)}</TaskItemFile>
          ))}
        </TaskItem>
      )
    case 'file-edit':
      return (
        <TaskItem>
          {humanize(part.operation ?? 'edit')}{' '}
          <TaskItemFile>{baseName(part.path ?? '')}</TaskItemFile>
          {part.toPath ? (
            <>
              {' → '}
              <TaskItemFile>{baseName(part.toPath)}</TaskItemFile>
            </>
          ) : null}
        </TaskItem>
      )
    case 'search':
      return (
        <TaskItem>
          Searched {part.scope === 'web' ? 'the web' : 'the repo'}
          {part.query ? `: “${part.query}”` : ''}
        </TaskItem>
      )
    case 'bash':
      return (
        <TaskItem>
          <div className="w-full space-y-1">
            <code className="block rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
              $ {part.command}
            </code>
            {part.output ? (
              <pre className="max-h-40 overflow-auto rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                {part.output}
              </pre>
            ) : null}
          </div>
        </TaskItem>
      )
    case 'tool-call':
      return (
        <TaskItem>
          Called tool <TaskItemFile>{part.name}</TaskItemFile>
        </TaskItem>
      )
    case 'agent-action':
      return (
        <TaskItem>
          {(part.summary as string) || humanize(part.name) || 'Working…'}
        </TaskItem>
      )
    default: {
      const summary = (part.summary as string) || (part.text as string)
      return <TaskItem>{summary || humanize(part.type)}</TaskItem>
    }
  }
}

interface MessagePartsProps {
  parts: V0MessagePart[]
  isStreaming?: boolean
  className?: string
}

/**
 * Renders a v2 message's ordered `parts` array.
 *
 * - `text` -> markdown via AI Elements `Response`
 * - `thinking` -> collapsible `Reasoning`
 * - action parts (file-read/edit, search, bash, tool-call) -> grouped `Task`
 */
export function MessageParts({
  parts,
  isStreaming,
  className,
}: MessagePartsProps) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return null
  }

  const blocks: React.ReactNode[] = []
  let actionRun: V0MessagePart[] = []
  let key = 0

  const flushActions = () => {
    if (actionRun.length === 0) return
    const run = actionRun
    actionRun = []
    blocks.push(
      <Task className="w-full" defaultOpen={false} key={`task-${key++}`}>
        <TaskTrigger title={`Worked on ${run.length} step${run.length > 1 ? 's' : ''}`} />
        <TaskContent>
          {run.map((part, i) => (
            <ActionItem key={i} part={part} />
          ))}
        </TaskContent>
      </Task>,
    )
  }

  for (const part of parts) {
    // Streamed snapshots can briefly contain placeholder/partial entries with
    // no `type` yet — skip anything that isn't a well-formed part.
    if (!part || typeof part.type !== 'string') {
      continue
    }

    if (isAction(part.type)) {
      actionRun.push(part)
      continue
    }

    flushActions()

    if (part.type === 'text') {
      if (part.text && part.text.trim()) {
        blocks.push(
          <Response key={`text-${key++}`} className={PROSE_CLASS}>
            {part.text}
          </Response>,
        )
      }
    } else if (part.type === 'thinking') {
      const seconds = durationSeconds(part)
      blocks.push(
        <Reasoning
          key={`think-${key++}`}
          className="mb-0"
          isStreaming={isStreaming}
          duration={seconds}
        >
          <ReasoningTrigger />
          <ReasoningContent>{part.text ?? ''}</ReasoningContent>
        </Reasoning>,
      )
    } else {
      // Unknown non-action part: surface its type rather than dropping silently.
      blocks.push(
        <div key={`other-${key++}`} className="text-sm text-muted-foreground">
          {humanize(part.type)}
        </div>,
      )
    }
  }

  flushActions()

  // A single vertical rhythm between every block (prose, reasoning, tasks).
  return <div className={cn('space-y-3', className)}>{blocks}</div>
}

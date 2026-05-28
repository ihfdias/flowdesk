import { useState, useEffect, useRef } from 'react'
import api from '../../lib/api'
import { Demand, Flow, HistoryEntry, Comment } from '../../lib/types'
import { stageHueFromColor, stageColor } from '../../lib/colors'
import StageChip from '../primitives/StageChip'
import Avatar from '../primitives/Avatar'
import DueDate from '../primitives/DueDate'
import { useIsMobile } from '../../lib/useIsMobile'
import { useFocusTrap } from '../../lib/useFocusTrap'

interface Props {
  demand: Demand
  flow: Flow
  onClose: () => void
  onAdvance: (demandId: string) => Promise<void>
  onArchive: (demandId: string) => Promise<void>
}

type TimelineEvent =
  | { kind: 'history'; entry: HistoryEntry; date: string }
  | { kind: 'comment'; entry: Comment; date: string }

const MUTED = 'oklch(0.50 0.01 60)'
const BORDER = 'oklch(0.90 0.005 60)'
const FG = 'oklch(0.18 0.01 60)'

export default function DemandModal({ demand, flow, onClose, onAdvance, onArchive }: Props) {
  const isMobile = useIsMobile()
  const hue = stageHueFromColor(demand.currentStage.color, demand.currentStage.order)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, onClose)

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [aiThinking, setAiThinking] = useState(false)
  const [aiResult, setAiResult] = useState<string | null>(null)

  useEffect(() => {
    api.get(`/api/demands/${demand.id}`).then(res => {
      setHistory(res.data.history ?? [])
      setComments(res.data.comments ?? [])
    })
  }, [demand.id])

  const currentIdx = flow.stages.findIndex(s => s.id === demand.currentStageId)
  const nextStage = flow.stages[currentIdx + 1]
  const isLast = !nextStage

  const submitComment = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!comment.trim() || submitting) return
    setSubmitting(true)
    setCommentError(null)
    try {
      await api.post(`/api/demands/${demand.id}/comments`, { content: comment })
      setComment('')
      const res = await api.get(`/api/demands/${demand.id}`)
      setComments(res.data.comments ?? [])
    } catch {
      setCommentError("Couldn't send. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const summarize = async () => {
    setAiThinking(true)
    setAiResult(null)
    try {
      const res = await api.post(`/api/ai/summarize/${demand.id}`)
      setAiResult(res.data.summary)
    } catch {
      setAiResult("Couldn't generate summary. Check if Ollama is running.")
    } finally {
      setAiThinking(false)
    }
  }

  const timelineEvents: TimelineEvent[] = [
    ...history.map(h => ({ kind: 'history' as const, entry: h, date: h.movedAt })),
    ...comments.map(c => ({ kind: 'comment' as const, entry: c, date: c.createdAt })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (isMobile) {
    return (
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demand-modal-title"
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'oklch(1 0 0)', color: FG,
          display: 'flex', flexDirection: 'column',
          fontFamily: 'Inter, system-ui, sans-serif',
          animation: 'fdSlideUp .25s cubic-bezier(.2,.7,.3,1)',
        }}
      >
        <style>{`@keyframes fdSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

        {/* AppBar */}
        <div style={{
          padding: '14px 16px 12px',
          borderBottom: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', gap: 12,
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            aria-label="Back"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: FG, lineHeight: 1, padding: '4px 4px 4px 0', flexShrink: 0 }}
          >
            ←
          </button>
          <StageChip name={demand.currentStage.name} hue={hue} size="sm" />
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: MUTED, letterSpacing: 0.4, flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            #{demand.id.slice(0, 8).toUpperCase()}
          </span>
        </div>

        {/* Hero */}
        <div style={{ padding: '20px 18px 16px', background: stageColor(hue, 'softer'), flexShrink: 0 }}>
          <h1 id="demand-modal-title" style={{
            margin: 0,
            fontFamily: 'Instrument Serif, serif',
            fontSize: 26, fontWeight: 400, fontStyle: 'italic',
            letterSpacing: -0.6, lineHeight: 1.1,
          }}>
            {demand.title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: MUTED }}>
            {demand.assignedTo && (
              <>
                <Avatar name={demand.assignedTo.name} size={20} />
                <span>{demand.assignedTo.name.split(' ')[0]}</span>
                <span>·</span>
              </>
            )}
            {demand.dueDate && <DueDate date={demand.dueDate} />}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
          padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
        }}>
          {isLast ? (
            <button
              onClick={() => onArchive(demand.id)}
              style={{
                background: 'oklch(0.45 0.15 155)', color: '#fff', border: 'none',
                padding: '10px 6px', borderRadius: 6, fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              ✓ Complete
            </button>
          ) : (
            <button
              onClick={() => onAdvance(demand.id)}
              style={{
                background: stageColor(hue, 'solid'), color: '#fff', border: 'none',
                padding: '10px 6px', borderRadius: 6, fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              Advance →
            </button>
          )}
          <button
            onClick={summarize}
            disabled={aiThinking}
            style={{
              background: 'transparent', color: 'oklch(0.30 0.10 280)',
              border: '1px solid oklch(0.55 0.12 280)',
              padding: '10px 6px', borderRadius: 6, fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600, cursor: aiThinking ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              opacity: aiThinking ? 0.6 : 1,
            }}
          >
            <span aria-hidden="true">✦</span> {aiThinking ? 'thinking…' : 'AI Summary'}
          </button>
        </div>

        {/* AI result */}
        {aiResult && (
          <div style={{
            padding: '10px 16px',
            background: 'oklch(0.97 0.02 280)',
            borderBottom: `1px solid oklch(0.88 0.04 280)`,
            fontSize: 13, color: 'oklch(0.25 0.10 280)', lineHeight: 1.5, flexShrink: 0,
          }}>
            {aiResult}
          </div>
        )}

        {/* Timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 80px' }}>
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: MUTED, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 14, fontWeight: 700 }}>
            History
          </div>
          <TimelineBody timelineEvents={timelineEvents} hue={hue} />
        </div>

        {/* Sticky comment bar */}
        <div style={{ padding: '8px 12px 12px', borderTop: `1px solid ${BORDER}`, background: 'oklch(1 0 0)', flexShrink: 0 }}>
          {commentError && (
            <div style={{ fontSize: 11, color: 'oklch(0.55 0.18 28)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>
              {commentError}
            </div>
          )}
          <form onSubmit={submitComment} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              value={comment}
              onChange={e => { setComment(e.target.value); setCommentError(null) }}
              placeholder="Say something useful…"
              disabled={submitting}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 999,
                border: `1px solid ${BORDER}`,
                background: 'oklch(0.97 0.005 60)',
                color: FG, fontFamily: 'inherit', fontSize: 13,
                outline: 'none',
                opacity: submitting ? 0.6 : 1,
              }}
              onFocus={e => { e.target.style.borderColor = stageColor(hue, 'solid') }}
              onBlur={e => { e.target.style.borderColor = BORDER }}
            />
            <button
              type="submit"
              aria-label="Send comment"
              disabled={submitting || !comment.trim()}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none',
                background: stageColor(hue, 'solid'), color: '#fff',
                fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: submitting || !comment.trim() ? 0.5 : 1, flexShrink: 0,
              }}
            >
              <span aria-hidden="true">↑</span>
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'oklch(0.18 0.01 60 / 0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demand-modal-title"
        onClick={e => e.stopPropagation()}
        style={{
          width: '62%', maxWidth: 720, height: '100%',
          background: 'oklch(1 0 0)', color: FG,
          display: 'flex', flexDirection: 'column',
          boxShadow: '-20px 0 60px rgba(0,0,0,.2)',
          animation: 'fdSlide .25s cubic-bezier(.2,.7,.3,1)',
        }}
      >
        <style>{`@keyframes fdSlide{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* ── Header (colorido com stageColor softer) ── */}
        <div style={{
          padding: '20px 28px',
          borderBottom: `1px solid ${BORDER}`,
          background: stageColor(hue, 'softer'),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <StageChip name={demand.currentStage.name} hue={hue} size="sm" />
            <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: MUTED, letterSpacing: 0.4 }}>
              #{demand.id.slice(0, 8).toUpperCase()}{demand.tag ? ` · ${demand.tag.toUpperCase()}` : ''}
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: MUTED, lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          </div>

          <h2 id="demand-modal-title" style={{
            margin: 0,
            fontFamily: 'Instrument Serif, serif',
            fontSize: 32, fontWeight: 400, fontStyle: 'italic',
            letterSpacing: -0.8, lineHeight: 1.1,
          }}>
            {demand.title}
          </h2>

          {demand.description && (
            <p style={{ margin: '12px 0 0', fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
              {demand.description}
            </p>
          )}
        </div>

        {/* ── Meta ── */}
        <div style={{
          padding: '16px 28px',
          borderBottom: `1px solid ${BORDER}`,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
        }}>
          <MetaField label="Requested by">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar name={demand.requestedBy.name} size={22} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{demand.requestedBy.name}</span>
            </div>
          </MetaField>
          <MetaField label="Assigned to">
            {demand.assignedTo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={demand.assignedTo.name} size={22} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{demand.assignedTo.name}</span>
              </div>
            ) : (
              <span style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>no one yet</span>
            )}
          </MetaField>
          <MetaField label="Due date">
            {demand.dueDate
              ? <DueDate date={demand.dueDate} />
              : <span style={{ fontSize: 13, color: MUTED }}>—</span>
            }
          </MetaField>
        </div>

        {/* ── AI ── */}
        <div style={{
          padding: '14px 28px',
          borderBottom: `1px solid ${BORDER}`,
          background: 'oklch(0.97 0.02 280)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span aria-hidden="true" style={{ color: 'oklch(0.55 0.20 280)', fontSize: 14, lineHeight: 1 }}>✦</span>
          {!aiResult && !aiThinking && (
            <>
              <span style={{ fontSize: 13, color: 'oklch(0.30 0.10 280)', flex: 1 }}>
                Want a summary of what happened with this demand?
              </span>
              <button
                onClick={summarize}
                style={{
                  border: '1px solid oklch(0.55 0.12 280)',
                  background: 'transparent',
                  color: 'oklch(0.30 0.10 280)',
                  padding: '5px 12px', borderRadius: 4,
                  fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Summarize with AI
              </button>
            </>
          )}
          {aiThinking && (
            <span style={{ fontSize: 13, color: 'oklch(0.30 0.10 280)', fontStyle: 'italic' }}>
              thinking…
            </span>
          )}
          {aiResult && (
            <span style={{ fontSize: 13, color: 'oklch(0.25 0.10 280)', lineHeight: 1.5 }}>
              {aiResult}
            </span>
          )}
        </div>

        {/* ── Timeline ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          <div style={{
            fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
            color: MUTED, letterSpacing: 0.5, textTransform: 'uppercase',
            marginBottom: 16,
          }}>
            History
          </div>
          <TimelineBody timelineEvents={timelineEvents} hue={hue} />
        </div>

        {/* ── Footer: comment + advance ── */}
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          {commentError && (
            <div style={{ padding: '6px 16px', fontSize: 12, color: 'oklch(0.55 0.18 28)', fontFamily: 'JetBrains Mono, monospace' }}>
              {commentError}
            </div>
          )}
          <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
            <form onSubmit={submitComment} style={{ flex: 1, display: 'flex', gap: 8 }}>
              <input
                value={comment}
                onChange={e => { setComment(e.target.value); setCommentError(null) }}
                placeholder="Say something useful…"
                disabled={submitting}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 6,
                  border: `1px solid ${BORDER}`,
                  background: 'oklch(0.99 0 0)',
                  color: FG, fontFamily: 'inherit', fontSize: 13,
                  outline: 'none', transition: 'border-color .15s',
                  opacity: submitting ? 0.6 : 1,
                }}
                onFocus={e => { e.target.style.borderColor = stageColor(hue, 'solid') }}
                onBlur={e => { e.target.style.borderColor = BORDER }}
              />
              <button
                type="submit"
                disabled={submitting || !comment.trim()}
                style={{
                  background: 'transparent', border: `1px solid ${BORDER}`,
                  color: FG, padding: '8px 14px', borderRadius: 6,
                  fontSize: 13, cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontWeight: 500,
                  opacity: submitting || !comment.trim() ? 0.5 : 1,
                }}
              >
                {submitting ? '…' : 'Comment'}
              </button>
            </form>

            {isLast ? (
              <button
                onClick={() => onArchive(demand.id)}
                style={{
                  background: 'oklch(0.45 0.15 155)',
                  color: '#fff', border: 'none',
                  padding: '8px 16px', borderRadius: 6,
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                Complete demand ✓
              </button>
            ) : (
              <button
                onClick={() => onAdvance(demand.id)}
                style={{
                  background: stageColor(hue, 'solid'),
                  color: '#fff', border: 'none',
                  padding: '8px 16px', borderRadius: 6,
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                Advance →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineBody({ timelineEvents, hue }: { timelineEvents: TimelineEvent[]; hue: number }) {
  if (timelineEvents.length === 0) {
    return <p style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>no events yet.</p>
  }
  return (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
      <div style={{ position: 'absolute', left: 9, top: 6, bottom: 6, width: 1, background: BORDER }} />
      {timelineEvents.map((ev, i) => {
        if (ev.kind === 'history') {
          const h = ev.entry
          const toHue = stageHueFromColor(h.toStage.color, h.toStage.order)
          const time = new Date(h.movedAt).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          return (
            <div key={`h-${i}`} style={{ position: 'relative', paddingBottom: 18 }}>
              <div style={{
                position: 'absolute', left: -19, top: 4,
                width: 11, height: 11, borderRadius: '50%',
                background: stageColor(toHue, 'solid'),
                boxShadow: '0 0 0 3px oklch(1 0 0)',
              }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{h.movedBy.name}</span>
                <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: MUTED, letterSpacing: 0.3 }}>{time}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {h.fromStage && (
                  <>
                    <StageChip name={h.fromStage.name} hue={stageHueFromColor(h.fromStage.color, h.fromStage.order)} size="sm" />
                    <span style={{ color: MUTED, fontSize: 12 }}>→</span>
                  </>
                )}
                <StageChip name={h.toStage.name} hue={toHue} size="sm" />
                {h.comment && (
                  <span style={{ fontSize: 12, color: MUTED, fontStyle: 'italic' }}>"{h.comment}"</span>
                )}
              </div>
            </div>
          )
        } else {
          const c = ev.entry
          const time = new Date(c.createdAt).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          return (
            <div key={`c-${i}`} style={{ position: 'relative', paddingBottom: 18 }}>
              <div style={{
                position: 'absolute', left: -19, top: 4,
                width: 11, height: 11, borderRadius: '50%',
                background: 'oklch(0.70 0.01 60)',
                boxShadow: '0 0 0 3px oklch(1 0 0)',
              }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{c.author.name}</span>
                <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: MUTED, letterSpacing: 0.3 }}>{time}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: FG }}>{c.content}</div>
            </div>
          )
        }
      })}
    </div>
  )
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
        color: MUTED, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { Demand, Flow, HistoryEntry, Comment } from '../../lib/types'
import { stageHueFromColor, stageColor } from '../../lib/colors'
import StageChip from '../primitives/StageChip'
import Avatar from '../primitives/Avatar'
import DueDate from '../primitives/DueDate'
import { useIsMobile } from '../../lib/useIsMobile'

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
      setCommentError('Não foi possível enviar. Tente novamente.')
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
      setAiResult('Não foi possível gerar o resumo. Verifique se o Ollama está rodando.')
    } finally {
      setAiThinking(false)
    }
  }

  const timelineEvents: TimelineEvent[] = [
    ...history.map(h => ({ kind: 'history' as const, entry: h, date: h.movedAt })),
    ...comments.map(c => ({ kind: 'comment' as const, entry: c, date: c.createdAt })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

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
        onClick={e => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : '62%', maxWidth: 720, height: '100%',
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: MUTED, lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          </div>

          <h2 style={{
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
          <MetaField label="Solicitante">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar name={demand.requestedBy.name} size={22} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{demand.requestedBy.name}</span>
            </div>
          </MetaField>
          <MetaField label="Responsável">
            {demand.assignedTo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={demand.assignedTo.name} size={22} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{demand.assignedTo.name}</span>
              </div>
            ) : (
              <span style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>ninguém ainda</span>
            )}
          </MetaField>
          <MetaField label="Prazo">
            {demand.dueDate
              ? <DueDate date={demand.dueDate} />
              : <span style={{ fontSize: 13, color: MUTED }}>—</span>
            }
          </MetaField>
        </div>

        {/* ── IA ── */}
        <div style={{
          padding: '14px 28px',
          borderBottom: `1px solid ${BORDER}`,
          background: 'oklch(0.97 0.02 280)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ color: 'oklch(0.55 0.20 280)', fontSize: 14, lineHeight: 1 }}>✦</span>
          {!aiResult && !aiThinking && (
            <>
              <span style={{ fontSize: 13, color: 'oklch(0.30 0.10 280)', flex: 1 }}>
                Quer um resumo do que rolou nessa demanda?
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
                Resumir com IA
              </button>
            </>
          )}
          {aiThinking && (
            <span style={{ fontSize: 13, color: 'oklch(0.30 0.10 280)', fontStyle: 'italic' }}>
              pensando…
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
            Histórico
          </div>

          {timelineEvents.length === 0 ? (
            <p style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>nenhum evento ainda.</p>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 24 }}>
              {/* Linha vertical */}
              <div style={{
                position: 'absolute', left: 9, top: 6, bottom: 6,
                width: 1, background: BORDER,
              }} />

              {timelineEvents.map((ev, i) => {
                if (ev.kind === 'history') {
                  const h = ev.entry
                  const toHue = stageHueFromColor(h.toStage.color, h.toStage.order)
                  const time = new Date(h.movedAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
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
                  const time = new Date(c.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
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
          )}
        </div>

        {/* ── Footer: comentar + avançar ── */}
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
              placeholder="Diga algo construtivo…"
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
              {submitting ? '…' : 'Comentar'}
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
              Finalizar demanda ✓
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
              Avançar →
            </button>
          )}
          </div>
        </div>
      </div>
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
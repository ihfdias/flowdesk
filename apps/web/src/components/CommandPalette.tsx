import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { Demand, Flow } from '../lib/types'
import { stageHueFromColor } from '../lib/colors'
import StageChip from './primitives/StageChip'
import Avatar from './primitives/Avatar'
import DueDate from './primitives/DueDate'

interface Props {
  demands: Demand[]
  flow: Flow | null
  onClose: () => void
  onSelectDemand: (demand: Demand) => void
  onOpenNewDemand: () => void
}

const MUTED = 'oklch(0.50 0.01 60)'
const BORDER = 'oklch(0.90 0.005 60)'
const FG = 'oklch(0.18 0.01 60)'
const AI_COLOR = 'oklch(0.55 0.20 280)'

const NL_REGEX = /\b(quem|onde|qual|por que|porque|como|quando|que|me mostre|liste|atrasad|aprovaç)/i

function isNL(q: string): boolean {
  if (!q.trim()) return false
  return q.includes('?') || q.split(' ').length > 3 || NL_REGEX.test(q)
}

export default function CommandPalette({ demands, flow, onClose, onSelectDemand, onOpenNewDemand }: Props) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [aiThinking, setAiThinking] = useState(false)
  const [aiAnswer, setAiAnswer] = useState<{ summary: string; demands: Demand[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const nlMode = isNL(q)

  const matches = useMemo(() => {
    if (!q.trim() || nlMode) return { demands: [], actions: [] as Action[] }
    const ql = q.toLowerCase()
    return {
      demands: demands.filter(d =>
        d.title.toLowerCase().includes(ql) ||
        (d.tag ?? '').toLowerCase().includes(ql)
      ).slice(0, 5),
      actions: ACTIONS(onOpenNewDemand, () => flow && navigate(`/flows/${flow.id}/edit`), onClose)
        .filter(a => a.label.toLowerCase().includes(ql)),
    }
  }, [q, nlMode, demands, flow])

  useEffect(() => {
    if (!nlMode) { setAiAnswer(null); setAiThinking(false); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setAiThinking(true)
    setAiAnswer(null)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.post('/api/ai/search', { query: q.trim() })
        setAiAnswer(res.data)
      } catch {
        setAiAnswer({ summary: "Couldn't process. Check if Ollama is running.", demands: [] })
      } finally {
        setAiThinking(false)
      }
    }, 800)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [q, nlMode])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'oklch(0.18 0.01 60 / 0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
        animation: 'fdFade .15s',
      }}
    >
      <style>{`
        @keyframes fdFade{from{opacity:0}to{opacity:1}}
        @keyframes fdRise{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fdPulse{0%,100%{opacity:.5}50%{opacity:1}}
        .fd-pulse{animation:fdPulse 1.4s ease-in-out infinite}
        .fd-row:hover{background:oklch(0.96 0.005 60)}
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 600, maxHeight: '70vh', background: 'oklch(1 0 0)', color: FG,
          borderRadius: 12, boxShadow: '0 30px 80px rgba(0,0,0,.3)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'fdRise .2s',
          border: `1px solid ${BORDER}`,
        }}
      >
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${BORDER}` }}>
          {nlMode
            ? <span style={{ color: AI_COLOR, fontSize: 14, lineHeight: 1, flexShrink: 0 }}>✦</span>
            : <span style={{ color: MUTED, fontSize: 16, flexShrink: 0 }}>⌕</span>
          }
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search demands or ask AI…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              color: FG, fontFamily: 'inherit', fontSize: 16, fontWeight: 500,
            }}
          />
          <kbd style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            padding: '3px 7px', borderRadius: 3,
            background: 'oklch(0.94 0.005 60)',
            border: `1px solid ${BORDER}`, color: MUTED, flexShrink: 0,
          }}>ESC</kbd>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {q.trim() === '' && <EmptyState />}

          {nlMode && aiThinking && (
            <div style={{ padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 10, color: AI_COLOR }}>
              <style>{`
                @keyframes fdDot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
                .fd-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:currentColor;animation:fdDot 1.2s ease-in-out infinite}
                .fd-dot:nth-child(2){animation-delay:.15s}
                .fd-dot:nth-child(3){animation-delay:.3s}
              `}</style>
              <span style={{ fontSize: 12, lineHeight: 1 }}>✦</span>
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.4, fontWeight: 700, textTransform: 'uppercase' }}>thinking</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span className="fd-dot" />
                <span className="fd-dot" />
                <span className="fd-dot" />
              </span>
            </div>
          )}

          {nlMode && aiAnswer && (
            <div style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: AI_COLOR }}>
                <span style={{ fontSize: 11, lineHeight: 1 }}>✦</span>
                <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase' }}>
                  FlowDesk IA
                </span>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: aiAnswer.demands.length ? 14 : 0, color: FG }}>
                {aiAnswer.summary}
              </div>
              {aiAnswer.demands.map(d => (
                <DemandRow key={d.id} demand={d} onClick={() => { onSelectDemand(d); onClose() }} />
              ))}
            </div>
          )}

          {!nlMode && q.trim() && (
            <>
              {matches.actions.length > 0 && (
                <Group title="Actions">
                  {matches.actions.map(a => (
                    <div key={a.id} className="fd-row" onClick={a.fn} style={{ padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                      <span style={{ color: MUTED, width: 20, textAlign: 'center', flexShrink: 0 }}>{a.icon}</span>
                      <span>{a.label}</span>
                    </div>
                  ))}
                </Group>
              )}
              {matches.demands.length > 0 && (
                <Group title="Demands">
                  {matches.demands.map(d => (
                    <DemandRow key={d.id} demand={d} onClick={() => { onSelectDemand(d); onClose() }} />
                  ))}
                </Group>
              )}
              {matches.actions.length + matches.demands.length === 0 && (
                <div style={{ padding: '24px 18px', fontSize: 13, color: MUTED, textAlign: 'center', fontStyle: 'italic' }}>
                  nothing found · try a natural language question
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 18px', borderTop: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: MUTED, letterSpacing: 0.4,
        }}>
          <span>try: "overdue demands", "what's in approval", "all video"</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <kbd style={{ padding: '2px 5px', borderRadius: 2, background: 'oklch(0.94 0.005 60)', border: `1px solid ${BORDER}` }}>↵</kbd>
            <span>abrir</span>
          </span>
        </div>
      </div>
    </div>
  )
}

interface Action { id: string; label: string; icon: string; fn: () => void }

function ACTIONS(onNew: () => void, onEdit: () => void, onClose: () => void): Action[] {
  return [
    { id: 'new', label: 'Open new demand', icon: '+', fn: () => { onClose(); onNew() } },
    { id: 'flow', label: 'Edit flow', icon: '⇄', fn: () => { onClose(); onEdit() } },
  ]
}

function EmptyState() {
  const sugg = ['overdue demands', 'what is in approval', 'all video demands', 'who has the most demands']
  return (
    <div style={{ padding: '14px 18px' }}>
      <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: MUTED, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>
        Ask something
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sugg.map(s => (
          <div key={s} style={{ padding: '8px 10px', borderRadius: 5, fontSize: 13, color: MUTED, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: AI_COLOR, fontSize: 11 }}>✦</span>
            <span style={{ fontStyle: 'italic' }}>"{s}"</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: MUTED, letterSpacing: 0.5, textTransform: 'uppercase', padding: '6px 18px' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function DemandRow({ demand, onClick }: { demand: Demand; onClick: () => void }) {
  const hue = stageHueFromColor(demand.currentStage.color, demand.currentStage.order)
  return (
    <div
      className="fd-row"
      onClick={onClick}
      style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
    >
      <StageChip name={demand.currentStage.name} hue={hue} size="sm" />
      <div style={{ flex: 1, fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{demand.title}</div>
      <Avatar name={demand.assignedTo?.name} size={20} />
      <DueDate date={demand.dueDate} />
    </div>
  )
}

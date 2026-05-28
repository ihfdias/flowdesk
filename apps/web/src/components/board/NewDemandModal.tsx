import { useState, useEffect, useRef } from 'react'
import api from '../../lib/api'
import { Flow, User } from '../../lib/types'
import { useIsMobile } from '../../lib/useIsMobile'
import Spinner from '../primitives/Spinner'
import { useFocusTrap } from '../../lib/useFocusTrap'

interface Props {
  flow: Flow
  members?: User[]
  onClose: () => void
  onCreated: () => void
}

const BORDER = 'oklch(0.90 0.005 60)'
const FG = 'oklch(0.18 0.01 60)'
const MUTED = 'oklch(0.50 0.01 60)'
const ACCENT = 'oklch(0.62 0.20 28)'

export default function NewDemandModal({ flow, members = [], onClose, onCreated }: Props) {
  const isMobile = useIsMobile()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tag, setTag] = useState('video')
  const [priority, setPriority] = useState('medium')
  const [assignedToId, setAssignedToId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestingAI, setSuggestingAI] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, onClose)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (description.trim().length < 15) {
      setSuggestions([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSuggestingAI(true)
      try {
        const res = await api.post('/api/ai/suggest-stages', { description: description.trim() })
        setSuggestions(res.data.stages ?? [])
      } catch {
        setSuggestions([])
      } finally {
        setSuggestingAI(false)
      }
    }, 800)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [description])

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!title.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/demands', {
        title: title.trim(),
        description: description.trim() || undefined,
        tag,
        priority,
        flowId: flow.id,
        dueDate: dueDate || undefined,
        assignedToId: assignedToId || undefined,
      })
      onCreated()
    } catch {
      setError("Couldn't create demand. Try again.")
      setLoading(false)
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 100,
    background: 'oklch(0.18 0.01 60 / 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center',
  }

  const sheetStyle: React.CSSProperties = isMobile
    ? {
        width: '100%',
        maxHeight: '92vh',
        background: 'oklch(1 0 0)',
        borderRadius: '16px 16px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,.18)',
        display: 'flex', flexDirection: 'column',
        animation: 'ndUp .25s cubic-bezier(.2,.7,.3,1)',
        overflow: 'hidden',
      }
    : {
        width: 720, maxHeight: 'calc(100vh - 80px)',
        background: 'oklch(1 0 0)',
        borderRadius: 12,
        boxShadow: '0 24px 80px rgba(0,0,0,.16)',
        display: 'flex', flexDirection: 'column',
        animation: 'ndIn .2s cubic-bezier(.2,.7,.3,1)',
      }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <style>{`
        @keyframes ndIn{from{transform:scale(.96) translateY(8px);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes ndUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
      `}</style>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-demand-title"
        onClick={e => e.stopPropagation()}
        style={sheetStyle}
      >

        {/* Mobile drag handle */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'oklch(0.86 0.005 60)' }} />
          </div>
        )}

        {/* Header */}
        <div style={{ padding: isMobile ? '8px 20px 14px' : '24px 28px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{
              fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
              color: MUTED, letterSpacing: 0.6, textTransform: 'uppercase',
            }}>
              {flow.name}
            </span>
            {!isMobile && (
              <button
                onClick={onClose}
                aria-label="Close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: MUTED, lineHeight: 1, padding: '0 2px' }}
              >
                ×
              </button>
            )}
          </div>
          <h2 id="new-demand-title" style={{
            margin: 0,
            fontFamily: 'Instrument Serif, serif',
            fontSize: isMobile ? 24 : 28, fontWeight: 400, fontStyle: 'italic',
            letterSpacing: -0.6, lineHeight: 1.1, color: FG,
          }}>
            What needs to happen?
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: isMobile ? '20px 20px' : '24px 28px', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto', flex: 1 }}>

          <Field label="Title *">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Launch campaign…"
              required
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = ACCENT }}
              onBlur={e => { e.target.style.borderColor = BORDER }}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Context, goals, details…"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              onFocus={e => { e.target.style.borderColor = ACCENT }}
              onBlur={e => { e.target.style.borderColor = BORDER }}
            />
            {(suggestingAI || suggestions.length > 0) && (
              <div style={{
                marginTop: 8, padding: '10px 12px',
                background: 'oklch(0.97 0.02 280)',
                borderRadius: 6,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <span style={{
                  fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
                  color: 'oklch(0.45 0.15 280)', letterSpacing: 0.5,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span>✦</span> AI-suggested stages
                </span>
                {suggestingAI ? (
                  <span style={{ fontSize: 12, color: 'oklch(0.50 0.10 280)', fontStyle: 'italic' }}>
                    thinking…
                  </span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {suggestions.map((s, i) => (
                      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {i > 0 && <span style={{ fontSize: 10, color: 'oklch(0.65 0.08 280)' }}>→</span>}
                        <span style={{
                          fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                          color: 'oklch(0.30 0.12 280)',
                          background: 'oklch(0.93 0.04 280)',
                          padding: '2px 8px', borderRadius: 4,
                          letterSpacing: 0.3,
                        }}>
                          {s}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Type">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(['video', 'social', 'editorial', 'web', 'PR'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setTag(t)} style={{
                    padding: '5px 10px', borderRadius: 4, fontSize: 12,
                    border: `1px solid ${tag === t ? ACCENT : BORDER}`,
                    background: tag === t ? 'oklch(0.97 0.04 28)' : 'transparent',
                    color: tag === t ? 'oklch(0.40 0.16 28)' : FG,
                    cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: tag === t ? 700 : 500, letterSpacing: 0.3,
                  }}>{t}</button>
                ))}
              </div>
            </Field>
            <Field label="Priority">
              <div style={{ display: 'flex', gap: 4 }}>
                {(['low', 'medium', 'high'] as const).map((p, i) => {
                  const colors = ['oklch(0.72 0.04 240)', 'oklch(0.72 0.14 75)', 'oklch(0.62 0.18 28)']
                  const c = colors[i]
                  return (
                    <button key={p} type="button" onClick={() => setPriority(p)} style={{
                      padding: '5px 0', borderRadius: 4, fontSize: 12,
                      border: `1px solid ${priority === p ? c : BORDER}`,
                      background: priority === p ? c : 'transparent',
                      color: priority === p ? '#fff' : FG,
                      cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                      flex: 1, textAlign: 'center', textTransform: 'capitalize',
                    }}>{p}</button>
                  )
                })}
              </div>
            </Field>
          </div>

          {members.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Assigned to">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {members.map(m => (
                    <button key={m.id} type="button" onClick={() => setAssignedToId(m.id)}
                      title={m.name}
                      style={{
                        padding: 2, borderRadius: '50%', background: 'transparent',
                        border: `2px solid ${assignedToId === m.id ? ACCENT : 'transparent'}`,
                        cursor: 'pointer',
                      }}>
                      <MemberAvatar name={m.name} selected={assignedToId === m.id} />
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Due date">
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'light' }}
                  onFocus={e => { e.target.style.borderColor = ACCENT }}
                  onBlur={e => { e.target.style.borderColor = BORDER }}
                />
              </Field>
            </div>
          ) : (
            <Field label="Due date">
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                style={{ ...inputStyle, colorScheme: 'light' }}
                onFocus={e => { e.target.style.borderColor = ACCENT }}
                onBlur={e => { e.target.style.borderColor = BORDER }}
              />
            </Field>
          )}

          {error && (
            <p style={{ margin: 0, fontSize: 12, color: 'oklch(0.55 0.18 28)', fontFamily: 'JetBrains Mono, monospace' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent', border: `1px solid ${BORDER}`,
                color: MUTED, padding: '9px 18px', borderRadius: 6,
                fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              style={{
                background: loading || !title.trim() ? 'oklch(0.65 0.01 60)' : FG,
                color: '#fff', border: 'none',
                padding: '9px 20px', borderRadius: 6,
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                cursor: loading || !title.trim() ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
              }}
            >
              {loading && <Spinner size={13} />}
              {loading ? 'Creating…' : 'Create demand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
        color: MUTED, letterSpacing: 0.6, textTransform: 'uppercase',
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function MemberAvatar({ name, selected }: { name: string; selected: boolean }) {
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: selected ? ACCENT : 'oklch(0.88 0.01 60)',
      color: selected ? '#fff' : FG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
    }}>{initials}</div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', borderRadius: 6,
  border: `1px solid ${BORDER}`,
  fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, color: FG,
  outline: 'none', transition: 'border-color .15s',
  background: 'oklch(0.99 0 0)',
  width: '100%', boxSizing: 'border-box',
}

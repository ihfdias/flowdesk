import { useState } from 'react'
import api from '../../lib/api'
import { Flow } from '../../lib/types'

interface Props {
  onClose: () => void
  onCreated: (flow: Flow) => void
}

const BORDER = 'oklch(0.90 0.005 60)'
const FG = 'oklch(0.18 0.01 60)'
const MUTED = 'oklch(0.50 0.01 60)'
const ACCENT = 'oklch(0.62 0.20 28)'

export default function NewFlowModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!name.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/flows', {
        name: name.trim(),
        description: description.trim() || undefined,
      })
      onCreated(res.data)
    } catch {
      setError('Não foi possível criar o fluxo. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        background: 'oklch(0.18 0.01 60 / 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480, background: 'oklch(1 0 0)',
          borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,.16)',
          animation: 'ndIn .2s cubic-bezier(.2,.7,.3,1)',
        }}
      >
        <style>{`@keyframes ndIn{from{transform:scale(.96) translateY(8px);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

        <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{
              fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
              color: MUTED, letterSpacing: 0.6, textTransform: 'uppercase',
            }}>
              Novo fluxo
            </span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: MUTED, lineHeight: 1, padding: '0 2px' }}
            >
              ×
            </button>
          </div>
          <h2 style={{
            margin: 0,
            fontFamily: 'Instrument Serif, serif',
            fontSize: 28, fontWeight: 400, fontStyle: 'italic',
            letterSpacing: -0.6, lineHeight: 1.1, color: FG,
          }}>
            Qual o nome do fluxo?
          </h2>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Nome *">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Campanha de Lançamento"
              required
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = ACCENT }}
              onBlur={e => { e.target.style.borderColor = BORDER }}
            />
          </Field>

          <Field label="Descrição">
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Opcional…"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = ACCENT }}
              onBlur={e => { e.target.style.borderColor = BORDER }}
            />
          </Field>

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
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              style={{
                background: loading || !name.trim() ? 'oklch(0.65 0.01 60)' : FG,
                color: '#fff', border: 'none',
                padding: '9px 20px', borderRadius: 6,
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
              }}
            >
              {loading ? 'Criando…' : 'Criar fluxo'}
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

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', borderRadius: 6,
  border: `1px solid ${BORDER}`,
  fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, color: FG,
  outline: 'none', transition: 'border-color .15s',
  background: 'oklch(0.99 0 0)',
  width: '100%', boxSizing: 'border-box',
}

import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { Flow } from '../../lib/types'
import Avatar from '../primitives/Avatar'
import { useIsMobile } from '../../lib/useIsMobile'

interface Member {
  id: string
  userId: string
  user: { id: string; name: string; email: string }
}

interface Props {
  flow: Flow
  onClose: () => void
}

const BORDER = 'oklch(0.90 0.005 60)'
const FG = 'oklch(0.18 0.01 60)'
const MUTED = 'oklch(0.50 0.01 60)'
const ACCENT = 'oklch(0.62 0.20 28)'

export default function FlowSettingsModal({ flow, onClose }: Props) {
  const isMobile = useIsMobile()
  const [members, setMembers] = useState<Member[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    api.get(`/api/flows/${flow.id}/members`)
      .then(res => setMembers(res.data))
      .finally(() => setLoadingMembers(false))
  }, [flow.id])

  const handleAdd = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!email.trim() || adding) return
    setAdding(true)
    setAddError(null)
    try {
      const res = await api.post(`/api/flows/${flow.id}/members`, { email: email.trim() })
      setMembers(prev => [...prev, res.data])
      setEmail('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setAddError(msg ?? 'Não foi possível adicionar. Tente novamente.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (member: Member) => {
    setRemovingId(member.userId)
    try {
      await api.delete(`/api/flows/${flow.id}/members/${member.userId}`)
      setMembers(prev => prev.filter(m => m.userId !== member.userId))
    } catch {
      // silently ignore — member stays in list
    } finally {
      setRemovingId(null)
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
          width: isMobile ? 'calc(100vw - 32px)' : 520, background: 'oklch(1 0 0)',
          borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,.16)',
          display: 'flex', flexDirection: 'column',
          animation: 'ndIn .2s cubic-bezier(.2,.7,.3,1)',
          maxHeight: 'calc(100vh - 80px)',
        }}
      >
        <style>{`@keyframes ndIn{from{transform:scale(.96) translateY(8px);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{
              fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
              color: MUTED, letterSpacing: 0.6, textTransform: 'uppercase',
            }}>
              Configurações do fluxo
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
            {flow.name}
          </h2>
        </div>

        {/* Members list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          <div style={{
            fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
            color: MUTED, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 14,
          }}>
            Membros
          </div>

          {loadingMembers ? (
            <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>carregando…</div>
          ) : members.length === 0 ? (
            <div style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>nenhum membro ainda.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {members.map(m => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 10px', borderRadius: 6,
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'oklch(0.97 0.003 80)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <Avatar name={m.user.name} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: FG }}>{m.user.name}</div>
                    <div style={{ fontSize: 11, color: MUTED, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.user.email}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(m)}
                    disabled={removingId === m.userId}
                    style={{
                      background: 'none', border: 'none', cursor: removingId === m.userId ? 'not-allowed' : 'pointer',
                      color: MUTED, fontSize: 16, lineHeight: 1, padding: '2px 6px',
                      borderRadius: 4, opacity: removingId === m.userId ? 0.4 : 1,
                      transition: 'color .1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'oklch(0.55 0.18 28)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = MUTED }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add member footer */}
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 28px' }}>
          {addError && (
            <div style={{ fontSize: 12, color: 'oklch(0.55 0.18 28)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 8 }}>
              {addError}
            </div>
          )}
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setAddError(null) }}
              placeholder="email@exemplo.com"
              disabled={adding}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 6,
                border: `1px solid ${BORDER}`,
                fontFamily: 'inherit', fontSize: 13, color: FG,
                outline: 'none', background: 'oklch(0.99 0 0)',
                opacity: adding ? 0.6 : 1,
                transition: 'border-color .15s',
              }}
              onFocus={e => { e.target.style.borderColor = ACCENT }}
              onBlur={e => { e.target.style.borderColor = BORDER }}
            />
            <button
              type="submit"
              disabled={adding || !email.trim()}
              style={{
                background: adding || !email.trim() ? 'oklch(0.65 0.01 60)' : FG,
                color: '#fff', border: 'none',
                padding: '9px 16px', borderRadius: 6,
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                cursor: adding || !email.trim() ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background .15s',
              }}
            >
              {adding ? '…' : '+ Adicionar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

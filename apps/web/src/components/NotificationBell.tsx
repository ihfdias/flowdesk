import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

interface Notification {
  id: string
  message: string
  read: boolean
  flowId?: string
  createdAt: string
}

const BORDER = 'oklch(0.90 0.005 60)'
const FG = 'oklch(0.18 0.01 60)'
const MUTED = 'oklch(0.50 0.01 60)'

function formatRelativeTime(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  return `há ${Math.floor(hours / 24)}d`
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const poll = () => {
      api.get('/api/notifications').then(res => setNotifications(res.data)).catch(() => {})
    }
    poll()
    const id = setInterval(poll, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleMarkRead = async (n: Notification) => {
    try {
      await api.patch(`/api/notifications/${n.id}/read`)
      setNotifications(prev => prev.filter(x => x.id !== n.id))
      if (n.flowId) {
        setOpen(false)
        navigate(`/board?flowId=${n.flowId}`)
      }
    } catch {
      // silently ignore
    }
  }

  const handleMarkAll = async () => {
    await Promise.allSettled(notifications.map(n => api.patch(`/api/notifications/${n.id}/read`)))
    setNotifications([])
  }

  const count = notifications.length

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative',
          background: 'none', border: `1px solid ${BORDER}`,
          borderRadius: 6, padding: '5px 10px',
          cursor: 'pointer', lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 14 }}>🔔</span>
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            background: 'oklch(0.55 0.22 15)',
            color: '#fff', borderRadius: '50%',
            width: 16, height: 16, fontSize: 9,
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid oklch(1 0 0)',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: 'oklch(1 0 0)',
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,.12)',
          width: 320, zIndex: 90,
          overflow: 'hidden',
          animation: 'fdRise .15s cubic-bezier(.2,.7,.3,1)',
        }}>
          <style>{`@keyframes fdRise{from{transform:translateY(-6px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

          <div style={{
            padding: '10px 16px 8px',
            borderBottom: `1px solid ${BORDER}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
              color: MUTED, letterSpacing: 0.5, textTransform: 'uppercase',
            }}>
              Notificações
            </span>
            {count > 1 && (
              <button
                onClick={handleMarkAll}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
                  color: MUTED, letterSpacing: 0.3,
                }}
              >
                marcar todas como lidas
              </button>
            )}
          </div>

          {count === 0 ? (
            <div style={{
              padding: '20px 16px', fontSize: 13,
              color: MUTED, fontStyle: 'italic', textAlign: 'center',
            }}>
              Nenhuma notificação nova.
            </div>
          ) : (
            notifications.map((n, i) => (
              <div
                key={n.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: i < count - 1 ? `1px solid ${BORDER}` : 'none',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  background: 'oklch(0.99 0.005 80)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.4, color: FG }}>{n.message}</div>
                  <div style={{
                    fontSize: 10, color: MUTED,
                    fontFamily: 'JetBrains Mono, monospace', marginTop: 4,
                  }}>
                    {formatRelativeTime(n.createdAt)}
                  </div>
                </div>
                <button
                  onClick={() => handleMarkRead(n)}
                  title="Marcar como lida"
                  style={{
                    background: 'none', border: `1px solid ${BORDER}`,
                    borderRadius: 4, padding: '2px 7px',
                    cursor: 'pointer', fontSize: 11, color: MUTED,
                    flexShrink: 0, marginTop: 1,
                    transition: 'border-color .1s, color .1s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'oklch(0.55 0.22 15)'
                    e.currentTarget.style.color = 'oklch(0.55 0.22 15)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = BORDER
                    e.currentTarget.style.color = MUTED
                  }}
                >
                  ✓
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

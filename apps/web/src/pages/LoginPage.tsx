import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import api from '../lib/api'

const STAGES = [
  { id: 's1', name: 'Briefing', hue: 28 },
  { id: 's2', name: 'Criação', hue: 320 },
  { id: 's3', name: 'Revisão', hue: 270 },
  { id: 's4', name: 'Aprovação', hue: 200 },
  { id: 's5', name: 'Publicado', hue: 145 },
]

function stageColor(hue: number, variant: 'soft' | 'ink' | 'solid') {
  if (variant === 'soft') return `oklch(0.93 0.06 ${hue})`
  if (variant === 'ink') return `oklch(0.38 0.16 ${hue})`
  return `oklch(0.60 0.20 ${hue})`
}

const C = {
  bg: 'oklch(0.985 0.005 80)',
  leftBg: 'oklch(0.97 0.005 80)',
  fg: 'oklch(0.14 0.01 60)',
  muted: 'oklch(0.50 0.01 60)',
  border: 'oklch(0.88 0.005 60)',
  inputBg: 'oklch(1 0 0)',
  accent: 'oklch(0.62 0.20 28)',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/login', { email, password })
      login(data.token, data.user)
      navigate('/board')
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'grid', gridTemplateColumns: '1.1fr 1fr',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: C.fg, background: C.bg,
    }}>

      {/* Coluna esquerda — manifesto */}
      <div style={{
        padding: '48px 56px',
        background: C.leftBg,
        borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          fontFamily: '"Instrument Serif", Georgia, serif',
          fontSize: 26, fontStyle: 'italic', letterSpacing: -0.4,
        }}>
          FlowDesk<span style={{ color: C.accent }}>.</span>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div>
            <h1 style={{
              margin: 0,
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontSize: 72, fontWeight: 400,
              letterSpacing: -2.2, lineHeight: 0.95,
            }}>
              Onde está<br />
              aquele <em style={{ color: C.accent }}>briefing</em><br />
              <span style={{ color: C.muted }}>mesmo?</span>
            </h1>
            <p style={{
              marginTop: 28, fontSize: 16, lineHeight: 1.55,
              color: C.muted, maxWidth: 420,
            }}>
              FlowDesk é um sistema de gestão de demandas com fluxos
              personalizáveis pra times de marketing e comunicação.
              Briefing, criação, revisão, aprovação — tudo num só lugar,
              sem aquele caos de "qual era a última versão?"
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STAGES.map(s => (
            <span key={s.id} style={{
              fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
              padding: '4px 10px', borderRadius: 999,
              background: stageColor(s.hue, 'soft'),
              color: stageColor(s.hue, 'ink'),
              fontWeight: 600, letterSpacing: 0.3,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: stageColor(s.hue, 'solid') }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {/* Coluna direita — formulário */}
      <div style={{
        padding: '48px 56px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{ maxWidth: 360, width: '100%' }}>
          <div style={{
            fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
            color: C.muted, letterSpacing: 0.6,
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            Bem-vinda de volta
          </div>

          <h2 style={{
            margin: 0,
            fontFamily: '"Instrument Serif", Georgia, serif',
            fontSize: 38, fontWeight: 400,
            letterSpacing: -1, lineHeight: 1.05,
            fontStyle: 'italic',
          }}>
            Entrar.
          </h2>

          <form onSubmit={handleSubmit} style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* E-mail */}
            <label style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>E-mail</span>
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="marina@studio.cc"
                required
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 6,
                  border: `1px solid ${focused === 'email' ? C.accent : C.border}`,
                  background: C.inputBg, color: C.fg,
                  fontFamily: 'inherit', fontSize: 14, outline: 'none',
                  transition: 'border-color .15s', boxSizing: 'border-box',
                }}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </label>

            {/* Senha */}
            <label style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>Senha</span>
                <a href="#" onClick={e => e.preventDefault()} style={{ color: C.muted, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', textDecoration: 'none' }}>esqueci</a>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 6,
                  border: `1px solid ${focused === 'password' ? C.accent : C.border}`,
                  background: C.inputBg, color: C.fg,
                  fontFamily: 'inherit', fontSize: 14, outline: 'none',
                  transition: 'border-color .15s', boxSizing: 'border-box',
                }}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
              />
            </label>

            {error && (
              <p style={{ margin: 0, fontSize: 13, color: 'oklch(0.55 0.20 28)', background: 'oklch(0.96 0.05 28)', padding: '8px 12px', borderRadius: 6 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 8, padding: '12px 16px', borderRadius: 6,
                background: C.fg, color: C.bg, border: 'none',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer', letterSpacing: -0.1,
                opacity: loading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? 'conferindo…' : 'Entrar →'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: C.muted, letterSpacing: 0.4 }}>OU</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>

            <button type="button" style={{
              padding: '11px 16px', borderRadius: 6,
              background: 'transparent', color: C.fg,
              border: `1px solid ${C.border}`,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
            }}>
              Continuar com Google
            </button>
          </form>

          <div style={{ marginTop: 28, fontSize: 12, color: C.muted, textAlign: 'center' }}>
            Primeira vez por aqui?{' '}
            <a href="#" onClick={e => e.preventDefault()} style={{ color: C.fg, fontWeight: 500 }}>
              Crie sua conta
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
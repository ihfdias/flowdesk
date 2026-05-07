import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../lib/auth'
import { COLOR_OPTIONS, stageColor, stageHueFromColor } from '../lib/colors'

type Step = 1 | 2 | 3

interface StageEntry {
  localId: string
  name: string
  color: string
}

const DEFAULT_STAGES: StageEntry[] = [
  { localId: '1', name: 'Briefing',  color: 'orange' },
  { localId: '2', name: 'Criação',   color: 'pink'   },
  { localId: '3', name: 'Revisão',   color: 'purple' },
  { localId: '4', name: 'Aprovação', color: 'cyan'   },
  { localId: '5', name: 'Publicado', color: 'green'  },
]

const BG     = 'oklch(0.97 0.005 80)'
const FG     = 'oklch(0.18 0.01 60)'
const MUTED  = 'oklch(0.50 0.01 60)'
const BORDER = 'oklch(0.90 0.005 60)'
const WHITE  = 'oklch(1 0 0)'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [step, setStep]         = useState<Step>(1)
  const [flowName, setFlowName] = useState('Marketing Digital')
  const [stages, setStages]     = useState<StageEntry[]>(DEFAULT_STAGES)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const nextId                  = useRef(DEFAULT_STAGES.length + 1)

  const addStage = () => {
    const color = COLOR_OPTIONS[stages.length % COLOR_OPTIONS.length].value
    setStages(prev => [...prev, { localId: String(nextId.current++), name: '', color }])
  }

  const updateStage = (localId: string, name: string) =>
    setStages(prev => prev.map(s => s.localId === localId ? { ...s, name } : s))

  const removeStage = (localId: string) =>
    setStages(prev => prev.filter(s => s.localId !== localId))

  const handleCreate = async () => {
    const name  = flowName.trim()
    const valid = stages.filter(s => s.name.trim())
    if (!name || valid.length === 0) return

    setLoading(true)
    setError(null)
    try {
      const { data: flow } = await api.post('/api/flows', { name })
      for (let i = 0; i < valid.length; i++) {
        await api.post(`/api/flows/${flow.id}/stages`, {
          name:  valid[i].name.trim(),
          color: valid[i].color,
          order: i,
        })
      }
      setStages(valid)
      setStep(3)
    } catch {
      setError('Não foi possível criar o fluxo. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const finish = () => {
    localStorage.setItem('flowdesk:onboarded', '1')
    navigate('/board')
  }

  const firstName  = user?.name?.split(' ')[0] ?? 'você'
  const validCount = stages.filter(s => s.name.trim()).length
  const canNext    = step !== 2 || (!!flowName.trim() && validCount > 0)
  const isDisabled = loading || !canNext

  const handlePrimary = step === 1 ? () => setStep(2)
                      : step === 2 ? handleCreate
                      : finish

  const primaryLabel = loading       ? 'Criando…'
                     : step === 2    ? 'Criar fluxo →'
                     : step === 3    ? 'Abrir o board →'
                     : 'Continuar →'

  return (
    <div style={{
      minHeight: '100vh', background: BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif', color: FG,
      padding: 24,
    }}>
      <style>{`
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 480,
        background: WHITE,
        borderRadius: 16,
        boxShadow: '0 2px 48px rgba(0,0,0,.09)',
        overflow: 'hidden',
      }}>

        {/* Conteúdo do passo — animado ao trocar */}
        <div
          key={step}
          style={{ padding: '48px 48px 32px', animation: 'stepIn .3s cubic-bezier(.2,.7,.3,1)' }}
        >
          {step === 1 && <StepWelcome firstName={firstName} />}
          {step === 2 && (
            <StepCreate
              flowName={flowName}
              onFlowNameChange={setFlowName}
              stages={stages}
              onUpdate={updateStage}
              onRemove={removeStage}
              onAdd={addStage}
              error={error}
            />
          )}
          {step === 3 && <StepDone flowName={flowName.trim()} stages={stages} />}
        </div>

        {/* Rodapé: botão + progress */}
        <div style={{ padding: '0 48px 44px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <button
            onClick={handlePrimary}
            disabled={isDisabled}
            style={{
              padding: '14px 20px',
              background: FG, color: WHITE,
              border: 'none', borderRadius: 8,
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              letterSpacing: -0.1,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.4 : 1,
              transition: 'opacity .15s',
            }}
          >
            {primaryLabel}
          </button>

          {/* Barra de progresso + contador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              flex: 1, height: 1, background: BORDER,
              borderRadius: 1, overflow: 'hidden', position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: `${(step / 3) * 100}%`,
                background: FG,
                transition: 'width .45s cubic-bezier(.4,0,.2,1)',
              }} />
            </div>
            <span style={{
              fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
              color: MUTED, letterSpacing: 0.5, flexShrink: 0,
            }}>
              {String(step).padStart(2, '0')} / 03
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}

/* ─── Passo 1: Boas-vindas ─── */

function StepWelcome({ firstName }: { firstName: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <StepLabel>Passo 01 — Boas-vindas</StepLabel>

      <h1 style={{
        margin: 0,
        fontFamily: '"Instrument Serif", Georgia, serif',
        fontSize: 56, fontWeight: 400, fontStyle: 'italic',
        letterSpacing: -2.2, lineHeight: 0.95,
      }}>
        Olá,<br />
        <span style={{ color: 'oklch(0.60 0.16 28)' }}>{firstName}.</span>
      </h1>

      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'oklch(0.42 0.01 60)' }}>
        Em dois minutos você vai ter seu primeiro fluxo de trabalho montado —
        com as etapas que fazem sentido pro seu time.
      </p>
    </div>
  )
}

/* ─── Passo 2: Criar fluxo ─── */

interface StepCreateProps {
  flowName: string
  onFlowNameChange: (v: string) => void
  stages: StageEntry[]
  onUpdate: (id: string, name: string) => void
  onRemove: (id: string) => void
  onAdd: () => void
  error: string | null
}

function StepCreate({
  flowName, onFlowNameChange,
  stages, onUpdate, onRemove, onAdd,
  error,
}: StepCreateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <StepLabel>Passo 02 — Seu fluxo</StepLabel>
        <h2 style={{
          margin: '16px 0 0',
          fontFamily: '"Instrument Serif", Georgia, serif',
          fontSize: 36, fontWeight: 400, fontStyle: 'italic',
          letterSpacing: -1.4, lineHeight: 1.05,
        }}>
          Como chamar seu<br />primeiro fluxo?
        </h2>
      </div>

      {/* Nome do fluxo */}
      <input
        autoFocus
        value={flowName}
        onChange={e => onFlowNameChange(e.target.value)}
        placeholder="Ex: Marketing Digital"
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '10px 14px', borderRadius: 6,
          border: `1px solid ${BORDER}`,
          background: 'oklch(0.99 0 0)',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 14, color: FG,
          outline: 'none', transition: 'border-color .15s',
        }}
        onFocus={e => { e.target.style.borderColor = FG }}
        onBlur={e => { e.target.style.borderColor = BORDER }}
      />

      {/* Etapas */}
      <div>
        <FieldLabel>Etapas</FieldLabel>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          marginTop: 10, maxHeight: 220, overflowY: 'auto',
        }}>
          {stages.map((stage, idx) => {
            const hue = stageHueFromColor(stage.color, idx)
            return (
              <div key={stage.localId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: stageColor(hue, 'solid'),
                }} />
                <input
                  value={stage.name}
                  onChange={e => onUpdate(stage.localId, e.target.value)}
                  placeholder="Nome da etapa"
                  style={{
                    flex: 1, padding: '7px 10px', borderRadius: 5,
                    border: `1px solid ${BORDER}`,
                    background: 'oklch(0.99 0 0)',
                    fontFamily: 'inherit', fontSize: 13, color: FG,
                    outline: 'none', transition: 'border-color .15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = stageColor(hue, 'solid') }}
                  onBlur={e => { e.target.style.borderColor = BORDER }}
                />
                {stages.length > 1 && (
                  <button
                    onClick={() => onRemove(stage.localId)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: MUTED, fontSize: 18, lineHeight: 1,
                      padding: '2px 5px', borderRadius: 4,
                      transition: 'color .15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.45 0.16 28)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = MUTED }}
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={onAdd}
          style={{
            marginTop: 8, background: 'none', border: 'none',
            cursor: 'pointer', padding: '6px 0',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontFamily: 'inherit', color: MUTED,
            transition: 'color .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = FG }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = MUTED }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Adicionar etapa
        </button>
      </div>

      {error && (
        <p style={{
          margin: 0, fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
          color: 'oklch(0.55 0.18 28)',
          background: 'oklch(0.97 0.04 28)',
          padding: '8px 12px', borderRadius: 6,
        }}>
          {error}
        </p>
      )}
    </div>
  )
}

/* ─── Passo 3: Confirmação ─── */

function StepDone({ flowName, stages }: { flowName: string; stages: StageEntry[] }) {
  const count = stages.length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <StepLabel>Passo 03 — Tudo certo!</StepLabel>

      <h2 style={{
        margin: 0,
        fontFamily: '"Instrument Serif", Georgia, serif',
        fontSize: 44, fontWeight: 400, fontStyle: 'italic',
        letterSpacing: -1.8, lineHeight: 1.0,
      }}>
        Seu fluxo<br />está no ar.
      </h2>

      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'oklch(0.42 0.01 60)' }}>
        Você criou <strong style={{ color: FG }}>{flowName}</strong> com{' '}
        {count} {count === 1 ? 'etapa' : 'etapas'}.
      </p>

      {/* Preview das etapas como chips com setas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {stages.map((s, i) => {
          const hue = stageHueFromColor(s.color, i)
          return (
            <span key={s.localId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && (
                <span style={{ fontSize: 10, color: MUTED }}>→</span>
              )}
              <span style={{
                fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                padding: '4px 10px', borderRadius: 999,
                background: stageColor(hue, 'soft'),
                color: stageColor(hue, 'ink'),
                fontWeight: 600, letterSpacing: 0.3,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                  background: stageColor(hue, 'solid'),
                }} />
                {s.name}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Helpers de label ─── */

function StepLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
      color: MUTED, letterSpacing: 0.6, textTransform: 'uppercase',
    }}>
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
      color: MUTED, letterSpacing: 0.5, textTransform: 'uppercase',
    }}>
      {children}
    </div>
  )
}

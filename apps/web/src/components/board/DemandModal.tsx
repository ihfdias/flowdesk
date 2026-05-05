import { Demand, Flow } from '../../lib/types'
import { getStageHue } from '../../lib/colors'
import StageChip from '../primitives/StageChip'
import Avatar from '../primitives/Avatar'
import DueDate from '../primitives/DueDate'

interface Props {
  demand: Demand
  flow: Flow
  onClose: () => void
  onAdvance: (demandId: string) => Promise<void>
}

const C = {
  overlay: 'rgba(0,0,0,0.25)',
  bg: 'oklch(1 0 0)',
  border: 'oklch(0.90 0.005 60)',
  muted: 'oklch(0.50 0.01 60)',
  subtle: 'oklch(0.96 0.005 60)',
  accent: 'oklch(0.62 0.20 28)',
}

export default function DemandModal({ demand, flow, onClose, onAdvance }: Props) {
  const hue = getStageHue(demand.currentStage.order)

  const currentIdx = flow.stages.findIndex(s => s.id === demand.currentStageId)
  const nextStage = flow.stages[currentIdx + 1]
  const isLast = !nextStage

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: C.overlay,
        backdropFilter: 'blur(2px)',
        zIndex: 100,
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '62%', maxWidth: 720,
          height: '100%',
          background: C.bg,
          borderLeft: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
          animation: 'slideIn .2s ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 28px 16px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <StageChip name={demand.currentStage.name} hue={hue} size="sm" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                color: C.muted, letterSpacing: 0.3,
              }}>
                #{demand.id.slice(0, 8).toUpperCase()}
              </span>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 20, color: C.muted, lineHeight: 1,
                  padding: '0 2px',
                }}
              >
                ×
              </button>
            </div>
          </div>

          <h2 style={{
            margin: 0,
            fontFamily: 'Instrument Serif, serif',
            fontSize: 28, fontWeight: 400, fontStyle: 'italic',
            lineHeight: 1.2, letterSpacing: -0.3,
            color: 'oklch(0.15 0.01 60)',
          }}>
            {demand.title}
          </h2>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Meta */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16,
            padding: 16,
            background: C.subtle,
            borderRadius: 8,
          }}>
            <MetaField label="Solicitante">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Avatar name={demand.requestedBy.name} size={18} />
                <span style={{ fontSize: 13 }}>{demand.requestedBy.name}</span>
              </div>
            </MetaField>
            <MetaField label="Responsável">
              {demand.assignedTo ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Avatar name={demand.assignedTo.name} size={18} />
                  <span style={{ fontSize: 13 }}>{demand.assignedTo.name}</span>
                </div>
              ) : (
                <span style={{ fontSize: 13, color: C.muted }}>—</span>
              )}
            </MetaField>
            <MetaField label="Prazo">
              {demand.dueDate
                ? <DueDate date={demand.dueDate} />
                : <span style={{ fontSize: 13, color: C.muted }}>—</span>
              }
            </MetaField>
          </div>

          {/* Description */}
          {demand.description && (
            <div>
              <SectionLabel>Descrição</SectionLabel>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: 'oklch(0.30 0.01 60)' }}>
                {demand.description}
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'flex-end',
        }}>
          {isLast ? (
            <span style={{ fontSize: 13, color: C.muted, fontFamily: 'JetBrains Mono, monospace' }}>
              Etapa final
            </span>
          ) : (
            <button
              onClick={() => onAdvance(demand.id)}
              style={{
                background: C.accent,
                color: '#fff',
                border: 'none', borderRadius: 6,
                padding: '10px 20px',
                fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              Avançar para {nextStage.name} →
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
    </div>
  )
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
        color: 'oklch(0.55 0.01 60)', textTransform: 'uppercase', letterSpacing: 0.6,
      }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
      color: 'oklch(0.55 0.01 60)', textTransform: 'uppercase', letterSpacing: 0.6,
      marginBottom: 8,
    }}>
      {children}
    </div>
  )
}
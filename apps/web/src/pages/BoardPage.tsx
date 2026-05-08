import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../lib/auth'
import { Flow, Demand, User } from '../lib/types'
import { stageHueFromColor, stageColor } from '../lib/colors'
import DemandCard from '../components/board/DemandCard'
import DemandModal from '../components/board/DemandModal'
import NewDemandModal from '../components/board/NewDemandModal'
import NewFlowModal from '../components/board/NewFlowModal'
import FlowSettingsModal from '../components/board/FlowSettingsModal'
import CommandPalette from '../components/CommandPalette'
import NotificationBell from '../components/NotificationBell'

const STAGE_GLYPHS = ['◐', '✺', '◇', '◈', '●', '◉', '◎']
const getGlyph = (order: number) => STAGE_GLYPHS[order % STAGE_GLYPHS.length]

const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function formatEditorialDate() {
  const now = new Date()
  const day = DAY_NAMES[now.getDay()]
  const date = String(now.getDate()).padStart(2, '0')
  const month = MONTH_NAMES[now.getMonth()]
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${day}. ${date}/${month} · ${h}:${m}`
}

const C = {
  bg: 'oklch(0.985 0.005 80)',
  fg: 'oklch(0.18 0.01 60)',
  muted: 'oklch(0.50 0.01 60)',
  border: 'oklch(0.90 0.005 60)',
  surface: 'oklch(0.97 0.005 80)',
  cardBg: 'oklch(1 0 0)',
  headerBg: 'oklch(1 0 0)',
}

export default function BoardPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [flows, setFlows] = useState<Flow[]>([])
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null)
  const [demands, setDemands] = useState<Demand[]>([])
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null)
  const [showNewDemand, setShowNewDemand] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [members, setMembers] = useState<User[]>([])
  const [showPalette, setShowPalette] = useState(false)
  const [showNewFlow, setShowNewFlow] = useState(false)
  const [showFlowSettings, setShowFlowSettings] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); setShowPalette(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    api.get('/api/flows')
      .then(res => {
        if (res.data.length === 0 && !localStorage.getItem('flowdesk:onboarded')) {
          navigate('/onboarding')
          return
        }
        setFlows(res.data)
        if (res.data.length > 0) setSelectedFlow(res.data[0])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const flowId = searchParams.get('flowId')
    if (!flowId || flows.length === 0) return
    const target = flows.find(f => f.id === flowId)
    if (target) {
      setSelectedFlow(target)
      setSearchParams({})
    }
  }, [flows, searchParams])

  useEffect(() => {
    if (!selectedFlow) { setMembers([]); return }
    api.get(`/api/demands?flowId=${selectedFlow.id}`).then(res => setDemands(res.data))
    api.get(`/api/flows/${selectedFlow.id}/members`).then(res => setMembers(res.data.map((m: { user: User }) => m.user)))
  }, [selectedFlow])

  const reloadDemands = useCallback(async () => {
    if (!selectedFlow) return
    const res = await api.get(`/api/demands?flowId=${selectedFlow.id}`)
    setDemands(res.data)
  }, [selectedFlow])

  const handleDrop = useCallback(async (stageId: string) => {
    if (!draggingId || !selectedFlow) return
    const demand = demands.find(d => d.id === draggingId)
    if (!demand || demand.currentStageId === stageId) return

    const prevStage = demand.currentStage
    const nextStage = selectedFlow.stages.find(s => s.id === stageId)!

    setDemands(prev => prev.map(d =>
      d.id === draggingId ? { ...d, currentStageId: stageId, currentStage: nextStage } : d
    ))

    try {
      await api.patch(`/api/demands/${draggingId}/move`, { toStageId: stageId })
    } catch {
      setDemands(prev => prev.map(d =>
        d.id === draggingId ? { ...d, currentStageId: prevStage.id, currentStage: prevStage } : d
      ))
    }
  }, [draggingId, demands, selectedFlow])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  const handleAdvance = useCallback(async (demandId: string) => {
    try {
      await api.patch(`/api/demands/${demandId}/advance`, {})
      await reloadDemands()
      setSelectedDemand(null)
    } catch {
      showToast('Erro ao avançar demanda. Tente novamente.')
    }
  }, [reloadDemands, showToast])


  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: C.muted }}>carregando...</span>
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, color: C.fg, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <header style={{
        padding: '20px 32px 16px',
        background: C.headerBg,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 24,
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          fontFamily: 'Instrument Serif, serif',
          fontSize: 28, fontWeight: 400, fontStyle: 'italic',
          letterSpacing: -0.8, lineHeight: 1,
        }}>
          FlowDesk<span style={{ color: 'oklch(0.62 0.20 28)' }}>.</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Flow selector */}
        <FlowSelector
          flows={flows}
          selectedFlow={selectedFlow}
          onSelect={setSelectedFlow}
          onNewFlow={() => setShowNewFlow(true)}
        />

        {/* Team avatars + settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {members.length > 0 && (
            <div style={{ display: 'flex' }}>
              {members.slice(0, 5).map((member, i) => (
                <TeamAvatar key={member.id} name={member.name} index={i} />
              ))}
            </div>
          )}
          <button
            onClick={() => setShowFlowSettings(true)}
            title="Configurações do time"
            style={{
              background: 'none', border: `1px solid ${C.border}`,
              borderRadius: 6, padding: '5px 10px',
              fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
              color: C.muted, cursor: 'pointer',
              letterSpacing: 0.4, textTransform: 'uppercase',
            }}
          >
            Time
          </button>
        </div>

        {/* Notificações */}
        <NotificationBell />

        {/* ⌘K */}
        <button
          onClick={() => setShowPalette(true)}
          style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.muted, padding: '7px 12px', borderRadius: 6,
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
            cursor: 'pointer', letterSpacing: 0.4, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span>⌘K</span>
        </button>

        {/* Editar fluxo */}
        <button
          onClick={() => selectedFlow && navigate(`/flows/${selectedFlow.id}/edit`)}
          style={{
            background: 'transparent', color: C.fg,
            border: `1px solid ${C.border}`, padding: '7px 12px', borderRadius: 6,
            fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            letterSpacing: -0.1,
          }}
        >
          Editar fluxo
        </button>

        {/* Nova demanda */}
        <button
          onClick={() => setShowNewDemand(true)}
          style={{
            background: C.fg, color: 'oklch(0.98 0 0)',
            border: 'none', padding: '8px 14px', borderRadius: 6,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nova demanda
        </button>

        {/* Sair */}
        <button
          onClick={logout}
          style={{
            background: 'none', border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '5px 12px',
            fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
            color: C.muted, cursor: 'pointer',
            letterSpacing: 0.4, textTransform: 'uppercase',
          }}
        >
          Sair
        </button>
      </header>

      {/* ── Mantra editorial ── */}
      <div style={{ padding: '24px 32px 16px', display: 'flex', alignItems: 'baseline', gap: 16, flexShrink: 0 }}>
        <div style={{
          fontFamily: 'Instrument Serif, serif',
          fontSize: 42, fontWeight: 400, letterSpacing: -1.4, lineHeight: 1,
          fontStyle: 'italic',
        }}>
          {demands.length}{' '}
          <span style={{ color: C.muted, fontStyle: 'normal' }}>demandas em jogo,</span>
        </div>
        <div style={{ fontSize: 13, color: C.muted, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.3 }}>
          {formatEditorialDate()}
        </div>
      </div>

      {/* ── Board ── */}
      <div style={{
        flex: 1, overflowX: 'auto', overflowY: 'hidden',
        display: 'grid',
        gridTemplateColumns: selectedFlow
          ? `repeat(${selectedFlow.stages.length}, minmax(220px, 1fr))`
          : '1fr',
        gap: 12,
        padding: '12px 32px 32px',
        alignItems: 'start',
      }}>
        {selectedFlow?.stages.map(stage => {
          const hue = stageHueFromColor(stage.color, stage.order)
          const glyph = getGlyph(stage.order)
          const stageDemands = demands.filter(d => d.currentStageId === stage.id)
          const isOver = dragOverStage === stage.id

          return (
            <div
              key={stage.id}
              onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id) }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null)
              }}
              onDrop={() => { handleDrop(stage.id); setDragOverStage(null) }}
              style={{
                background: isOver ? stageColor(hue, 'softer') : C.surface,
                borderRadius: 8,
                padding: 12,
                display: 'flex', flexDirection: 'column', gap: 10,
                border: `1px solid ${isOver ? stageColor(hue, 'ring') : C.border}`,
                transition: 'background .15s, border-color .15s',
                minHeight: 200,
              }}
            >
              {/* Column header */}
              <div style={{ padding: '4px 4px 8px', borderBottom: `1px dashed ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: stageColor(hue, 'solid'), fontSize: 14 }}>{glyph}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>{stage.name}</span>
                  </div>
                  <span style={{
                    fontFamily: 'Instrument Serif, serif',
                    fontStyle: 'italic',
                    fontSize: 22, lineHeight: 1,
                    color: stageColor(hue, 'solid'),
                  }}>
                    {stageDemands.length}
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 6, height: 2, background: 'oklch(0.92 0.005 60)', borderRadius: 1, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(stageDemands.length / 3, 1) * 100}%`,
                    background: stageColor(hue, 'solid'),
                    transition: 'width .3s',
                  }} />
                </div>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
                {stageDemands.map(demand => (
                  <DemandCard
                    key={demand.id}
                    demand={demand}
                    isDragging={draggingId === demand.id}
                    onDragStart={(e, id) => { e.dataTransfer.effectAllowed = 'move'; setDraggingId(id) }}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => setSelectedDemand(demand)}
                  />
                ))}

                {stageDemands.length === 0 && (
                  <div style={{
                    fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                    color: C.muted, textAlign: 'center',
                    padding: '24px 8px', fontStyle: 'italic',
                  }}>
                    silêncio constrangedor
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {(!selectedFlow || selectedFlow.stages.length === 0) && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.muted, fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
          }}>
            Nenhum fluxo encontrado.
          </div>
        )}
      </div>

      {selectedDemand && selectedFlow && (
        <DemandModal
          demand={selectedDemand}
          flow={selectedFlow}
          onClose={() => setSelectedDemand(null)}
          onAdvance={handleAdvance}
        />
      )}

      {showNewDemand && selectedFlow && (
        <NewDemandModal
          flow={selectedFlow}
          members={members}
          onClose={() => setShowNewDemand(false)}
          onCreated={async () => {
            setShowNewDemand(false)
            await reloadDemands()
          }}
        />
      )}

      {showFlowSettings && selectedFlow && (
        <FlowSettingsModal
          flow={selectedFlow}
          onClose={() => {
            setShowFlowSettings(false)
            api.get(`/api/flows/${selectedFlow.id}/members`)
              .then(res => setMembers(res.data.map((m: { user: User }) => m.user)))
          }}
        />
      )}

      {showNewFlow && (
        <NewFlowModal
          onClose={() => setShowNewFlow(false)}
          onCreated={flow => {
            setFlows(prev => [flow, ...prev])
            setSelectedFlow(flow)
            setShowNewFlow(false)
          }}
        />
      )}

      {showPalette && (
        <CommandPalette
          demands={demands}
          flow={selectedFlow}
          onClose={() => setShowPalette(false)}
          onSelectDemand={d => { setSelectedDemand(d); setShowPalette(false) }}
          onOpenNewDemand={() => setShowNewDemand(true)}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'oklch(0.18 0.01 60)', color: 'oklch(0.95 0 0)',
          padding: '10px 20px', borderRadius: 8,
          fontSize: 13, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.2,
          boxShadow: '0 4px 20px rgba(0,0,0,.2)',
          zIndex: 200, whiteSpace: 'nowrap',
          animation: 'ndIn .2s ease',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function FlowSelector({ flows, selectedFlow, onSelect, onNewFlow }: {
  flows: Flow[]
  selectedFlow: Flow | null
  onSelect: (flow: Flow) => void
  onNewFlow: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'JetBrains Mono, monospace', padding: '4px 8px',
          borderRadius: 4,
        }}
      >
        <span style={{ fontSize: 10, color: C.muted, letterSpacing: 0.6 }}>FLUXO</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.fg, letterSpacing: 0.3, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedFlow?.name ?? '—'}
        </span>
        <span style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          background: 'oklch(1 0 0)',
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,.12)',
          minWidth: 220, zIndex: 90,
          overflow: 'hidden',
        }}>
          {flows.map(f => (
            <button
              key={f.id}
              onClick={() => { onSelect(f); setOpen(false) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: f.id === selectedFlow?.id ? 'oklch(0.96 0.005 80)' : 'transparent',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                color: C.fg, letterSpacing: 0.2,
              }}
              onMouseEnter={e => { if (f.id !== selectedFlow?.id) e.currentTarget.style.background = 'oklch(0.97 0.003 80)' }}
              onMouseLeave={e => { e.currentTarget.style.background = f.id === selectedFlow?.id ? 'oklch(0.96 0.005 80)' : 'transparent' }}
            >
              <span>{f.name}</span>
              {f.id === selectedFlow?.id && (
                <span style={{ fontSize: 11, color: 'oklch(0.62 0.20 28)' }}>✓</span>
              )}
            </button>
          ))}

          <div style={{ borderTop: `1px solid ${C.border}` }}>
            <button
              onClick={() => { setOpen(false); onNewFlow() }}
              style={{
                width: '100%', padding: '9px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: 'transparent',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                color: 'oklch(0.62 0.20 28)', letterSpacing: 0.2,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'oklch(0.98 0.02 28)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
              <span>Novo fluxo</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Inline avatar para o header — sem import extra
function TeamAvatar({ name, index }: { name: string; index: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('')
  // Simple hash for hue
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  const hue = Math.abs(h) % 360
  return (
    <div
      title={name}
      style={{
        width: 26, height: 26, borderRadius: '50%',
        background: `linear-gradient(135deg, oklch(0.72 0.14 ${hue}), oklch(0.55 0.18 ${(hue + 40) % 360}))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: 0.3,
        border: '2px solid oklch(1 0 0)',
        marginLeft: index === 0 ? 0 : -8,
        zIndex: 5 - index,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {initials.toUpperCase()}
    </div>
  )
}
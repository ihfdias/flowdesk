import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { useAuth } from '../lib/auth'
import { Flow, Demand } from '../lib/types'
import { getStageHue, stageColor } from '../lib/colors'
import DemandCard from '../components/board/DemandCard'
import DemandModal from '../components/board/DemandModal'

export default function BoardPage() {
  const { logout } = useAuth()
  const [flows, setFlows] = useState<Flow[]>([])
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null)
  const [demands, setDemands] = useState<Demand[]>([])
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null)

  useEffect(() => {
    api.get('/api/flows')
      .then(res => {
        setFlows(res.data)
        if (res.data.length > 0) setSelectedFlow(res.data[0])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedFlow) return
    api.get(`/api/demands?flowId=${selectedFlow.id}`).then(res => setDemands(res.data))
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

    // Optimistic update
    setDemands(prev => prev.map(d =>
      d.id === draggingId ? { ...d, currentStageId: stageId, currentStage: nextStage } : d
    ))

    try {
      await api.post(`/api/demands/${draggingId}/move`, { stageId })
    } catch {
      // Rollback
      setDemands(prev => prev.map(d =>
        d.id === draggingId ? { ...d, currentStageId: prevStage.id, currentStage: prevStage } : d
      ))
    }
  }, [draggingId, demands, selectedFlow])

  const handleAdvance = useCallback(async (demandId: string) => {
    await api.post(`/api/demands/${demandId}/advance`)
    await reloadDemands()
    setSelectedDemand(null)
  }, [reloadDemands])

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'oklch(0.55 0.01 60)' }}>
        carregando...
      </span>
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'oklch(0.97 0.005 80)' }}>

      {/* Header */}
      <header style={{
        height: 56, flexShrink: 0,
        background: 'oklch(1 0 0)',
        borderBottom: '1px solid oklch(0.90 0.005 60)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <span style={{
          fontFamily: 'Instrument Serif, serif',
          fontSize: 22, fontStyle: 'italic',
          color: 'oklch(0.15 0.01 60)',
        }}>
          FlowDesk
        </span>

        <div style={{ width: 1, height: 20, background: 'oklch(0.88 0.005 60)' }} />

        <select
          value={selectedFlow?.id ?? ''}
          onChange={e => setSelectedFlow(flows.find(f => f.id === e.target.value) ?? null)}
          style={{
            border: '1px solid oklch(0.88 0.005 60)',
            borderRadius: 6, padding: '4px 10px',
            fontSize: 13, fontFamily: 'inherit',
            background: 'oklch(0.97 0.005 80)',
            color: 'oklch(0.20 0.01 60)',
            cursor: 'pointer', outline: 'none',
          }}
        >
          {flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        <button
          onClick={logout}
          style={{
            background: 'none', border: '1px solid oklch(0.88 0.005 60)',
            borderRadius: 6, padding: '5px 12px',
            fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
            color: 'oklch(0.50 0.01 60)', cursor: 'pointer',
            letterSpacing: 0.4, textTransform: 'uppercase',
          }}
        >
          Sair
        </button>
      </header>

      {/* Board */}
      <div style={{
        flex: 1, overflowX: 'auto', overflowY: 'hidden',
        display: 'flex', gap: 12,
        padding: '20px 24px',
        alignItems: 'flex-start',
      }}>
        {selectedFlow?.stages.map(stage => {
          const hue = getStageHue(stage.order)
          const stageDemands = demands.filter(d => d.currentStageId === stage.id)
          const isOver = dragOverStage === stage.id

          return (
            <div
              key={stage.id}
              onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id) }}
              onDragLeave={e => {
                // Only clear if leaving the column entirely (not entering a child)
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverStage(null)
                }
              }}
              onDrop={() => { handleDrop(stage.id); setDragOverStage(null) }}
              style={{
                width: 280, flexShrink: 0,
                display: 'flex', flexDirection: 'column', gap: 8,
                background: isOver ? stageColor(hue, 'softer') : 'transparent',
                borderRadius: 10, padding: 8,
                transition: 'background .12s',
                maxHeight: '100%',
              }}
            >
              {/* Column header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 2px', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: stageColor(hue, 'solid'),
                    display: 'inline-block', flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: 0.5, textTransform: 'uppercase',
                    color: 'oklch(0.30 0.01 60)',
                  }}>
                    {stage.name}
                  </span>
                </div>
                <span style={{
                  fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                  color: 'oklch(0.55 0.01 60)',
                  background: 'oklch(0.92 0.005 60)',
                  padding: '1px 7px', borderRadius: 999,
                }}>
                  {stageDemands.length}
                </span>
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
                    padding: '28px 0', textAlign: 'center',
                    fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                    color: 'oklch(0.72 0.005 60)',
                    borderRadius: 8,
                    border: isOver ? `2px dashed ${stageColor(hue, 'ring')}` : '2px dashed transparent',
                    transition: 'border .12s',
                  }}>
                    vazio
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {(!selectedFlow || selectedFlow.stages.length === 0) && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'oklch(0.55 0.01 60)',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
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
    </div>
  )
}
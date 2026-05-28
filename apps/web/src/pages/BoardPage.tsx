import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../lib/auth'
import { Flow, Demand, User } from '../lib/types'
import { useIsMobile } from '../lib/useIsMobile'
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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  const [flows, setFlows] = useState<Flow[]>([])
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null)
  const [demands, setDemands] = useState<Demand[]>([])
  const [loading, setLoading] = useState(true)
  const [demandsLoading, setDemandsLoading] = useState(false)
  const [lastMovedId, setLastMovedId] = useState<string | null>(null)
  const [confettiActive, setConfettiActive] = useState(false)
  const [confettiHue, setConfettiHue] = useState(145)
  const [dismissedBannerIds, setDismissedBannerIds] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null)
  const [showNewDemand, setShowNewDemand] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [members, setMembers] = useState<User[]>([])
  const [showPalette, setShowPalette] = useState(false)
  const [showNewFlow, setShowNewFlow] = useState(false)
  const [showFlowSettings, setShowFlowSettings] = useState(false)
  const [activeMobileStageId, setActiveMobileStageId] = useState<string | null>(null)
  const [filterAssignees, setFilterAssignees] = useState<Set<string>>(new Set())
  const [filterPriorities, setFilterPriorities] = useState<Set<string>>(new Set())
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set())
  const [filterDue, setFilterDue] = useState<'overdue' | 'today' | 'week' | null>(null)

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
    setDemandsLoading(true)
    setFilterAssignees(new Set())
    setFilterPriorities(new Set())
    setFilterTags(new Set())
    setFilterDue(null)
    api.get(`/api/demands?flowId=${selectedFlow.id}`)
      .then(res => setDemands(res.data))
      .finally(() => setDemandsLoading(false))
    api.get(`/api/flows/${selectedFlow.id}/members`).then(res => setMembers(res.data.map((m: { user: User }) => m.user)))
    if (selectedFlow.stages.length > 0) {
      setActiveMobileStageId(prev => {
        const stillValid = prev && selectedFlow.stages.some(s => s.id === prev)
        return stillValid ? prev : selectedFlow.stages[0].id
      })
    }
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

    // arrival animation
    const movedId = draggingId
    setLastMovedId(movedId)
    setTimeout(() => setLastMovedId(prev => prev === movedId ? null : prev), 1200)

    // confetti when reaching last stage
    const lastStage = selectedFlow.stages[selectedFlow.stages.length - 1]
    if (stageId === lastStage?.id) {
      const hue = stageHueFromColor(lastStage.color, lastStage.order)
      setConfettiHue(hue)
      setConfettiActive(true)
      setTimeout(() => setConfettiActive(false), 2700)
    }

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

  const blockerDemand = useMemo(() => {
    if (!selectedFlow || demandsLoading || demands.length === 0 || selectedFlow.stages.length < 2) return null
    const firstId = selectedFlow.stages[0].id
    const lastId = selectedFlow.stages[selectedFlow.stages.length - 1].id
    const now = Date.now()
    const candidates = demands
      .filter(d => d.currentStageId !== firstId && d.currentStageId !== lastId && !dismissedBannerIds.has(d.id))
      .map(d => ({ demand: d, daysOld: Math.floor((now - new Date(d.createdAt).getTime()) / 86400000) }))
      .filter(c => c.daysOld >= 4)
      .sort((a, b) => b.daysOld - a.daysOld)
    return candidates[0] ?? null
  }, [demands, selectedFlow, demandsLoading, dismissedBannerIds])

  const toggleAssignee = useCallback((id: string) => {
    setFilterAssignees(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }, [])
  const togglePriority = useCallback((p: string) => {
    setFilterPriorities(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s })
  }, [])
  const toggleTag = useCallback((t: string) => {
    setFilterTags(prev => { const s = new Set(prev); s.has(t) ? s.delete(t) : s.add(t); return s })
  }, [])
  const clearFilters = useCallback(() => {
    setFilterAssignees(new Set()); setFilterPriorities(new Set()); setFilterTags(new Set()); setFilterDue(null)
  }, [])

  const isFiltered = filterAssignees.size > 0 || filterPriorities.size > 0 || filterTags.size > 0 || filterDue !== null

  const availableTags = useMemo(() =>
    Array.from(new Set(demands.map(d => d.tag).filter(Boolean) as string[])).sort()
  , [demands])

  const filteredDemands = useMemo(() => {
    return demands.filter(d => {
      if (filterAssignees.size > 0 && (!d.assignedTo || !filterAssignees.has(d.assignedTo.id))) return false
      if (filterPriorities.size > 0 && !filterPriorities.has(d.priority ?? '')) return false
      if (filterTags.size > 0 && !filterTags.has(d.tag ?? '')) return false
      if (filterDue) {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const due = d.dueDate ? new Date(d.dueDate) : null
        if (filterDue === 'overdue') { if (!due || due >= today) return false }
        if (filterDue === 'today') {
          const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
          if (!due || due < today || due >= tomorrow) return false
        }
        if (filterDue === 'week') {
          const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7)
          if (!due || due < today || due >= weekEnd) return false
        }
      }
      return true
    })
  }, [demands, filterAssignees, filterPriorities, filterTags, filterDue])

  const handleAdvance = useCallback(async (demandId: string) => {
    // capture pre-advance position to detect last-stage arrival
    const demand = demands.find(d => d.id === demandId)
    const willReachLastStage = demand && selectedFlow &&
      selectedFlow.stages.findIndex(s => s.id === demand.currentStageId) === selectedFlow.stages.length - 2

    try {
      await api.patch(`/api/demands/${demandId}/advance`, {})
      await reloadDemands()

      setLastMovedId(demandId)
      setTimeout(() => setLastMovedId(prev => prev === demandId ? null : prev), 1200)

      if (willReachLastStage && selectedFlow) {
        const lastStage = selectedFlow.stages[selectedFlow.stages.length - 1]
        setConfettiHue(stageHueFromColor(lastStage.color, lastStage.order))
        setConfettiActive(true)
        setTimeout(() => setConfettiActive(false), 2700)
      }

      setSelectedDemand(null)
    } catch {
      showToast('Error advancing demand. Try again.')
    }
  }, [reloadDemands, showToast, demands, selectedFlow])

  const handleArchive = useCallback(async (demandId: string) => {
    try {
      await api.patch(`/api/demands/${demandId}/archive`)
      setDemands(prev => prev.filter(d => d.id !== demandId))
      setSelectedDemand(null)
      showToast('Demand completed!')
    } catch {
      showToast('Error completing demand. Try again.')
    }
  }, [showToast])

  const activeStageDemands = activeMobileStageId
    ? filteredDemands.filter(d => d.currentStageId === activeMobileStageId)
    : []

  if (loading) return <BoardSkeleton />

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, color: C.fg, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <header style={{
        padding: isMobile ? '12px 16px' : '20px 32px 16px',
        background: C.headerBg,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 24,
        flexShrink: 0,
        flexWrap: 'nowrap',
      }}>
        {/* Logo */}
        <div style={{
          fontFamily: 'Instrument Serif, serif',
          fontSize: isMobile ? 22 : 28, fontWeight: 400, fontStyle: 'italic',
          letterSpacing: -0.8, lineHeight: 1, flexShrink: 0,
        }}>
          FlowDesk<span style={{ color: 'oklch(0.62 0.20 28)' }}>.</span>
        </div>

        {/* Flow selector */}
        <FlowSelector
          flows={flows}
          selectedFlow={selectedFlow}
          onSelect={setSelectedFlow}
          onNewFlow={() => setShowNewFlow(true)}
        />

        <div style={{ flex: 1 }} />

        {/* Team avatars + settings — desktop only */}
        {!isMobile && (
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
              title="Team settings"
              style={{
                background: 'none', border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '5px 10px',
                fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                color: C.muted, cursor: 'pointer',
                letterSpacing: 0.4, textTransform: 'uppercase',
              }}
            >
              Team
            </button>
          </div>
        )}

        {/* Notifications */}
        <NotificationBell />

        {/* ⌘K — desktop only */}
        {!isMobile && (
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
        )}

        {/* Edit flow — desktop only */}
        {!isMobile && (
          <button
            onClick={() => selectedFlow && navigate(`/flows/${selectedFlow.id}/edit`)}
            style={{
              background: 'transparent', color: C.fg,
              border: `1px solid ${C.border}`, padding: '7px 12px', borderRadius: 6,
              fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              letterSpacing: -0.1,
            }}
          >
            Edit flow
          </button>
        )}

        {/* Reports — desktop only */}
        {!isMobile && selectedFlow && (
          <button
            onClick={() => navigate(`/reports?flowId=${selectedFlow.id}`)}
            style={{
              background: 'transparent', color: C.fg,
              border: `1px solid ${C.border}`, padding: '7px 12px', borderRadius: 6,
              fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              letterSpacing: -0.1,
            }}
          >
            Reports
          </button>
        )}

        {/* New demand — desktop only */}
        {!isMobile && (
          <button
            onClick={() => setShowNewDemand(true)}
            style={{
              background: C.fg, color: 'oklch(0.98 0 0)',
              border: 'none', padding: '8px 14px', borderRadius: 6,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            New demand
          </button>
        )}

        {/* Sign out */}
        <button
          onClick={logout}
          aria-label="Sign out"
          style={{
            background: 'none', border: `1px solid ${C.border}`,
            borderRadius: 6, padding: isMobile ? '5px 8px' : '5px 12px',
            fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
            color: C.muted, cursor: 'pointer',
            letterSpacing: 0.4, textTransform: 'uppercase', flexShrink: 0,
          }}
        >
          {isMobile ? <span aria-hidden="true">↩</span> : 'Sign out'}
        </button>
      </header>

      {/* ── Editorial mantra — desktop only ── */}
      {!isMobile && (
        <div style={{ padding: '24px 32px 16px', display: 'flex', alignItems: 'baseline', gap: 16, flexShrink: 0 }}>
          <div style={{
            fontFamily: 'Instrument Serif, serif',
            fontSize: 42, fontWeight: 400, letterSpacing: -1.4, lineHeight: 1,
            fontStyle: 'italic',
          }}>
            {demands.length}{' '}
            <span style={{ color: C.muted, fontStyle: 'normal' }}>demands in flight,</span>
          </div>
          <div style={{ fontSize: 13, color: C.muted, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.3 }}>
            {formatEditorialDate()}
          </div>
        </div>
      )}

      {/* ── AI blocker banner — desktop only ── */}
      {!isMobile && blockerDemand && (
        <AIBlockerBanner
          demand={blockerDemand.demand}
          daysOld={blockerDemand.daysOld}
          onView={() => setSelectedDemand(blockerDemand.demand)}
          onDismiss={() => setDismissedBannerIds(prev => new Set([...prev, blockerDemand.demand.id]))}
        />
      )}

      {/* ── Stage tabs — mobile only ── */}
      {isMobile && selectedFlow && selectedFlow.stages.length > 0 && (
        <div style={{ overflowX: 'auto', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6, padding: '8px 14px 10px', minWidth: 'max-content' }}>
            {selectedFlow.stages.map(stage => {
              const hue = stageHueFromColor(stage.color, stage.order)
              const count = filteredDemands.filter(d => d.currentStageId === stage.id).length
              const active = activeMobileStageId === stage.id
              return (
                <button
                  key={stage.id}
                  onClick={() => setActiveMobileStageId(stage.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: 12,
                    border: `1px solid ${active ? stageColor(hue, 'solid') : C.border}`,
                    background: active ? stageColor(hue, 'soft') : 'transparent',
                    color: active ? stageColor(hue, 'ink') : C.fg,
                    fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer',
                    whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: stageColor(hue, 'solid'), flexShrink: 0 }} />
                  {stage.name}
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: C.muted, fontWeight: 700 }}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      {selectedFlow && (
        <FilterBar
          members={members}
          availableTags={availableTags}
          filterAssignees={filterAssignees}
          onToggleAssignee={toggleAssignee}
          filterPriorities={filterPriorities}
          onTogglePriority={togglePriority}
          filterTags={filterTags}
          onToggleTag={toggleTag}
          filterDue={filterDue}
          onSetDue={setFilterDue}
          isFiltered={isFiltered}
          onClear={clearFilters}
          compact={isMobile}
        />
      )}

      {/* ── Board — mobile: card list / desktop: kanban ── */}
      {isMobile ? (
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '12px 14px 88px',
        }}>
          {activeStageDemands.map(demand => (
            <div
              key={demand.id}
              onClick={() => setSelectedDemand(demand)}
              style={{
                background: C.cardBg,
                border: `1px solid ${C.border}`,
                borderLeft: `3px solid ${stageColor(stageHueFromColor(demand.currentStage.color, demand.currentStage.order), 'solid')}`,
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{
                  fontSize: 9, fontFamily: 'JetBrains Mono, monospace',
                  color: C.muted, letterSpacing: 0.4, fontWeight: 700, textTransform: 'uppercase',
                }}>
                  {demand.tag ?? 'demand'} · #{demand.id.slice(0, 6).toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 10 }}>
                {demand.title}
              </div>
              {demand.assignedTo && (
                <div style={{ fontSize: 11, color: C.muted, fontFamily: 'JetBrains Mono, monospace' }}>
                  {demand.assignedTo.name}
                </div>
              )}
            </div>
          ))}
          {activeStageDemands.length === 0 && (
            <div style={{
              padding: '48px 16px', textAlign: 'center',
              color: C.muted, fontSize: 13, fontStyle: 'italic',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              nothing here yet
            </div>
          )}
        </div>
      ) : (
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
            const stageDemands = filteredDemands.filter(d => d.currentStageId === stage.id)
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
                      <span aria-hidden="true" style={{ color: stageColor(hue, 'solid'), fontSize: 14 }}>{glyph}</span>
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
                  {demandsLoading ? (
                    <>
                      <SkeletonCard />
                      <SkeletonCard />
                    </>
                  ) : (
                    <>
                      {stageDemands.map(demand => (
                        <DemandCard
                          key={demand.id}
                          demand={demand}
                          isDragging={draggingId === demand.id}
                          justArrived={lastMovedId === demand.id}
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
                          nothing here yet
                        </div>
                      )}
                    </>
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
              No flow found.
            </div>
          )}
        </div>
      )}

      {/* ── FAB — mobile only ── */}
      {isMobile && (
        <button
          onClick={() => setShowNewDemand(true)}
          style={{
            position: 'fixed', right: 16, bottom: 24,
            width: 52, height: 52, borderRadius: '50%',
            background: C.fg, color: '#fff',
            border: 'none', fontSize: 24, cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0,0,0,.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50,
          }}
        >
          +
        </button>
      )}

      {selectedDemand && selectedFlow && (
        <DemandModal
          demand={selectedDemand}
          flow={selectedFlow}
          onClose={() => setSelectedDemand(null)}
          onAdvance={handleAdvance}
          onArchive={handleArchive}
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

      {confettiActive && <ConfettiOverlay hue={confettiHue} />}

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
        <span style={{ fontSize: 10, color: C.muted, letterSpacing: 0.6 }}>FLOW</span>
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
              <span>New flow</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TeamAvatar({ name, index }: { name: string; index: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('')
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

// ─── Confetti overlay ────────────────────────────────────────────────────────

const CONFETTI_GLYPHS = ['✺', '◇', '◈', '●', '◐']

function ConfettiOverlay({ hue }: { hue: number }) {
  const solidColor = stageColor(hue, 'solid')
  const particles = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      glyph: CONFETTI_GLYPHS[i % CONFETTI_GLYPHS.length],
      left: `${4 + (i * 3.07) % 92}%`,
      delay: `${(i * 0.083) % 0.85}s`,
      duration: `${1.8 + (i * 0.043) % 0.9}s`,
      size: 11 + (i * 7) % 14,
    })),
  [])

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 300 }}>
      <style>{`@keyframes fdFall{0%{transform:translateY(-40px) rotate(0deg);opacity:1}80%{opacity:1}100%{transform:translateY(100vh) rotate(600deg);opacity:0}}`}</style>
      {particles.map(p => (
        <span key={p.id} style={{
          position: 'absolute', top: 0, left: p.left,
          fontFamily: 'Instrument Serif, serif', fontStyle: 'italic',
          fontSize: p.size, color: solidColor,
          animation: `fdFall ${p.duration} ${p.delay} cubic-bezier(.3,.7,.4,1) forwards`,
          userSelect: 'none',
        }}>
          {p.glyph}
        </span>
      ))}
    </div>
  )
}

// ─── AI blocker banner ────────────────────────────────────────────────────────

function AIBlockerBanner({ demand, daysOld, onView, onDismiss }: {
  demand: Demand
  daysOld: number
  onView: () => void
  onDismiss: () => void
}) {
  return (
    <div style={{ padding: '0 32px 12px', flexShrink: 0 }}>
      <div style={{
        background: 'oklch(0.97 0.03 280)',
        border: '1px solid oklch(0.85 0.04 280)',
        borderRadius: 8, padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        animation: 'ndIn .2s cubic-bezier(.2,.7,.3,1)',
      }}>
        <span aria-hidden="true" style={{ color: 'oklch(0.55 0.20 280)', fontSize: 14, flexShrink: 0 }}>✦</span>
        <span style={{
          fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: 0.5, fontWeight: 700, textTransform: 'uppercase',
          color: 'oklch(0.55 0.20 280)', flexShrink: 0,
        }}>
          FlowDesk AI
        </span>
        <span style={{ width: 1, height: 14, background: 'oklch(0.85 0.04 280)', flexShrink: 0 }} />
        <span style={{ fontSize: 13, lineHeight: 1.4, color: 'oklch(0.28 0.10 280)', flex: 1 }}>
          <strong>"{demand.title}"</strong> has been in{' '}
          <strong>{demand.currentStage.name}</strong> for{' '}
          <strong>{daysOld} day{daysOld !== 1 ? 's' : ''}</strong>
          {demand.assignedTo ? ` — is ${demand.assignedTo.name} overloaded?` : '.'}
        </span>
        <button onClick={onView} style={{
          background: 'oklch(0.55 0.20 280)', color: '#fff', border: 'none',
          padding: '5px 11px', borderRadius: 4, fontSize: 11, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>View demand</button>
        <button onClick={onDismiss} style={{
          background: 'transparent', border: 'none',
          color: 'oklch(0.45 0.08 280)', cursor: 'pointer',
          padding: '0 4px', fontSize: 20, lineHeight: 1,
        }}>×</button>
      </div>
    </div>
  )
}

// ─── Skeleton / loading states ────────────────────────────────────────────────

const SHIMMER_STYLE: React.CSSProperties = {
  background: 'linear-gradient(90deg, oklch(0.92 0 0) 25%, oklch(0.87 0 0) 50%, oklch(0.92 0 0) 75%)',
  backgroundSize: '400% 100%',
  animation: 'fdShimmer 1.4s ease-in-out infinite',
  borderRadius: 4,
}

function Skel({ w, h, style }: { w: string | number; h: number; style?: React.CSSProperties }) {
  return <div style={{ width: w, height: h, ...SHIMMER_STYLE, ...style }} />
}

function SkeletonCard() {
  return (
    <div style={{
      background: 'oklch(1 0 0)', border: '1px solid oklch(0.90 0.005 60)',
      borderLeft: '3px solid oklch(0.90 0.005 60)',
      borderRadius: 6, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <style>{`@keyframes fdShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Skel w={8} h={8} style={{ borderRadius: '50%' }} />
        <Skel w={44} h={16} />
        <div style={{ flex: 1 }} />
        <Skel w={36} h={12} />
      </div>
      <Skel w="100%" h={13} />
      <Skel w="72%" h={13} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <Skel w={20} h={20} style={{ borderRadius: '50%' }} />
        <Skel w={60} h={10} />
      </div>
    </div>
  )
}

function SkeletonColumn() {
  return (
    <div style={{
      background: 'oklch(0.97 0.005 80)', borderRadius: 8, padding: 12,
      display: 'flex', flexDirection: 'column', gap: 10,
      border: '1px solid oklch(0.90 0.005 60)', minHeight: 200,
    }}>
      <div style={{ padding: '4px 4px 8px', borderBottom: '1px dashed oklch(0.90 0.005 60)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Skel w={14} h={14} style={{ borderRadius: '50%' }} />
            <Skel w={80} h={13} />
          </div>
          <Skel w={20} h={22} />
        </div>
        <Skel w="100%" h={2} />
      </div>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
}

function BoardSkeleton() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg }}>
      {/* header ghost */}
      <div style={{ padding: '20px 32px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 28, fontWeight: 400, fontStyle: 'italic', letterSpacing: -0.8 }}>
          FlowDesk<span style={{ color: 'oklch(0.62 0.20 28)' }}>.</span>
        </div>
        <Skel w={140} h={20} />
        <div style={{ flex: 1 }} />
        <Skel w={60} h={28} />
        <Skel w={60} h={28} />
        <Skel w={90} h={32} />
      </div>
      {/* mantra ghost */}
      <div style={{ padding: '24px 32px 16px', flexShrink: 0 }}>
        <Skel w={280} h={42} />
      </div>
      {/* columns */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(220px, 1fr))',
        gap: 12, padding: '12px 32px 32px', overflowX: 'auto',
      }}>
        {[0,1,2,3,4].map(i => <SkeletonColumn key={i} />)}
      </div>
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

interface FilterBarProps {
  members: User[]
  availableTags: string[]
  filterAssignees: Set<string>
  onToggleAssignee: (id: string) => void
  filterPriorities: Set<string>
  onTogglePriority: (p: string) => void
  filterTags: Set<string>
  onToggleTag: (t: string) => void
  filterDue: 'overdue' | 'today' | 'week' | null
  onSetDue: (v: 'overdue' | 'today' | 'week' | null) => void
  isFiltered: boolean
  onClear: () => void
  compact: boolean
}

function FilterBar({
  members, availableTags,
  filterAssignees, onToggleAssignee,
  filterPriorities, onTogglePriority,
  filterTags, onToggleTag,
  filterDue, onSetDue,
  isFiltered, onClear,
  compact,
}: FilterBarProps) {
  const [dueOpen, setDueOpen] = useState(false)
  const dueRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dueOpen) return
    const handler = (e: MouseEvent) => {
      if (dueRef.current && !dueRef.current.contains(e.target as Node)) setDueOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dueOpen])

  const hPad = compact ? '0 14px' : '0 32px'
  const dueLabel = filterDue === 'overdue' ? 'Overdue' : filterDue === 'today' ? 'Due today' : filterDue === 'week' ? 'This week' : 'Due date'

  return (
    <div style={{ padding: hPad, borderBottom: `1px solid ${C.border}`, flexShrink: 0, overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 0', minWidth: 'max-content' }}>

        {/* Assignees */}
        {members.length > 0 && (
          <>
            {members.map(m => (
              <AssigneeChip
                key={m.id}
                member={m}
                active={filterAssignees.has(m.id)}
                onToggle={() => onToggleAssignee(m.id)}
              />
            ))}
            <FilterDivider />
          </>
        )}

        {/* Priority */}
        {(['high', 'medium', 'low'] as const).map(p => (
          <PriorityChip
            key={p}
            priority={p}
            active={filterPriorities.has(p)}
            onToggle={() => onTogglePriority(p)}
          />
        ))}

        {/* Tags */}
        {availableTags.length > 0 && (
          <>
            <FilterDivider />
            {availableTags.map(t => (
              <TagChip
                key={t}
                tag={t}
                active={filterTags.has(t)}
                onToggle={() => onToggleTag(t)}
              />
            ))}
          </>
        )}

        {/* Due date */}
        <FilterDivider />
        <div ref={dueRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDueOpen(o => !o)}
            aria-expanded={dueOpen}
            aria-haspopup="listbox"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 999, fontSize: 11,
              border: `1px solid ${filterDue ? C.fg : C.border}`,
              background: filterDue ? C.fg : 'transparent',
              color: filterDue ? 'oklch(0.98 0 0)' : C.muted,
              fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
              fontWeight: filterDue ? 700 : 500, letterSpacing: 0.3,
              transition: 'all .12s',
            }}
          >
            {dueLabel}
            <span aria-hidden="true" style={{ fontSize: 8 }}>▾</span>
          </button>

          {dueOpen && (
            <div
              role="listbox"
              aria-label="Filter by due date"
              style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0,
                background: 'oklch(1 0 0)', border: `1px solid ${C.border}`,
                borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.1)',
                overflow: 'hidden', zIndex: 60, minWidth: 130,
              }}
            >
              {([
                ['overdue', 'Overdue'],
                ['today',   'Due today'],
                ['week',    'This week'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  role="option"
                  aria-selected={filterDue === val}
                  onClick={() => { onSetDue(filterDue === val ? null : val); setDueOpen(false) }}
                  style={{
                    width: '100%', padding: '8px 12px', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                    background: filterDue === val ? 'oklch(0.95 0.005 60)' : 'transparent',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: C.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                  onMouseEnter={e => { if (filterDue !== val) e.currentTarget.style.background = 'oklch(0.97 0.003 80)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = filterDue === val ? 'oklch(0.95 0.005 60)' : 'transparent' }}
                >
                  <span>{label}</span>
                  {filterDue === val && <span style={{ color: 'oklch(0.62 0.20 28)', fontSize: 10 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clear filters */}
        {isFiltered && (
          <button
            onClick={onClear}
            style={{
              marginLeft: 6, display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 999, fontSize: 11,
              border: '1px solid oklch(0.85 0.04 28)',
              background: 'oklch(0.97 0.03 28)',
              color: 'oklch(0.55 0.18 28)',
              fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
              fontWeight: 600, letterSpacing: 0.3,
            }}
          >
            <span aria-hidden="true">×</span> Clear filters
          </button>
        )}
      </div>
    </div>
  )
}

function AssigneeChip({ member, active, onToggle }: { member: User; active: boolean; onToggle: () => void }) {
  const initials = member.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  let h = 0
  for (let i = 0; i < member.name.length; i++) h = member.name.charCodeAt(i) + ((h << 5) - h)
  const hue = Math.abs(h) % 360
  return (
    <button
      onClick={onToggle}
      title={member.name}
      aria-pressed={active}
      aria-label={`Filter by ${member.name}`}
      style={{
        width: 26, height: 26, borderRadius: '50%', border: 'none',
        background: active
          ? `linear-gradient(135deg, oklch(0.72 0.14 ${hue}), oklch(0.55 0.18 ${(hue + 40) % 360}))`
          : 'oklch(0.90 0.005 60)',
        color: active ? '#fff' : C.muted,
        outline: active ? `2px solid oklch(0.62 0.20 28)` : '2px solid transparent',
        outlineOffset: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
        cursor: 'pointer', letterSpacing: 0.3,
        transition: 'all .12s',
      }}
    >
      {initials}
    </button>
  )
}

function PriorityChip({ priority, active, onToggle }: { priority: 'high' | 'medium' | 'low'; active: boolean; onToggle: () => void }) {
  const dotColor   = priority === 'high' ? 'oklch(0.55 0.22 15)'  : priority === 'medium' ? 'oklch(0.72 0.17 45)'  : 'oklch(0.72 0.04 240)'
  const activeBg   = priority === 'high' ? 'oklch(0.95 0.06 15)'  : priority === 'medium' ? 'oklch(0.97 0.06 45)'  : 'oklch(0.95 0.04 240)'
  const activeBdr  = priority === 'high' ? 'oklch(0.65 0.12 15)'  : priority === 'medium' ? 'oklch(0.72 0.12 45)'  : 'oklch(0.65 0.08 240)'
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', borderRadius: 999, fontSize: 11,
        border: `1px solid ${active ? activeBdr : C.border}`,
        background: active ? activeBg : 'transparent',
        color: active ? C.fg : C.muted,
        fontFamily: 'inherit', cursor: 'pointer',
        fontWeight: active ? 700 : 500, textTransform: 'capitalize',
        transition: 'all .12s',
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0, display: 'inline-block' }} />
      {priority}
    </button>
  )
}

function TagChip({ tag, active, onToggle }: { tag: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      style={{
        padding: '4px 10px', borderRadius: 999, fontSize: 11,
        border: `1px solid ${active ? C.fg : C.border}`,
        background: active ? C.fg : 'transparent',
        color: active ? 'oklch(0.98 0 0)' : C.muted,
        fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer',
        fontWeight: active ? 700 : 500, letterSpacing: 0.3,
        transition: 'all .12s',
      }}
    >
      {tag}
    </button>
  )
}

function FilterDivider() {
  return <span style={{ width: 1, height: 14, background: C.border, flexShrink: 0, margin: '0 6px' }} />
}

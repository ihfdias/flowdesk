import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { Flow, Stage } from '../lib/types'
import { COLOR_OPTIONS, stageHueFromColor, stageColor } from '../lib/colors'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const STAGE_GLYPHS = ['◐', '✺', '◇', '◈', '●', '◉', '◎']

const FG = 'oklch(0.18 0.01 60)'
const MUTED = 'oklch(0.50 0.01 60)'
const BORDER = 'oklch(0.90 0.005 60)'
const BG = 'oklch(0.985 0.005 80)'

export default function FlowEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [flow, setFlow] = useState<Flow | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [flowName, setFlowName] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmDeleteFlow, setConfirmDeleteFlow] = useState(false)
  const [deletingFlow, setDeletingFlow] = useState(false)
  const [deleteFlowError, setDeleteFlowError] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!id) return
    api.get(`/api/flows/${id}`)
      .then(res => {
        setFlow(res.data)
        setFlowName(res.data.name)
        setStages(res.data.stages)
      })
      .finally(() => setLoading(false))
  }, [id])

  const markSaved = useCallback(() => {
    setSaveStatus('saved')
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2000)
  }, [])

  const saveFlowName = useCallback(async () => {
    if (!flow) return
    const name = flowName.trim()
    if (!name || name === flow.name) { setFlowName(flow.name); return }
    setSaveStatus('saving')
    try {
      await api.put(`/api/flows/${flow.id}`, { name })
      setFlow(prev => prev ? { ...prev, name } : prev)
      markSaved()
    } catch {
      setSaveStatus('error')
    }
  }, [flow, flowName, markSaved])

  const startEdit = useCallback((stage: Stage) => {
    setEditingId(stage.id)
    setEditingName(stage.name)
    setConfirmDelete(null)
  }, [])

  const saveStage = useCallback(async (stageId: string) => {
    const name = editingName.trim()
    const stage = stages.find(s => s.id === stageId)
    setEditingId(null)
    if (!flow || !stage || !name || name === stage.name) return
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, name } : s))
    setSaveStatus('saving')
    try {
      await api.put(`/api/flows/${flow.id}/stages/${stageId}`, { name })
      markSaved()
    } catch {
      setStages(prev => prev.map(s => s.id === stageId ? { ...s, name: stage.name } : s))
      setSaveStatus('error')
    }
  }, [editingName, stages, flow, markSaved])

  const changeColor = useCallback(async (stageId: string, color: string) => {
    if (!flow) return
    const stage = stages.find(s => s.id === stageId)
    if (!stage) return
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, color } : s))
    setSaveStatus('saving')
    try {
      await api.put(`/api/flows/${flow.id}/stages/${stageId}`, { color })
      markSaved()
    } catch {
      setStages(prev => prev.map(s => s.id === stageId ? { ...s, color: stage.color } : s))
      setSaveStatus('error')
    }
  }, [flow, stages, markSaved])

  const addStage = useCallback(async () => {
    if (!flow) return
    const newOrder = stages.length
    setSaveStatus('saving')
    try {
      const res = await api.post(`/api/flows/${flow.id}/stages`, {
        name: 'New stage',
        color: 'orange',
        order: newOrder,
      })
      const newStage: Stage = res.data
      setStages(prev => [...prev, newStage])
      setEditingId(newStage.id)
      setEditingName('New stage')
      markSaved()
    } catch {
      setSaveStatus('error')
    }
  }, [flow, stages.length, markSaved])

  const handleDelete = useCallback(async (stageId: string) => {
    if (!flow) return
    if (confirmDelete !== stageId) {
      setConfirmDelete(stageId)
      setDeleteError(null)
      return
    }
    setConfirmDelete(null)
    setSaveStatus('saving')
    try {
      await api.delete(`/api/flows/${flow.id}/stages/${stageId}`)
      setStages(prev => prev.filter(s => s.id !== stageId))
      markSaved()
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) setDeleteError(stageId)
      setSaveStatus('error')
    }
  }, [flow, confirmDelete, markSaved])

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    e.dataTransfer.effectAllowed = 'move'
    setDragIdx(idx)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setOverIdx(idx)
  }, [])

  const handleDrop = useCallback(async () => {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) {
      setDragIdx(null); setOverIdx(null)
      return
    }
    const reordered = [...stages]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(overIdx, 0, moved)
    const updated = reordered.map((s, i) => ({ ...s, order: i }))
    setStages(updated)
    setDragIdx(null); setOverIdx(null)
    setSaveStatus('saving')
    try {
      await Promise.all(
        updated.map(s => api.put(`/api/flows/${flow!.id}/stages/${s.id}`, { order: s.order }))
      )
      markSaved()
    } catch {
      setSaveStatus('error')
    }
  }, [dragIdx, overIdx, stages, flow, markSaved])

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: MUTED }}>loading...</span>
    </div>
  )

  if (!flow) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: MUTED }}>Fluxo não encontrado.</span>
    </div>
  )

  return (
    <div
      style={{ minHeight: '100vh', background: BG, color: FG, fontFamily: 'Inter, system-ui, sans-serif' }}
      onClick={() => { if (confirmDelete) setConfirmDelete(null) }}
    >
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'oklch(1 0 0)', borderBottom: `1px solid ${BORDER}`,
        padding: '16px 32px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          fontFamily: 'Instrument Serif, serif',
          fontSize: 24, fontWeight: 400, fontStyle: 'italic',
          letterSpacing: -0.8, lineHeight: 1,
        }}>
          FlowDesk<span style={{ color: 'oklch(0.62 0.20 28)' }}>.</span>
        </div>

        <button
          onClick={e => { e.stopPropagation(); navigate('/board') }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: MUTED, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', borderRadius: 4,
            transition: 'color .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = FG)}
          onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
        >
          ← Back to board
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.4, minWidth: 90, textAlign: 'right' }}>
          {saveStatus === 'saving' && <span style={{ color: MUTED }}>saving…</span>}
          {saveStatus === 'saved' && <span style={{ color: 'oklch(0.48 0.14 145)' }}>✓ saved</span>}
          {saveStatus === 'error' && <span style={{ color: 'oklch(0.55 0.18 28)' }}>! error</span>}
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Flow name */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
            color: MUTED, letterSpacing: 0.5, textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            Flow name
          </div>
          <input
            value={flowName}
            onChange={e => setFlowName(e.target.value)}
            onFocus={e => { e.target.style.borderBottomColor = BORDER }}
            onBlur={e => { e.target.style.borderBottomColor = 'transparent'; saveFlowName() }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            style={{
              width: '100%', boxSizing: 'border-box',
              fontFamily: 'Instrument Serif, serif',
              fontSize: 36, fontWeight: 400, fontStyle: 'italic',
              letterSpacing: -1, lineHeight: 1.1,
              border: 'none', borderBottom: '2px solid transparent',
              outline: 'none', background: 'transparent', color: FG,
              padding: '4px 0',
              transition: 'border-color .15s',
            }}
          />
        </div>

        {/* Stages label */}
        <div style={{
          fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
          color: MUTED, letterSpacing: 0.5, textTransform: 'uppercase',
          marginBottom: 12,
        }}>
          Stages — {stages.length}
        </div>

        {/* Stage rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {stages.map((stage, idx) => {
            const hue = stageHueFromColor(stage.color, stage.order)
            const isEditing = editingId === stage.id
            const isConfirmingDelete = confirmDelete === stage.id
            const isOver = overIdx === idx && dragIdx !== idx
            const isDragging = dragIdx === idx
            const glyph = STAGE_GLYPHS[idx % STAGE_GLYPHS.length]
            const nextHue = idx < stages.length - 1 ? stageHueFromColor(stages[idx + 1].color, stages[idx + 1].order) : null

            return (
              <Fragment key={stage.id}>
                <div
                  draggable={!isEditing}
                  onDragStart={e => handleDragStart(e, idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={e => { e.stopPropagation(); handleDrop() }}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    background: isOver ? stageColor(hue, 'softer') : 'oklch(1 0 0)',
                    border: `1px solid ${isOver ? stageColor(hue, 'ring') : BORDER}`,
                    borderLeft: `4px solid ${stageColor(hue, 'solid')}`,
                    borderRadius: 6,
                    opacity: isDragging ? 0.35 : 1,
                    cursor: isEditing ? 'default' : 'grab',
                    transition: 'background .12s, border-color .12s, opacity .12s',
                  }}
                >
                  {/* Drag handle */}
                  <span style={{ color: MUTED, fontSize: 14, lineHeight: 1, flexShrink: 0, userSelect: 'none' }}>
                    ⠿
                  </span>

                  {/* Number */}
                  <div style={{
                    fontFamily: 'Instrument Serif, Georgia, serif',
                    fontSize: 32, fontWeight: 400, fontStyle: 'italic',
                    color: stageColor(hue, 'solid'), lineHeight: 1,
                    minWidth: 32, flexShrink: 0,
                  }}>
                    {String(idx + 1).padStart(2, '0')}
                  </div>

                  {/* Glyph circle */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: stageColor(hue, 'soft'),
                    color: stageColor(hue, 'solid'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>{glyph}</div>

                  {/* Name + subtitle */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={() => saveStage(stage.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{
                          width: '100%', border: 'none', outline: 'none',
                          fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                          color: FG, background: 'transparent',
                          letterSpacing: -0.1, padding: 0,
                        }}
                      />
                    ) : (
                      <span
                        onClick={e => { e.stopPropagation(); startEdit(stage) }}
                        title="Clique para renomear"
                        style={{
                          fontSize: 14, fontWeight: 600, letterSpacing: -0.1,
                          cursor: 'text', display: 'block',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {stage.name}
                      </span>
                    )}
                    <div style={{
                      fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
                      color: MUTED, letterSpacing: 0.4, marginTop: 2,
                    }}>
                      stage · #{String(idx + 1).padStart(2, '0')}
                    </div>
                  </div>

                  {/* Color swatches */}
                  <div
                    style={{ display: 'flex', gap: 4, flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}
                  >
                    {COLOR_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => changeColor(stage.id, opt.value)}
                        title={opt.value}
                        style={{
                          width: 14, height: 14, borderRadius: '50%',
                          background: stageColor(opt.hue, 'solid'),
                          border: stage.color === opt.value
                            ? `2px solid ${stageColor(opt.hue, 'deep')}`
                            : '2px solid transparent',
                          boxShadow: stage.color === opt.value
                            ? `0 0 0 1px ${stageColor(opt.hue, 'deep')}`
                            : 'none',
                          cursor: 'pointer', padding: 0, flexShrink: 0,
                          transition: 'transform .1s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.25)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
                      />
                    ))}
                  </div>

                  {/* Delete */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}
                  >
                    {deleteError === stage.id && (
                      <span style={{
                        fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
                        color: 'oklch(0.55 0.18 28)',
                      }}>
                        has demands
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(stage.id)}
                      style={{
                        background: isConfirmingDelete ? 'oklch(0.95 0.06 28)' : 'transparent',
                        border: isConfirmingDelete
                          ? '1px solid oklch(0.78 0.10 28)'
                          : '1px solid transparent',
                        color: isConfirmingDelete ? 'oklch(0.45 0.16 28)' : MUTED,
                        borderRadius: 4,
                        padding: isConfirmingDelete ? '3px 8px' : '2px 6px',
                        fontSize: isConfirmingDelete ? 11 : 18,
                        fontFamily: isConfirmingDelete ? 'JetBrains Mono, monospace' : 'inherit',
                        cursor: 'pointer', lineHeight: 1,
                        transition: 'all .15s',
                      }}
                      onMouseEnter={e => {
                        if (!isConfirmingDelete) {
                          e.currentTarget.style.borderColor = BORDER
                          e.currentTarget.style.color = 'oklch(0.45 0.16 28)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isConfirmingDelete) {
                          e.currentTarget.style.borderColor = 'transparent'
                          e.currentTarget.style.color = MUTED
                        }
                      }}
                    >
                      {isConfirmingDelete ? 'confirm?' : '×'}
                    </button>
                  </div>
                </div>

                {/* Connector between stages */}
                {nextHue !== null && (
                  <div style={{
                    marginLeft: 80, height: 14, width: 2,
                    background: `linear-gradient(180deg, ${stageColor(hue, 'solid')}, ${stageColor(nextHue, 'solid')})`,
                    opacity: 0.4, borderRadius: 1,
                  }} />
                )}
              </Fragment>
            )
          })}
        </div>

        {/* Add stage */}
        <button
          onClick={e => { e.stopPropagation(); addStage() }}
          style={{
            marginTop: 12,
            width: '100%', padding: '12px',
            background: 'transparent',
            border: `1px dashed ${BORDER}`,
            borderRadius: 6, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 13, color: MUTED, fontFamily: 'inherit',
            transition: 'border-color .15s, color .15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = FG
            e.currentTarget.style.color = FG
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = BORDER
            e.currentTarget.style.color = MUTED
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          Add stage
        </button>

        {/* Danger zone */}
        <div style={{
          marginTop: 48,
          borderTop: `1px solid oklch(0.88 0.04 15)`,
          paddingTop: 24,
        }}>
          <div style={{
            fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
            color: 'oklch(0.55 0.22 15)', letterSpacing: 0.5,
            textTransform: 'uppercase', marginBottom: 12,
          }}>
            Danger zone
          </div>

          {!confirmDeleteFlow ? (
            <button
              onClick={() => setConfirmDeleteFlow(true)}
              style={{
                padding: '8px 16px',
                background: 'none',
                border: `1px solid oklch(0.80 0.08 15)`,
                borderRadius: 6, cursor: 'pointer',
                fontSize: 13, color: 'oklch(0.55 0.22 15)',
                fontFamily: 'inherit',
                transition: 'border-color .15s, background .15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'oklch(0.97 0.01 15)'
                e.currentTarget.style.borderColor = 'oklch(0.55 0.22 15)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'none'
                e.currentTarget.style.borderColor = 'oklch(0.80 0.08 15)'
              }}
            >
              Delete flow
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: FG, margin: 0 }}>
                Are you sure? <strong>All demands will be lost</strong> and this action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={async () => {
                    setDeletingFlow(true)
                    try {
                      await api.delete(`/api/flows/${id}`)
                      navigate('/board')
                    } catch (err: unknown) {
                      setDeletingFlow(false)
                      setConfirmDeleteFlow(false)
                      const status = (err as { response?: { status?: number } })?.response?.status
                      const msg = status === 403
                        ? 'Not authorized to delete this flow. Only the creator can do that.'
                        : 'Error deleting flow. Try again.'
                      setDeleteFlowError(msg)
                      setTimeout(() => setDeleteFlowError(null), 4000)
                    }
                  }}
                  disabled={deletingFlow}
                  style={{
                    padding: '8px 16px',
                    background: 'oklch(0.55 0.22 15)',
                    border: 'none', borderRadius: 6, cursor: deletingFlow ? 'not-allowed' : 'pointer',
                    fontSize: 13, color: '#fff', fontFamily: 'inherit',
                    opacity: deletingFlow ? 0.6 : 1,
                  }}
                >
                  {deletingFlow ? 'Deleting…' : 'Confirm deletion'}
                </button>
                <button
                  onClick={() => { setConfirmDeleteFlow(false); setDeleteFlowError(null) }}
                  disabled={deletingFlow}
                  style={{
                    padding: '8px 16px',
                    background: 'none',
                    border: `1px solid ${BORDER}`,
                    borderRadius: 6, cursor: 'pointer',
                    fontSize: 13, color: MUTED, fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {deleteFlowError && (
            <p style={{
              marginTop: 10, fontSize: 12,
              color: 'oklch(0.45 0.20 15)',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {deleteFlowError}
            </p>
          )}
        </div>

      </main>
    </div>
  )
}

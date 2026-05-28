import { useRef, useEffect } from 'react'
import { Demand } from '../../lib/types'
import { stageHueFromColor, stageColor } from '../../lib/colors'
import Avatar from '../primitives/Avatar'
import PriorityDot from '../primitives/PriorityDot'
import DueDate from '../primitives/DueDate'
import TagPill from '../primitives/TagPill'

interface Props {
  demand: Demand
  isDragging: boolean
  justArrived?: boolean
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onClick: () => void
}

const C = {
  cardBg: 'oklch(1 0 0)',
  border: 'oklch(0.90 0.005 60)',
  muted: 'oklch(0.50 0.01 60)',
}

export default function DemandCard({ demand, isDragging, justArrived = false, onDragStart, onDragEnd, onClick }: Props) {
  const hue = stageHueFromColor(demand.currentStage.color, demand.currentStage.order)
  const solidColor = stageColor(hue, 'solid')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!justArrived || !ref.current) return
    ref.current.animate(
      [
        { offset: 0.05, boxShadow: `0 0 0 6px ${solidColor}55, 0 10px 28px ${solidColor}66`, transform: 'translateY(-3px) scale(1.02)' },
        { offset: 1,    boxShadow: `0 0 0 14px ${solidColor}00, 0 0 0 0 ${solidColor}00`,   transform: 'translateY(0) scale(1)' },
      ],
      { duration: 750, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'none' }
    )
  }, [justArrived, solidColor])

  return (
    <div
      ref={ref}
      draggable
      onDragStart={(e) => onDragStart(e, demand.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.06)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
      style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${solidColor}`,
        borderRadius: 6,
        padding: '10px 12px',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        transition: 'transform .12s, box-shadow .12s, opacity .12s',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PriorityDot priority={demand.priority as 'high' | 'medium' | 'low' | undefined} />
        {demand.tag && <TagPill tag={demand.tag} />}
        <div style={{ flex: 1 }} />
        <DueDate date={demand.dueDate} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, letterSpacing: -0.1 }}>
        {demand.title}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <Avatar name={demand.assignedTo?.name} size={20} />
        <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: C.muted, letterSpacing: 0.3 }}>
          #{demand.id.slice(0, 8).toUpperCase()}
        </span>
      </div>
    </div>
  )
}

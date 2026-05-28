import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { stageHueFromColor, stageColor } from '../lib/colors'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  totalActive: number
  totalArchived: number
  demandsByStage:    { stageId: string; stageName: string; color: string; order: number; count: number }[]
  demandsByPriority: { priority: string; count: number }[]
  demandsByTag:      { tag: string; count: number }[]
  assigneeWorkload:  { name: string; count: number }[]
  avgDaysPerStage:   { stageId: string; stageName: string; color: string; order: number; avgDays: number | null }[]
  createdByWeek:     { week: string; count: number }[]
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const C = {
  bg:     'oklch(0.985 0.005 80)',
  fg:     'oklch(0.18 0.01 60)',
  muted:  'oklch(0.50 0.01 60)',
  border: 'oklch(0.90 0.005 60)',
  surface:'oklch(0.97 0.005 80)',
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   'oklch(0.55 0.22 15)',
  medium: 'oklch(0.72 0.17 45)',
  low:    'oklch(0.72 0.04 240)',
  none:   'oklch(0.70 0.01 60)',
}

// ─── Week label helpers ────────────────────────────────────────────────────────

function weekToDisplay(weekLabel: string): string {
  const [year, w] = weekLabel.split('-W').map(Number)
  const jan4 = new Date(year, 0, 4)
  const dow = jan4.getDay() || 7
  const mon = new Date(jan4)
  mon.setDate(jan4.getDate() - dow + 1 + (w - 1) * 7)
  return mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Chart components ─────────────────────────────────────────────────────────

function HBar({ label, count, max, color, suffix = '' }: { label: string; count: number; max: number; color: string; suffix?: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{
        width: 90, fontSize: 12, color: C.muted, textAlign: 'right',
        fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
      }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color, borderRadius: 4,
          transition: 'width .6s cubic-bezier(.2,.7,.3,1)',
        }} />
      </div>
      <span style={{
        width: 36, fontSize: 12, fontWeight: 700, color: C.fg,
        fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', flexShrink: 0,
      }}>{count}{suffix}</span>
    </div>
  )
}

function DonutChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return <EmptySlate />

  let acc = 0
  const gradient = data.map(d => {
    const pct = (d.count / total) * 100
    const from = acc; acc += pct
    return `${d.color} ${from.toFixed(1)}% ${acc.toFixed(1)}%`
  }).join(', ')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{
        width: 96, height: 96, borderRadius: '50%', flexShrink: 0,
        background: `conic-gradient(${gradient})`,
        WebkitMask: 'radial-gradient(transparent 42%, white 42%)',
        mask: 'radial-gradient(transparent 42%, white 42%)',
      }} aria-hidden="true" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map(d => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: C.muted, textTransform: 'capitalize' }}>
              {d.label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.fg, fontFamily: 'JetBrains Mono, monospace', marginLeft: 4 }}>
              {d.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Sparkline({ data }: { data: { week: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 320, H = 60, PAD = 6

  const points = data.map((d, i) => {
    const x = data.length > 1 ? PAD + (i / (data.length - 1)) * (W - PAD * 2) : W / 2
    const y = H - PAD - (d.count / max) * (H - PAD * 2)
    return { x, y, ...d }
  })

  const polyPts = points.map(p => `${p.x},${p.y}`).join(' ')
  const areaPts = `${polyPts} ${points[points.length - 1].x},${H} ${points[0].x},${H}`
  const accent = 'oklch(0.62 0.20 28)'

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id="rp-spark-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPts} fill="url(#rp-spark-grad)" />
        <polyline points={polyPts} fill="none" stroke={accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={accent} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {data.map((d, i) => (
          (i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) ? (
            <span key={d.week} style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: C.muted, letterSpacing: 0.2 }}>
              {weekToDisplay(d.week)}
            </span>
          ) : <span key={d.week} />
        ))}
      </div>
    </div>
  )
}

function EmptySlate() {
  return (
    <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', fontFamily: 'JetBrains Mono, monospace', padding: '8px 0' }}>
      no data yet
    </div>
  )
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
        color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase',
        marginBottom: 14,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'oklch(1 0 0)',
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '18px 20px',
    }}>
      <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: C.muted, letterSpacing: 0.4, marginBottom: 14 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const flowId = searchParams.get('flowId')

  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flowName, setFlowName] = useState('')

  useEffect(() => {
    if (!flowId) { setLoading(false); return }
    Promise.all([
      api.get(`/api/flows/${flowId}/analytics`),
      api.get(`/api/flows/${flowId}`),
    ]).then(([analyticsRes, flowRes]) => {
      setData(analyticsRes.data)
      setFlowName(flowRes.data.name ?? '')
    }).catch(() => {
      setError('Could not load analytics. Try again.')
    }).finally(() => setLoading(false))
  }, [flowId])

  if (!flowId) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, fontFamily: 'JetBrains Mono, monospace', color: C.muted, fontSize: 13 }}>
        No flow selected. <button onClick={() => navigate('/board')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: C.fg, textDecoration: 'underline', fontSize: 13 }}>Back to board</button>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, fontFamily: 'JetBrains Mono, monospace', color: C.muted, fontSize: 13 }}>
        loading…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: C.bg }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: C.muted, fontSize: 13 }}>{error ?? 'Something went wrong.'}</span>
        <button onClick={() => navigate('/board')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.fg, textDecoration: 'underline', fontSize: 13, fontFamily: 'inherit' }}>Back to board</button>
      </div>
    )
  }

  return <ReportsDashboard data={data} flowName={flowName} onBack={() => navigate(`/board?flowId=${flowId}`)} />
}

// ─── Dashboard content (separated for cleaner loading logic) ─────────────────

function ReportsDashboard({ data, flowName, onBack }: { data: AnalyticsData; flowName: string; onBack: () => void }) {
  const maxStage  = Math.max(...data.demandsByStage.map(d => d.count), 1)
  const maxAssign = Math.max(...data.assigneeWorkload.map(d => d.count), 1)
  const maxTag    = Math.max(...data.demandsByTag.map(d => d.count), 1)
  const maxAvg    = Math.max(...data.avgDaysPerStage.map(d => d.avgDays ?? 0), 1)

  const priorityDonut = useMemo(() =>
    data.demandsByPriority.map(d => ({
      label: d.priority,
      count: d.count,
      color: PRIORITY_COLORS[d.priority] ?? PRIORITY_COLORS.none,
    }))
  , [data.demandsByPriority])

  const hasSparkData = data.createdByWeek.some(w => w.count > 0)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.fg, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header ── */}
      <header style={{
        padding: '20px 40px 18px',
        background: 'oklch(1 0 0)',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <button
          onClick={onBack}
          aria-label="Back to board"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: C.muted, fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: 0.3, display: 'flex', alignItems: 'center', gap: 5,
            padding: 0, flexShrink: 0,
          }}
        >
          ← Board
        </button>
        <div style={{ width: 1, height: 16, background: C.border }} />
        <div>
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {flowName}
          </span>
          <h1 style={{
            margin: 0,
            fontFamily: 'Instrument Serif, serif',
            fontSize: 26, fontWeight: 400, fontStyle: 'italic',
            letterSpacing: -0.6, lineHeight: 1.1,
          }}>
            Reports
          </h1>
        </div>
      </header>

      {/* ── Body ── */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 40px 64px' }}>

        {/* Summary row */}
        <Section title="Overview">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 4 }}>
            {[
              { label: 'Active demands', value: data.totalActive, color: C.fg },
              { label: 'Completed', value: data.totalArchived, color: 'oklch(0.45 0.15 155)' },
              { label: 'Total all time', value: data.totalActive + data.totalArchived, color: C.muted },
            ].map(s => (
              <div key={s.label} style={{ background: 'oklch(1 0 0)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 44, fontStyle: 'italic', fontWeight: 400, lineHeight: 1, color: s.color, letterSpacing: -1 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* 2×2 snapshot grid */}
        <Section title="Snapshot">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            {/* By stage */}
            <Card title="Demands by stage">
              {data.demandsByStage.length === 0 ? <EmptySlate /> : data.demandsByStage.map(s => {
                const hue = stageHueFromColor(s.color, s.order)
                return <HBar key={s.stageId} label={s.stageName} count={s.count} max={maxStage} color={stageColor(hue, 'solid')} />
              })}
            </Card>

            {/* Assignee workload */}
            <Card title="Open demands per person">
              {data.assigneeWorkload.length === 0
                ? <EmptySlate />
                : data.assigneeWorkload.map(a => (
                    <HBar key={a.name} label={a.name} count={a.count} max={maxAssign} color="oklch(0.62 0.20 28)" />
                  ))}
            </Card>

            {/* By priority */}
            <Card title="By priority">
              {data.demandsByPriority.length === 0
                ? <EmptySlate />
                : <DonutChart data={priorityDonut} />}
            </Card>

            {/* By tag */}
            <Card title="By content type">
              {data.demandsByTag.length === 0
                ? <EmptySlate />
                : data.demandsByTag.map(t => (
                    <HBar key={t.tag} label={t.tag} count={t.count} max={maxTag} color="oklch(0.55 0.12 280)" />
                  ))}
            </Card>
          </div>
        </Section>

        {/* Avg days per stage */}
        <Section title="Average days per stage">
          <div style={{ background: 'oklch(1 0 0)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.3, marginBottom: 6 }}>
              Based on completed stage visits — how long demands spent in each phase before being moved.
            </div>
            {data.avgDaysPerStage.every(s => s.avgDays === null) ? (
              <div style={{ paddingTop: 8 }}><EmptySlate /></div>
            ) : (
              <div style={{ marginTop: 14 }}>
                {data.avgDaysPerStage.map(s => {
                  const hue = stageHueFromColor(s.color, s.order)
                  const days = s.avgDays ?? 0
                  return (
                    <HBar
                      key={s.stageId}
                      label={s.stageName}
                      count={days}
                      max={maxAvg}
                      color={stageColor(hue, 'solid')}
                      suffix={s.avgDays !== null ? 'd' : ''}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </Section>

        {/* Created by week */}
        <Section title="Demands created per week">
          <div style={{ background: 'oklch(1 0 0)', border: `1px solid ${C.border}`, borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.3, marginBottom: 14 }}>
              Last 8 weeks — includes completed demands.
            </div>
            {!hasSparkData ? <EmptySlate /> : <Sparkline data={data.createdByWeek} />}
          </div>
        </Section>

      </main>
    </div>
  )
}

interface Props {
  date?: string
}

export default function DueDate({ date }: Props) {
  if (!date) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  const overdue = diff < 0
  const soon = diff >= 0 && diff <= 2

  const text =
    overdue    ? `${Math.abs(diff)}d atrasado` :
    diff === 0 ? 'hoje' :
    diff === 1 ? 'amanhã' :
                 `em ${diff}d`

  const color =
    overdue ? 'oklch(0.62 0.20 28)' :
    soon    ? 'oklch(0.62 0.16 60)' :
              'oklch(0.45 0.02 60)'

  return (
    <span style={{
      fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
      color, letterSpacing: 0.2,
      fontWeight: overdue ? 700 : 500,
    }}>
      {text}
    </span>
  )
}
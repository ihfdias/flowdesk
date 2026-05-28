interface Props {
  priority?: 'high' | 'medium' | 'low'
}

export default function PriorityDot({ priority }: Props) {
  const color =
    priority === 'high'   ? 'oklch(0.55 0.22 15)' :
    priority === 'medium' ? 'oklch(0.72 0.17 45)' :
                            'oklch(0.70 0.01 60)'

  return (
    <span
      title={`priority: ${priority ?? 'low'}`}
      style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}
    />
  )
}

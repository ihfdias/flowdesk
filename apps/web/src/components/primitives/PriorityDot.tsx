interface Props {
  priority?: 'alta' | 'média' | 'baixa'
}

export default function PriorityDot({ priority }: Props) {
  const color =
    priority === 'alta'  ? 'oklch(0.55 0.22 15)' :
    priority === 'média' ? 'oklch(0.72 0.17 45)' :
                           'oklch(0.70 0.01 60)'

  return (
    <span
      title={`prioridade ${priority ?? 'baixa'}`}
      style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}
    />
  )
}
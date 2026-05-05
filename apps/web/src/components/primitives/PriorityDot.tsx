interface Props {
  priority?: 'alta' | 'média' | 'baixa'
}

export default function PriorityDot({ priority }: Props) {
  const color =
    priority === 'alta'  ? 'oklch(0.62 0.18 28)' :
    priority === 'média' ? 'oklch(0.72 0.14 75)' :
                           'oklch(0.72 0.04 240)'

  return (
    <span
      title={`prioridade ${priority ?? 'baixa'}`}
      style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}
    />
  )
}
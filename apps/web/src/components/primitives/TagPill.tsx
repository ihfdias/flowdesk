interface Props {
  tag: string
}

export default function TagPill({ tag }: Props) {
  return (
    <span style={{
      fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
      color: 'oklch(0.42 0.02 60)',
      textTransform: 'uppercase', letterSpacing: 0.6,
      padding: '2px 6px',
      border: '1px solid oklch(0.88 0.01 60)',
      borderRadius: 3,
    }}>
      {tag}
    </span>
  )
}
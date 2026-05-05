import { stageColor } from '../../lib/colors'

interface Props {
  name: string
  hue: number
  size?: 'sm' | 'md'
}

export default function StageChip({ name, hue, size = 'md' }: Props) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: size === 'sm' ? '3px 8px' : '5px 10px',
      borderRadius: 999,
      background: stageColor(hue, 'soft'),
      color: stageColor(hue, 'ink'),
      fontSize: size === 'sm' ? 10 : 11,
      fontWeight: 600,
      fontFamily: 'JetBrains Mono, monospace',
      letterSpacing: 0.3, textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: stageColor(hue, 'solid') }} />
      {name}
    </span>
  )
}
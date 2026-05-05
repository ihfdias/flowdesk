import { hashHue } from '../../lib/colors'

interface Props {
  name?: string
  size?: number
  ring?: boolean
}

export default function Avatar({ name, size = 24, ring = false }: Props) {
  if (!name) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: '1.5px dashed currentColor', opacity: 0.4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.42, fontFamily: 'JetBrains Mono, monospace',
      }}>?</div>
    )
  }

  const hue = hashHue(name)
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('')

  return (
    <div title={name} style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, oklch(0.72 0.16 ${hue}) 0%, oklch(0.52 0.18 ${(hue + 40) % 360}) 100%)`,
      color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, letterSpacing: -0.3,
      flexShrink: 0,
      boxShadow: ring ? '0 0 0 2px white' : 'none',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {initials}
    </div>
  )
}
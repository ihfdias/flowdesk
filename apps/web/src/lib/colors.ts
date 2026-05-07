const STAGE_HUES = [28, 320, 270, 200, 145]

export const COLOR_OPTIONS: Array<{ value: string; hue: number }> = [
  { value: 'orange', hue: 28 },
  { value: 'pink', hue: 320 },
  { value: 'purple', hue: 270 },
  { value: 'cyan', hue: 200 },
  { value: 'green', hue: 145 },
  { value: 'red', hue: 15 },
  { value: 'yellow', hue: 75 },
]

export function getStageHue(order: number): number {
  return STAGE_HUES[order % STAGE_HUES.length]
}

export function stageHueFromColor(color: string, fallbackOrder: number): number {
  const opt = COLOR_OPTIONS.find(o => o.value === color)
  return opt ? opt.hue : getStageHue(fallbackOrder)
}

export function stageColor(hue: number, kind: 'solid' | 'deep' | 'soft' | 'softer' | 'ink' | 'ring'): string {
  const c = 0.16
  switch (kind) {
    case 'solid':  return `oklch(0.62 ${c} ${hue})`
    case 'deep':   return `oklch(0.42 ${c} ${hue})`
    case 'soft':   return `oklch(0.94 0.05 ${hue})`
    case 'softer': return `oklch(0.97 0.03 ${hue})`
    case 'ink':    return `oklch(0.30 0.10 ${hue})`
    case 'ring':   return `oklch(0.62 ${c} ${hue} / 0.35)`
  }
}

export function hashHue(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}
interface Props {
  size?: number
  color?: string
}

export default function Spinner({ size = 14, color = '#fff' }: Props) {
  return (
    <>
      <style>{`@keyframes fdSpin{to{transform:rotate(360deg)}}`}</style>
      <span style={{
        display: 'inline-block', flexShrink: 0,
        width: size, height: size,
        borderRadius: '50%',
        border: `2px solid ${color}44`,
        borderTopColor: color,
        animation: 'fdSpin .65s linear infinite',
      }} />
    </>
  )
}

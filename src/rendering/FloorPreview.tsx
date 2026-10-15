import { useEffect, useRef } from 'react'

export function FloorPreview({ source }: { source?: HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !source) return
    canvas.width = source.width
    canvas.height = source.height
    canvas.getContext('2d', { colorSpace: 'srgb' })?.drawImage(source, 0, 0)
    canvas.dataset.renderMs = source.dataset.renderMs
  }, [source])
  return <canvas ref={ref} className="floor-canvas" aria-label="Full coverage epoxy floor preview" />
}

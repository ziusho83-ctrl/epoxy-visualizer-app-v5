import { useEffect, useRef, useState } from 'react'
import { loadPhoto, renderFloor, type FloorOptions } from './floor'

export function useFloorPreview(url: string, options: FloorOptions) {
  const photoRef = useRef<{ url: string; promise: ReturnType<typeof loadPhoto> } | null>(null)
  const key = JSON.stringify([url, options])
  const [result, setResult] = useState<{ key: string; canvas?: HTMLCanvasElement; photo?: HTMLCanvasElement; error?: string } | null>(null)
  useEffect(() => {
    if (!url) return
    let cancelled = false
    if (photoRef.current?.url !== url) photoRef.current = { url, promise: loadPhoto(url) }
    photoRef.current.promise.then(photo => {
      if (cancelled) return
      const start = performance.now()
      const canvas = renderFloor(photo, JSON.parse(key)[1] as FloorOptions)
      canvas.dataset.renderMs = String(Math.round(performance.now() - start))
      setResult({ key, canvas, photo })
    }).catch((error: unknown) => {
      if (!cancelled) setResult({ key, error: error instanceof Error ? error.message : 'Preview failed. Please try another photo.' })
    })
    return () => { cancelled = true }
  }, [url, key])
  return result?.key === key ? result : null
}


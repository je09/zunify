import { useRef, useLayoutEffect, useCallback } from 'react'
import { Icons } from './icons'

// ── Bottom back bar — shared across all sub-screens ──────────────────────────
export function BottomBack({ onBack }: { onBack: () => void }) {
  return (
    <div className="appbar">
      <button className="iconbtn appback" onClick={onBack} aria-label="Back">
        {Icons.back}
      </button>
    </div>
  )
}

// ── Pivot header ─────────────────────────────────────────────────────────────
interface PivotProps {
  tabs: string[]
  active: number
  onChange: (i: number) => void
}

export function Pivot({ tabs, active, onChange }: PivotProps) {
  const itemRefs = useRef<(HTMLHeadingElement | null)[]>([])
  const trackRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = itemRefs.current[active]
    const track = trackRef.current
    if (el && track) track.scrollTo({ left: Math.max(0, el.offsetLeft - 26), behavior: 'auto' })
  }, [active])

  return (
    <div className="pivot" ref={trackRef}>
      <div className="pivot-track">
        {tabs.map((tab, i) => (
          <h2
            key={tab}
            ref={(el) => { itemRefs.current[i] = el }}
            className={'pivot-h' + (i === active ? ' active' : '')}
            onClick={() => onChange(i)}
          >
            {tab}
          </h2>
        ))}
      </div>
    </div>
  )
}

// ── Swipe detection ──────────────────────────────────────────────────────────
// Pointer events work for both mouse and touch.
interface SwipeStart { x: number; y: number }

export function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<SwipeStart | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    start.current = null
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      e.stopPropagation() // don't bubble to any parent swipe handler
      dx < 0 ? onNext() : onPrev()
    }
  }, [onNext, onPrev])

  const onPointerCancel = useCallback(() => { start.current = null }, [])

  return { onPointerDown, onPointerUp, onPointerCancel }
}

// ── Progress bar with drag-to-seek (touch + mouse) ───────────────────────────
interface ProgressBarProps {
  pct: number
  onSeek: (fraction: number) => void
}

export function ProgressBar({ pct, onSeek }: ProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null)

  const getFraction = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    onSeek(getFraction(e))
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    onSeek(getFraction(e))
  }

  return (
    <div className="progress">
      <div
        ref={barRef}
        className="bar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <div className="fill" style={{ width: pct + '%' }} />
      </div>
    </div>
  )
}

// ── Shared small components ───────────────────────────────────────────────────
export function Overline({ children }: { children: React.ReactNode }) {
  return <div className="overline">{children}</div>
}

export function Section({ children }: { children: React.ReactNode }) {
  return <div className="section">{children}</div>
}

interface ThumbProps {
  color: string
  size?: number   // omit or 0 → fills container width with aspect-ratio 1:1
  imageUrl?: string
}

export function Thumb({ color, size, imageUrl }: ThumbProps) {
  const fill = !size
  const boxStyle: React.CSSProperties = fill
    ? { background: color, width: '100%', aspectRatio: '1 / 1' }
    : { background: color, width: size, height: size }
  const imgStyle: React.CSSProperties = fill
    ? { width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }
    : { width: size, height: size, objectFit: 'cover', display: 'block' }

  return imageUrl
    ? <img className="thumb" src={imageUrl} alt="" style={imgStyle} />
    : <div className="thumb" style={boxStyle} />
}

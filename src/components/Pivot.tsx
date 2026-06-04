import { useRef, useLayoutEffect, useState, useCallback, useEffect, Children, ReactNode, forwardRef } from 'react'
import { Icons } from './icons'

// ── PivotArea — sliding tab transition (both tabs visible during animation) ───
// Renders the exiting tab and the entering tab simultaneously with CSS slide
// animations, giving the Metro "peek" effect where both contents are visible.
// forwardRef so callers can attach a swipe gesture ref directly to the div.

export const PivotArea = forwardRef<HTMLDivElement, { tab: number; children: ReactNode[] } & React.HTMLAttributes<HTMLDivElement>>(function PivotArea({
  tab,
  children,
  ...rest
}, outerRef) {
  const prevRef = useRef(tab)
  const [exiting, setExiting] = useState<{ tab: number; dir: 'fwd' | 'back' } | null>(null)

  useLayoutEffect(() => {
    if (tab !== prevRef.current) {
      setExiting({ tab: prevRef.current, dir: tab > prevRef.current ? 'fwd' : 'back' })
      prevRef.current = tab
    }
  }, [tab])

  const arr = Children.toArray(children)

  return (
    <div className="pivot-area" ref={outerRef} {...rest}>
      {exiting && (
        <div
          key={`exit-${exiting.tab}`}
          className={`pivot-pane pivot-exit-${exiting.dir}`}
          onAnimationEnd={() => setExiting(null)}
        >
          {arr[exiting.tab]}
        </div>
      )}
      <div
        key={`cur-${tab}`}
        className={`pivot-pane${exiting ? ` pivot-enter-${exiting.dir}` : ''}`}
      >
        {arr[tab]}
      </div>
    </div>
  )
})

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
    if (el && track) track.scrollTo({ left: Math.max(0, el.offsetLeft - 26), behavior: 'smooth' })
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
// Uses native touch listeners (not React synthetic events) so we can attach
// touchmove as { passive: false } and call preventDefault() to claim the
// gesture before iOS fires pointercancel and drops it.
// Mouse is handled separately so desktop dev still works.

export function useSwipe(onPrev: () => void, onNext: () => void) {
  const onPrevRef = useRef(onPrev); onPrevRef.current = onPrev
  const onNextRef = useRef(onNext); onNextRef.current = onNext
  const cleanupRef = useRef<(() => void) | null>(null)

  const ref = useCallback((el: HTMLElement | null) => {
    // Always run the previous cleanup first (handles unmount and re-mount).
    cleanupRef.current?.()
    cleanupRef.current = null
    if (!el) return

    const start = { touch: null as { x: number; y: number } | null,
                    mouse: null as { x: number; y: number } | null }

    // ── Touch (iOS PWA) ──────────────────────────────────────────────────────
    const onTouchStart = (e: TouchEvent) => {
      const target = e.target
      if (target instanceof HTMLElement && (target.closest('.progress') || target.classList.contains('progress'))) return
      start.touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!start.touch) return
      const dx = Math.abs(e.touches[0].clientX - start.touch.x)
      const dy = Math.abs(e.touches[0].clientY - start.touch.y)
      // Claim the gesture when motion is primarily horizontal so iOS doesn't
      // fire pointercancel and hand the touch to the system gesture handler.
      if (dx > dy && dx > 8) e.preventDefault()
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (!start.touch) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.touch.x
      const dy = t.clientY - start.touch.y
      start.touch = null
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        dx < 0 ? onNextRef.current() : onPrevRef.current()
      }
    }
    const onTouchCancel = () => { start.touch = null }

    // ── Mouse (desktop) ──────────────────────────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target
      if (target instanceof HTMLElement && (target.closest('.progress') || target.classList.contains('progress'))) return
      start.mouse = { x: e.clientX, y: e.clientY }
    }
    const onMouseUp   = (e: MouseEvent) => {
      if (!start.mouse) return
      const dx = e.clientX - start.mouse.x
      const dy = e.clientY - start.mouse.y
      start.mouse = null
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        dx < 0 ? onNextRef.current() : onPrevRef.current()
      }
    }

    el.addEventListener('touchstart',  onTouchStart,  { passive: true })
    el.addEventListener('touchmove',   onTouchMove,   { passive: false }) // must be non-passive
    el.addEventListener('touchend',    onTouchEnd,    { passive: true })
    el.addEventListener('touchcancel', onTouchCancel, { passive: true })
    el.addEventListener('mousedown',   onMouseDown)
    el.addEventListener('mouseup',     onMouseUp)

    cleanupRef.current = () => {
      el.removeEventListener('touchstart',  onTouchStart)
      el.removeEventListener('touchmove',   onTouchMove)
      el.removeEventListener('touchend',    onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
      el.removeEventListener('mousedown',   onMouseDown)
      el.removeEventListener('mouseup',     onMouseUp)
    }
  }, [])

  return ref
}

// ── Progress bar with drag-to-seek (touch + mouse) ───────────────────────────
interface ProgressBarProps {
  pct: number
  onSeek: (fraction: number) => void
  onPreviewSeek?: (fraction: number) => void
  onPreviewEnd?: () => void
}

export function ProgressBar({ pct, onSeek, onPreviewSeek, onPreviewEnd }: ProgressBarProps) {
  const barRef   = useRef<HTMLDivElement>(null)
  const touchRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [dragPct, setDragPct] = useState<number | null>(null)

  useEffect(() => {
    const el = touchRef.current
    if (!el) return
    const claim = (e: TouchEvent) => {
      if (dragging.current) e.preventDefault()
    }
    el.addEventListener('touchmove', claim, { passive: false })
    return () => el.removeEventListener('touchmove', claim)
  }, [])

  const getFraction = (e: React.PointerEvent) => {
    if (!barRef.current) return null
    const r = barRef.current.getBoundingClientRect()
    if (r.width <= 0) return null
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    const f = getFraction(e)
    if (f !== null) {
      setDragPct(f * 100)
      onPreviewSeek?.(f)
    }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    e.stopPropagation()
    e.preventDefault()
    const f = getFraction(e)
    if (f !== null) {
      setDragPct(f * 100)
      onPreviewSeek?.(f)
    }
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    e.stopPropagation()
    e.preventDefault()
    dragging.current = false
    const f = getFraction(e)
    setDragPct(null)
    onPreviewEnd?.()
    if (f !== null) onSeek(f)
  }
  const onPointerCancel = () => { dragging.current = false; setDragPct(null); onPreviewEnd?.() }

  const displayPct = dragPct !== null ? dragPct : pct

  return (
    <div className="progress">
      {/* bar-touch expands the hit area to 28px so touch is reliable */}
      {/* touch-action:none prevents iOS from treating horizontal drag as back gesture */}
      <div
        className="bar-touch"
        ref={touchRef}
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div ref={barRef} className="bar">
          <div className="fill" style={{ width: displayPct + '%' }} />
        </div>
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
    ? <img className="thumb" src={imageUrl} alt="" style={imgStyle} loading="lazy" decoding="async" />
    : <div className="thumb" style={boxStyle} />
}

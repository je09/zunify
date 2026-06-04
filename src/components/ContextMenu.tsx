import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

export interface MenuItem {
  label: string
  onClick?: () => void
  danger?: boolean
}

interface MenuOpts {
  items: MenuItem[]
  origin?: { x: number; y: number }
}

type SetMenuFn = ((opts: MenuOpts) => void) | null
let _setMenu: SetMenuFn = null

export function openContextMenu(opts: MenuOpts) {
  _setMenu?.(opts)
}

export function useLongPress(getItems: () => MenuItem[]) {
  const timer = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>)
  const fired = useRef(false)
  const origin = useRef({ x: 0, y: 0 })

  const cancel = useCallback(() => clearTimeout(timer.current), [])

  const begin = useCallback((e: React.PointerEvent) => {
    if (e.button === 2) return
    origin.current = { x: e.clientX, y: e.clientY }
    fired.current = false
    cancel()
    timer.current = setTimeout(() => {
      fired.current = true
      if (navigator.vibrate) { try { navigator.vibrate(14) } catch {} }
      openContextMenu({ items: getItems(), origin: origin.current })
    }, 450)
  }, [cancel, getItems])

  const move = useCallback((e: React.PointerEvent) => {
    if (Math.abs(e.clientX - origin.current.x) > 10 ||
        Math.abs(e.clientY - origin.current.y) > 10) cancel()
  }, [cancel])

  return {
    onPointerDown: begin,
    onPointerMove: move,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      fired.current = true
      origin.current = { x: e.clientX, y: e.clientY }
      openContextMenu({ items: getItems(), origin: origin.current })
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) { e.stopPropagation(); e.preventDefault(); fired.current = false }
    },
  }
}

export function ContextMenuHost() {
  const [menu, setMenu] = useState<MenuOpts | null>(null)
  const [closing, setClosing] = useState(false)
  const openedAt = useRef(0)

  useEffect(() => {
    _setMenu = (m) => { openedAt.current = Date.now(); setClosing(false); setMenu(m) }
    return () => { _setMenu = null }
  }, [])

  const close = useCallback(() => {
    setClosing(true)
    setTimeout(() => { setMenu(null); setClosing(false) }, 240)
  }, [])

  const backdropClose = useCallback(() => {
    if (Date.now() - openedAt.current < 320) return
    close()
  }, [close])

  // page recede effect
  useEffect(() => {
    const shell = document.getElementById('app-shell')
    if (!shell) return
    if (menu && !closing) shell.classList.add('ctx-open')
    else shell.classList.remove('ctx-open')
  }, [menu, closing])

  // keyboard dismiss
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, close])

  if (!menu) return null

  const shellEl = document.getElementById('app-shell')
  if (!shellEl) return null

  const rect = shellEl.getBoundingClientRect()
  const scale = (rect.height / 800) || 1
  const items = menu.items
  const n = items.length
  const ITEM_H = 57, PAD = 20
  const panelH = n * ITEM_H + PAD
  let top = menu.origin ? (menu.origin.y - rect.top) / scale - 24 : 360
  top = Math.max(24, Math.min(top, 800 - panelH - 24))

  const fire = (it: MenuItem) => {
    close()
    if (it.onClick) setTimeout(it.onClick, 0)
  }

  return createPortal(
    <>
      <div
        className={'ctx-backdrop' + (closing ? ' closing' : '')}
        onClick={backdropClose}
      />
      <div className="ctx-menu-wrap" style={{ top: top + 'px' }}>
        <div className={'ctx-menu' + (closing ? ' closing' : '')}>
          {items.map((it, i) => (
            <button
              key={i}
              className={'ctx-item' + (it.danger ? ' danger' : '')}
              style={{ animationDelay: (closing ? (n - 1 - i) * 26 : i * 40) + 'ms' }}
              onClick={() => fire(it)}
            >
              {it.label}
            </button>
          ))}
        </div>
      </div>
    </>,
    shellEl
  )
}

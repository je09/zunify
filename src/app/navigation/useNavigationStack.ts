import { useCallback, useRef, useState } from 'react'

export interface NavigationEntry<T> {
  id: number
  frame: T
}

export interface NavigationState<T> {
  current: T
  stack: NavigationEntry<T>[]
  key: number
  direction: 'fwd' | 'back'
  push: (frame: T) => void
  back: () => void
  updateCurrent: (update: (frame: T) => T) => void
}

export function useNavigationStack<T>(initial: T): NavigationState<T> {
  const nextIdRef = useRef(1)
  const [stack, setStack] = useState<NavigationEntry<T>[]>([{ id: 0, frame: initial }])
  const [key, setKey] = useState(0)
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd')

  const push = useCallback((frame: T) => {
    const id = nextIdRef.current++
    setDirection('fwd')
    setStack(prev => [...prev, { id, frame }])
    setKey(id)
  }, [])

  const back = useCallback(() => {
    setStack(prev => {
      if (prev.length <= 1) return prev
      const next = prev.slice(0, -1)
      setDirection('back')
      setKey(next[next.length - 1]?.id ?? 0)
      return next
    })
  }, [])

  const updateCurrent = useCallback((update: (frame: T) => T) => {
    setStack(prev => prev.map((entry, index) => index === prev.length - 1 ? { ...entry, frame: update(entry.frame) } : entry))
  }, [])

  return { current: stack[stack.length - 1]?.frame ?? initial, stack, key, direction, push, back, updateCurrent }
}

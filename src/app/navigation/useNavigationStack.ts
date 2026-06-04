import { useCallback, useState } from 'react'

export interface NavigationState<T> {
  current: T
  key: number
  direction: 'fwd' | 'back'
  push: (frame: T) => void
  back: () => void
  updateCurrent: (update: (frame: T) => T) => void
}

export function useNavigationStack<T>(initial: T): NavigationState<T> {
  const [stack, setStack] = useState<T[]>([initial])
  const [key, setKey] = useState(0)
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd')

  const push = useCallback((frame: T) => {
    setDirection('fwd')
    setStack(prev => [...prev, frame])
    setKey(prev => prev + 1)
  }, [])

  const back = useCallback(() => {
    setStack(prev => {
      if (prev.length <= 1) return prev
      setDirection('back')
      setKey(k => k + 1)
      return prev.slice(0, -1)
    })
  }, [])

  const updateCurrent = useCallback((update: (frame: T) => T) => {
    setStack(prev => prev.map((frame, index) => index === prev.length - 1 ? update(frame) : frame))
  }, [])

  return { current: stack[stack.length - 1] ?? initial, key, direction, push, back, updateCurrent }
}

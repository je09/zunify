import type { CSSProperties, ImgHTMLAttributes } from 'react'
import { useEffect, useRef, useState } from 'react'

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  boxClassName?: string
  boxStyle?: CSSProperties
}

export function FadeImage({ boxClassName, boxStyle, className, src, onLoad, ...props }: Props) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    let cancelled = false
    const img = imgRef.current

    setLoaded(false)
    if (!img?.complete) return

    const decoded = img.decode?.() ?? Promise.resolve()
    void decoded.catch(() => undefined).finally(() => {
      if (!cancelled) setLoaded(true)
    })

    return () => {
      cancelled = true
    }
  }, [src])

  return (
    <span className={'fade-img-box' + (boxClassName ? ` ${boxClassName}` : '')} style={boxStyle}>
      <img
        {...props}
        ref={imgRef}
        className={'fade-img' + (loaded ? ' loaded' : '') + (className ? ` ${className}` : '')}
        src={src}
        onLoad={async (e) => {
          try {
            await e.currentTarget.decode?.()
          } catch {}
          setLoaded(true)
          onLoad?.(e)
        }}
      />
    </span>
  )
}

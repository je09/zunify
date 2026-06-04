import { ACCENTS, ThemeMode } from '../../hooks/useTheme'
import { Icons } from '../../components/icons'

const ACCENT_NAMES: Record<string, string> = {
  '#5ca800': 'olive',
  '#1ba1e2': 'cyan',
  '#a4c400': 'lime',
  '#d80073': 'magenta',
  '#fa6800': 'orange',
  '#6a00ff': 'violet',
}

interface Props {
  theme: ThemeMode
  accent: string
  onTheme: (v: ThemeMode) => void
  onAccent: (v: string) => void
  onBack: () => void
}

export function LooksScreen({ theme, accent, onTheme, onAccent, onBack }: Props) {
  return (
    <div className="overlay-screen">
      <div className="page ov-looks">
        <div className="overline">settings</div>
        <div className="ov-title">looks</div>
        <div className="scroll">
          <div className="section">background</div>
          <div className="looks-bg">
            {(['dark', 'light'] as ThemeMode[]).map(m => (
              <button
                key={m}
                className={'looks-opt' + (theme === m ? ' on' : '')}
                onClick={() => onTheme(m)}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="section">accent colour</div>
          <div className="looks-accents">
            {ACCENTS.map(c => (
              <button
                key={c}
                className={'acc-tile' + (accent === c ? ' on' : '')}
                style={{ background: c }}
                onClick={() => onAccent(c)}
                aria-label={ACCENT_NAMES[c] ?? c}
              >
                {accent === c && <span className="acc-check">✓</span>}
              </button>
            ))}
          </div>
          <div className="acc-name">{ACCENT_NAMES[accent] ?? accent}</div>
          <div style={{ height: 40 }} />
        </div>
        <button className="page-back" onClick={onBack} aria-label="Back">
          {Icons.back}
        </button>
      </div>
    </div>
  )
}

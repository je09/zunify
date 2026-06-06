import { Icons } from '../../components/icons'

const buildDateValue = (
  import.meta as unknown as { env?: { VITE_BUILD_DATE?: string } }
).env?.VITE_BUILD_DATE
const buildDate = buildDateValue
  ? new Date(buildDateValue).toLocaleString()
  : 'dev'

interface Props {
  onBack: () => void
}

export function AboutScreen({ onBack }: Props) {
  return (
    <div className="overlay-screen">
      <div className="page ov-about">
        <div className="overline">settings</div>
        <div className="ov-title">about</div>
        <div className="scroll">
          <div className="section">zunify</div>
          <div className="about-copy">
            A Metro-style Spotify player for the web.
          </div>

          <div className="section">build</div>
          <div className="about-value">{buildDate}</div>

          <div className="section">source</div>
          <a
            className="about-link"
            href="https://github.com/je09/zunify"
            target="_blank"
            rel="noreferrer"
          >
            github.com/je09/zunify
          </a>

          <div style={{ height: 40 }} />
        </div>
        <button className="page-back" onClick={onBack} aria-label="Back">
          {Icons.back}
        </button>
      </div>
    </div>
  )
}

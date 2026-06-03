import { useState } from 'react'
import { ACCENTS, ThemeMode, useTheme } from '../../hooks/useTheme'
import { getClientId, getRedirectUri, setClientId } from '../../spotifyConfig'
import { startLogin } from '../auth/spotifyAuth'

interface SettingsProps {
  theme: ReturnType<typeof useTheme>
  token: string | null
  sdkError: string | null
  onClearSdkError: () => void
  onLogout: () => void
  onClose: () => void
}

export function Settings({ theme, token, sdkError, onClearSdkError, onLogout, onClose }: SettingsProps) {
  const [clientId, setClientIdState] = useState(getClientId)
  const [loginError, setLoginError] = useState('')
  const loggedIn = Boolean(token)

  const handleLogin = async () => {
    setLoginError('')
    try { await startLogin() }
    catch (e) { setLoginError(e instanceof Error ? e.message : String(e)) }
  }

  const saveClientId = (value: string) => {
    setClientIdState(value)
    setClientId(value)
  }

  return (
    <div className="settings-overlay">
      <button className="settings-close" onClick={onClose} aria-label="Close">×</button>
      <div className="settings-title">settings</div>

      <div className="settings-label">accent color</div>
      <div className="accent-swatches">
        {ACCENTS.map(color => (
          <div
            key={color}
            className={'swatch' + (color === theme.accent ? ' active' : '')}
            style={{ background: color }}
            onClick={() => theme.setAccent(color)}
            role="button"
            aria-label={`Accent ${color}`}
          />
        ))}
      </div>

      <div className="settings-label">theme</div>
      <div className="theme-btns">
        {(['dark', 'light'] as ThemeMode[]).map(mode => (
          <button
            key={mode}
            className={'theme-btn' + (mode === theme.mode ? ' active' : '')}
            onClick={() => theme.setMode(mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="settings-label" style={{ marginTop: 24 }}>spotify</div>

      {!loggedIn && (
        <>
          <div className="settings-hint">
            1. Go to <span style={{ color: 'var(--accent)' }}>developer.spotify.com</span> → Dashboard → Create app.<br />
            2. Add Redirect URI: <code>{getRedirectUri()}</code><br />
            3. Paste Client ID below. Premium = full tracks; free = 30 s previews.
          </div>
          <input
            className="settings-input"
            type="text"
            placeholder="Client ID"
            value={clientId}
            onChange={(e) => saveClientId(e.target.value)}
            spellCheck={false}
          />
          <button
            className="theme-btn"
            style={{ marginTop: 8 }}
            disabled={!clientId.trim()}
            onClick={handleLogin}
          >
            connect spotify
          </button>
          {loginError && (
            <div className="settings-hint" style={{ color: '#e74c3c', marginTop: 8, whiteSpace: 'pre-line' }}>
              {loginError}
            </div>
          )}
        </>
      )}

      {loggedIn && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <span style={{ color: '#1db954', fontSize: 13 }}>● connected</span>
            <button className="theme-btn" onClick={onLogout}>disconnect</button>
          </div>
          {sdkError && (
            <div className="settings-hint" style={{ color: '#e74c3c', marginTop: 8, whiteSpace: 'pre-line' }}>
              {sdkError}
              <button
                style={{ marginLeft: 8, background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 13 }}
                onClick={onClearSdkError}
                aria-label="Dismiss"
              >✕</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

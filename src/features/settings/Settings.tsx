import { useState } from "react";
import { getClientId, getRedirectUri, setClientId } from "../../spotifyConfig";
import { startLogin } from "../auth/spotifyAuth";
import { Icons } from "../../components/icons";

interface Props {
  token: string | null;
  sdkError: string | null;
  onClearSdkError: () => void;
  onLogout: () => void;
  onClose: () => void;
}

export function Settings({
  token,
  sdkError,
  onClearSdkError,
  onLogout,
  onClose,
}: Props) {
  const [clientId, setClientIdState] = useState(getClientId);
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const loggedIn = Boolean(token);

  const handleLogin = async () => {
    setLoginError("");
    setBusy(true);
    try {
      await startLogin();
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveClientId = (value: string) => {
    setClientIdState(value);
    setClientId(value);
  };

  return (
    <div className="overlay-screen">
      <div className="page ov-spotify">
        <div className="sp-head">
          <div className="sp-mark">{Icons.serviceMark}</div>
          <div className="sp-service">Spotify</div>
        </div>

        <div className="sp-body">
          {loggedIn ? (
            <>
              <div className="sp-tick">✓</div>
              <div className="sp-h">connected</div>
              <div className="sp-sub">
                zunify is linked to your Spotify account. Playback syncs
                automatically.
              </div>
              {sdkError && (
                <div
                  className="sp-sub"
                  style={{ color: "#e74c3c", marginTop: 12 }}
                >
                  {sdkError}
                  <button
                    style={{
                      marginLeft: 8,
                      background: "none",
                      border: "none",
                      color: "#e74c3c",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                    onClick={onClearSdkError}
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="sp-actions">
                <button className="sp-btn ghost" onClick={onLogout}>
                  disconnect
                </button>
                <button className="sp-btn ghost" onClick={onClose}>
                  done
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="sp-h">authorize zunify</div>
              <div className="sp-sub">
                Enter your Spotify Client ID to connect. Get it from{" "}
                <span style={{ color: "#1DB954" }}>developer.spotify.com</span>{" "}
                → Dashboard → Create app.
              </div>
              <div className="sp-sub" style={{ marginTop: 10, fontSize: 17 }}>
                Redirect URI:{" "}
                <code style={{ fontSize: 13, opacity: 0.8 }}>
                  {getRedirectUri()}
                </code>
              </div>
              <ul className="sp-perms">
                <li>view your playlists and saved music</li>
                <li>control playback on your devices</li>
                <li>see what you&apos;re currently listening to</li>
              </ul>
              <div style={{ marginTop: 20 }}>
                <input
                  className="settings-input"
                  type="text"
                  placeholder="Client ID"
                  value={clientId}
                  onChange={(e) => saveClientId(e.target.value)}
                  spellCheck={false}
                />
              </div>
              {loginError && (
                <div
                  className="sp-sub"
                  style={{
                    color: "#e74c3c",
                    marginTop: 8,
                    whiteSpace: "pre-line",
                    fontSize: 16,
                  }}
                >
                  {loginError}
                </div>
              )}
              <div className="sp-actions">
                <button
                  className="sp-btn solid"
                  disabled={busy || !clientId.trim()}
                  onClick={handleLogin}
                >
                  {busy ? "connecting…" : "agree"}
                </button>
                <button className="sp-btn ghost" onClick={onClose}>
                  cancel
                </button>
              </div>
              <div className="sp-foot">
                you can revoke access anytime in settings
              </div>
            </>
          )}
        </div>

        <button className="page-back" onClick={onClose} aria-label="Back">
          {Icons.back}
        </button>
      </div>
    </div>
  );
}

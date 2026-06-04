// Plays a tiny silent audio loop on the main page so iOS routes media session
// lockscreen events here instead of to the Spotify SDK's cross-origin iframe.
// The iframe's JS is throttled when backgrounded; main-page PWA JS is not.
// Must be called from a user-gesture handler (play/toggle) — iOS requires it.

let audio: HTMLAudioElement | null = null
let blobUrl: string | null = null

function buildSilentWavUrl(): string {
  const sampleRate = 8000
  const numSamples = sampleRate * 30 // 30 seconds — reduces loop-reset glitches vs 1s
  const buf = new Uint8Array(44 + numSamples)
  const v = new DataView(buf.buffer)
  buf.set([82, 73, 70, 70], 0)          // "RIFF"
  v.setUint32(4, 36 + numSamples, true) // chunk size LE
  buf.set([87, 65, 86, 69], 8)          // "WAVE"
  buf.set([102, 109, 116, 32], 12)      // "fmt "
  v.setUint32(16, 16, true)             // fmt chunk size
  v.setUint16(20, 1, true)              // PCM
  v.setUint16(22, 1, true)              // mono
  v.setUint32(24, sampleRate, true)     // sample rate
  v.setUint32(28, sampleRate, true)     // byte rate
  v.setUint16(32, 1, true)              // block align
  v.setUint16(34, 8, true)              // bits per sample
  buf.set([100, 97, 116, 97], 36)       // "data"
  v.setUint32(40, numSamples, true)     // data size
  buf.fill(0x80, 44)                    // 0x80 = silence in 8-bit unsigned PCM
  // Blob URL avoids large base64 data URI (~320KB)
  blobUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  return blobUrl
}

export function claimAudioSession(): void {
  if (audio) return
  audio = document.createElement('audio')
  audio.src = buildSilentWavUrl()
  audio.loop = true
  void audio.play().catch(() => {})
}

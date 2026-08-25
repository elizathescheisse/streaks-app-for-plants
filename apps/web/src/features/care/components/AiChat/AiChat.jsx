import { useState, useRef, useEffect } from 'react'
import styles from './AiChat.module.css'

// Photo attachments — every number below is a reasonable-sounding guess,
// not something measured against real phone photos or real usage.
const MAX_IMAGES_PER_MESSAGE = 4     // arbitrary cap, just to stop one message ballooning
const MAX_IMAGE_DIM = 1280           // longest side, px — resized before sending
const JPEG_QUALITY = 0.82            // re-encode quality after resizing

// Voice dictation via the browser's own speech recognition — no server
// round-trip, no OpenAI cost, works today in Chrome/Edge. Safari's support
// is unreliable (partial/experimental depending on version), so the mic
// button simply doesn't render there rather than showing something broken.
// Judgment call, not an obviously-right pick: the alternative (record audio,
// send it to OpenAI's transcription API) would work consistently across all
// browsers but adds a new backend endpoint, mic-recording UI, and per-use
// cost — not worth it for a first cut when the free browser-native option
// covers the browsers this app is actually used in day to day.
const SpeechRecognitionCtor =
  typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

// Simple outline mic glyph — no icon library ships an outline (regular)
// style here (this project only has FontAwesome's solid set installed),
// so a one-off dependency for a single icon wasn't worth it. Stroke-only,
// inherits color from the button via currentColor.
function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  )
}

// Extract the text part of a message's content, whether it's a plain string
// (text-only) or the multimodal array form OpenAI expects once a photo is
// attached ([{type:'text',...}, {type:'image_url',...}]).
function textOf(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.find(p => p.type === 'text')?.text ?? ''
  return ''
}

// iPhones save photos as HEIC by default. Only Safari can decode HEIC in an
// <img>/canvas — Chrome, Firefox, and Edge cannot, so the resize step below
// would silently fail on a HEIC file in any of those. File.type is also
// unreliable for HEIC (often blank, especially outside Safari), so check the
// extension too.
function isHeic(file) {
  return file.type === 'image/heic' || file.type === 'image/heif' || /\.hei[cf]$/i.test(file.name)
}

// Converts HEIC/HEIF to JPEG before the normal resize pipeline runs. Loaded
// on demand (not at import time) since it's a WASM decoder — no reason to
// ship that to everyone who never attaches a HEIC photo.
async function convertHeicToJpeg(file) {
  try {
    const heic2any = (await import('heic2any')).default
    const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: JPEG_QUALITY })
    return Array.isArray(result) ? result[0] : result   // some HEIC files contain multiple images (e.g. Live Photos); use the first
  } catch {
    throw new Error(`Could not convert "${file.name}" — try exporting it as JPEG first.`)
  }
}

// Resizes+re-encodes an image file client-side before it ever leaves the
// browser — phone photos are routinely several MB, and Vercel's serverless
// functions reject request bodies over ~4.5MB. Shrinking to MAX_IMAGE_DIM
// keeps a handful of photos comfortably under that, and cuts image-token
// cost on the OpenAI side too.
async function resizeImageFile(file) {
  const source = isHeic(file) ? await convertHeicToJpeg(file) : file
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not load that image.'))
      img.onload = () => {
        let { width, height } = img
        if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
          const scale = MAX_IMAGE_DIM / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(source)
  })
}

// The reusable chat shell — message list, input, photo attach (paste/drop/
// picker), voice dictation. Doesn't know or care what `context` represents;
// it just JSON-serializes it and sends it to /api/chat alongside the
// conversation. PlantChat and GardenChat are both thin wrappers around this
// that differ only in what `context` they build and what title/placeholder
// they pass. Stateless on the server — history lives only in this
// component's state, so it resets on page refresh. No accounts yet; see
// /api/chat.js for the auth note.
export default function AiChat({ title, placeholder, context }) {
  const [messages, setMessages] = useState([])   // [{ role, content, attachments? }]
  const [attachments, setAttachments] = useState([])  // staged photos: [{ id, dataUrl }]
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [listening, setListening] = useState(false)
  const listRef = useRef(null)
  const fileInputRef = useRef(null)
  const recognitionRef = useRef(null)
  const dictationBaseRef = useRef('')   // draft text at the moment dictation started

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // Stop listening if the component unmounts mid-dictation (e.g. navigating away).
  useEffect(() => () => recognitionRef.current?.stop(), [])

  function toggleListening() {
    if (!SpeechRecognitionCtor) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    dictationBaseRef.current = draft
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-US'   // no locale detection — reasonable default, not tested with accents/other languages
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (e) => {
      // Rebuild from the full results list each time so earlier words don't
      // get lost as later phrases finalize — SpeechRecognition keeps every
      // segment (final and interim) in e.results for the whole session.
      let sessionText = ''
      for (let i = 0; i < e.results.length; i++) sessionText += e.results[i][0].transcript
      const base = dictationBaseRef.current
      setDraft(base + (base && sessionText ? ' ' : '') + sessionText)
    }
    recognition.onerror = (e) => {
      setListening(false)
      // "no-speech" / "aborted" are routine (mic opened, nothing said yet,
      // or the user stopped it themselves) — not worth alarming the user.
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setError('Could not hear you — check microphone permissions and try again.')
      }
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setError(null)
    setListening(true)
    recognition.start()
  }

  async function addFiles(fileList) {
    // HEIC files often report a blank or non-standard `type` outside Safari,
    // so the image/* check alone would silently drop them — isHeic() also
    // checks the file extension as a fallback.
    const files = [...fileList].filter(f => f.type.startsWith('image/') || isHeic(f))
    if (!files.length) return
    const room = MAX_IMAGES_PER_MESSAGE - attachments.length
    if (room <= 0) {
      setError(`You can attach up to ${MAX_IMAGES_PER_MESSAGE} photos at once.`)
      return
    }
    try {
      const encoded = await Promise.all(
        files.slice(0, room).map(async f => ({ id: `${Date.now()}-${Math.random()}`, dataUrl: await resizeImageFile(f) }))
      )
      setError(null)
      setAttachments(a => [...a, ...encoded])
    } catch (err) {
      setError(err.message || 'Could not process one of those images.')
    }
  }

  function removeAttachment(id) {
    setAttachments(a => a.filter(x => x.id !== id))
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    const files = [...items]
      .filter(it => it.kind === 'file' && it.type.startsWith('image/'))
      .map(it => it.getAsFile())
      .filter(Boolean)
    if (files.length) {
      e.preventDefault()   // don't also let the raw image data land in the textarea
      addFiles(files)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
  }

  async function send() {
    const text = draft.trim()
    if ((!text && attachments.length === 0) || sending) return

    const parts = []
    if (text) parts.push({ type: 'text', text })
    for (const a of attachments) parts.push({ type: 'image_url', image_url: { url: a.dataUrl } })
    const content = attachments.length ? parts : text

    const userMessage = { role: 'user', content, attachments }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setDraft('')
    setAttachments([])
    setError(null)
    setSending(true)

    try {
      // Strip the local-only `attachments` field before sending — OpenAI's
      // API expects message objects to have just role + content.
      const apiMessages = nextMessages.map(({ role, content }) => ({ role, content }))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, messages: apiMessages }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'The AI service is unavailable right now.')
      setMessages(m => [...m, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setError(err.message || 'Something went wrong — try again.')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <section
      className={`${styles.wrap} ${dragOver ? styles.wrapDragOver : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {title && <h2 className={styles.title}>{title}</h2>}

      {messages.length > 0 && (
        <div className={styles.list} ref={listRef}>
          {messages.map((m, i) => (
            <div key={i} className={`${styles.bubble} ${m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
              {m.attachments?.length > 0 && (
                <div className={styles.bubbleImages}>
                  {m.attachments.map(a => (
                    <img key={a.id} src={a.dataUrl} alt="" className={styles.bubbleImage} />
                  ))}
                </div>
              )}
              {textOf(m.content) && <div>{textOf(m.content)}</div>}
            </div>
          ))}
          {sending && <div className={`${styles.bubble} ${styles.bubbleAssistant} ${styles.bubbleTyping}`}>…</div>}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {attachments.length > 0 && (
        <div className={styles.attachmentStrip}>
          {attachments.map(a => (
            <div key={a.id} className={styles.attachmentThumb}>
              <img src={a.dataUrl} alt="" />
              <button
                type="button"
                className={styles.attachmentRemove}
                onClick={() => removeAttachment(a.id)}
                aria-label="Remove photo"
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.inputArea}>
        <textarea
          className={styles.input}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={1}
          disabled={sending}
        />
        <div className={styles.actionsRow}>
          <div className={styles.actionsLeft}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              className={styles.hiddenFileInput}
              onChange={e => { addFiles(e.target.files); e.target.value = '' }}
            />
            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              aria-label="Attach a photo"
              title="Attach a photo"
            >+</button>
            {SpeechRecognitionCtor && (
              <button
                type="button"
                className={`${styles.micBtn} ${listening ? styles.micBtnActive : ''}`}
                onClick={toggleListening}
                disabled={sending}
                aria-label={listening ? 'Stop dictating' : 'Dictate your question'}
                title={listening ? 'Stop dictating' : 'Dictate your question'}
              ><MicIcon /></button>
            )}
          </div>
          <button
            className={styles.sendBtn}
            onClick={send}
            disabled={sending || (!draft.trim() && attachments.length === 0)}
            type="button"
          >Send</button>
        </div>
      </div>
    </section>
  )
}

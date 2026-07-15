// @plant-streaks/core calls crypto.randomUUID() (in buildEventsFromForm and
// the add-plant flow). The web gets this from the browser; Hermes (RN's JS
// engine) may not expose it. Provide it only if missing — these IDs are
// local bundle/event keys, not security tokens, so a Math.random-based v4
// is fine. Imported first in index.js, before any app code runs.
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {}
}

if (typeof globalThis.crypto.randomUUID !== 'function') {
  globalThis.crypto.randomUUID = function randomUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}

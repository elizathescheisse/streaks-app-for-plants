// Local-only test server for api/chat.js.
//
// `vercel dev` proved unreliable in this monorepo for local testing (it
// insists on running a full framework build to serve non-API routes, which
// isn't needed here — we already have a working Vite dev server on 5175).
// This runs the exact same handler from api/chat.js directly, on port 3001,
// so Vite's /api proxy rule (see apps/web/vite.config.js) has something to
// talk to. Production deploys still use Vercel's real function runtime —
// this script only exists for local testing.
//
// Run with:  node --env-file=.env.local scripts/dev-api.js

import { createServer } from 'node:http'
import handler from '../api/chat.js'

const PORT = 3001

const server = createServer(async (req, res) => {
  if (req.url !== '/api/chat') {
    res.statusCode = 404
    return res.end('Not found — this test server only serves /api/chat')
  }

  let raw = ''
  for await (const chunk of req) raw += chunk
  try {
    req.body = raw ? JSON.parse(raw) : {}
  } catch {
    req.body = {}
  }

  // Minimal shim so api/chat.js's Vercel-style res.status().json() works
  // against Node's plain http.ServerResponse.
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(obj))
  }

  await handler(req, res)
})

server.listen(PORT, () => {
  console.log(`Local API test server ready at http://localhost:${PORT}`)
  console.log('Serves only /api/chat. Open http://localhost:5175 for the real app.')
})

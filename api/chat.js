// Vercel serverless function — chat with an AI about a plant, or a whole
// garden of them.
//
// The OpenAI key lives ONLY here (read from the server-side environment
// variable OPENAI_API_KEY) — it is never sent to the browser and never
// appears in any client-side bundle. The browser sends a context object
// (one plant's data — see PlantChat.jsx — or a whole garden's — see
// GardenChat.jsx) + the conversation so far; this function builds a
// grounded system prompt from that context and forwards the request to
// OpenAI. This function doesn't care which kind of context it's handed;
// buildSystemPrompt() branches on context.garden to build the right prompt.
//
// No auth yet (tracked as a known gap — fine for a personal, unlisted app;
// revisit once Firebase Auth exists so this endpoint isn't wide open).

const MODEL = 'gpt-4o-mini'
const MAX_HISTORY = 20     // cap how much conversation we forward per request
const MAX_TOKENS = 500

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set')
    return res.status(500).json({ error: 'Server is not configured with an OpenAI API key.' })
  }

  const { context, messages } = req.body ?? {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'A non-empty messages array is required.' })
  }

  const recent = messages.slice(-MAX_HISTORY)
  const systemPrompt = buildSystemPrompt(context)

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...recent],
        max_tokens: MAX_TOKENS,
      }),
    })

    if (!upstream.ok) {
      const detail = await upstream.text()
      console.error('OpenAI error', upstream.status, detail)
      return res.status(502).json({ error: 'The AI service returned an error.' })
    }

    const data = await upstream.json()
    const reply = data.choices?.[0]?.message?.content
    if (!reply) {
      return res.status(502).json({ error: 'The AI service returned an empty response.' })
    }
    return res.status(200).json({ reply })
  } catch (err) {
    console.error('Chat function failed', err)
    return res.status(500).json({ error: 'Something went wrong talking to the AI.' })
  }
}

const BASE_PROMPT = 'You are a helpful, concise plant care assistant inside the Plant Streaks app. Keep answers short and friendly. If the user asks something the provided data doesn\'t cover, say so rather than guessing.'

// Turns the context sent by the client into a plain-language system prompt,
// so answers are grounded in real data instead of generic plant advice.
// Branches on context.garden — see GardenChat.jsx (whole-garden context,
// one summary line per plant) vs. PlantChat.jsx (one plant's full data +
// history).
function buildSystemPrompt(context) {
  if (!context) return BASE_PROMPT
  return context.garden ? buildGardenPrompt(context) : buildPlantPrompt(context)
}

function buildPlantPrompt(plant) {
  const lines = [BASE_PROMPT, '', `The user is asking about their plant: "${plant.name || plant.species}" (${plant.species}).`]
  if (plant.health) lines.push(`Current health status: ${plant.health}.`)
  if (plant.moisture != null) {
    lines.push(`Most recent moisture reading: ${plant.moisture}/10${plant.moistureWhen ? ` (${plant.moistureWhen})` : ''}.`)
  }
  if (plant.idealRange) lines.push(`Ideal moisture range for this species: ${plant.idealRange[0]}–${plant.idealRange[1]} / 10.`)
  if (plant.wateringStyle) lines.push(`Watering style: ${plant.wateringStyle}.`)
  if (plant.lastWatered) lines.push(`Last watered: ${plant.lastWatered}.`)
  if (plant.recommendation) lines.push(`The app's own model currently estimates: ${plant.recommendation}.`)
  if (plant.recentHistory?.length) {
    lines.push('Full log history, newest first (use this for any question about past dates, not just recent status):')
    for (const line of plant.recentHistory) lines.push(`- ${line}`)
  }
  lines.push('', 'Answer using this real data when relevant.')
  return lines.join('\n')
}

// Garden-wide context is one current-status line per plant, not each
// plant's full history (see buildGardenContext in GardenChat.jsx for why) —
// good for "which plants need water" style questions, not "what happened
// to X last month" (that's what the per-plant chat is for).
function buildGardenPrompt(ctx) {
  const count = ctx.plantCount ?? ctx.plants?.length ?? 0
  const lines = [BASE_PROMPT, '', `The user is asking about their whole garden (${count} plant${count === 1 ? '' : 's'}). Current status for each:`]
  for (const p of ctx.plants ?? []) {
    const bits = [`"${p.name}" (${p.species})`]
    if (p.health) bits.push(`health: ${p.health}`)
    if (p.moisture != null) bits.push(`moisture: ${p.moisture}/10${p.moistureIsEstimate ? ' (estimated)' : ''}`)
    if (p.idealRange) bits.push(`ideal: ${p.idealRange[0]}–${p.idealRange[1]}`)
    if (p.status) bits.push(`status: ${p.status}`)
    lines.push(`- ${bits.join(', ')}`)
  }
  lines.push('', 'Answer using this real data. This is current status only, not full log history — if asked about a specific plant\'s past in detail, suggest they ask that plant\'s own chat instead.')
  return lines.join('\n')
}

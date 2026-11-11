import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

// Best-effort daily limit per user (resets when the function instance restarts).
const usage = new Map()
const LIMIT = 40

const schema = {
  type: 'object',
  properties: {
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          unit: { type: 'string', enum: ['g', 'ml', 'pc'] },
          qty: { type: 'number' },
          cost: { type: 'number' }
        },
        required: ['name', 'unit', 'qty', 'cost'],
        additionalProperties: false
      }
    }
  },
  required: ['ingredients'],
  additionalProperties: false
}

const groq = body =>
  fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.GROQ_MODEL, temperature: 0.3, ...body })
  })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  const { data } = await sb.auth.getUser(token)
  const user = data?.user
  if (!user) return res.status(401).json({ error: 'Please sign in' })

  const key = user.id + new Date().toISOString().slice(0, 10)
  const n = (usage.get(key) || 0) + 1
  if (n > LIMIT) return res.status(429).json({ error: 'Daily AI limit reached. Try again tomorrow.' })
  usage.set(key, n)

  const dish = String(req.body?.dish || '').trim().slice(0, 80)
  const category = String(req.body?.category || '').trim().slice(0, 40)
  const existing = Array.isArray(req.body?.existing) ? req.body.existing.slice(0, 80).map(x => String(x).slice(0, 60)) : []
  if (!dish) return res.status(400).json({ error: 'Dish name required' })

  const prompt =
    `List at most 12 ingredients for ONE portion of "${dish}"${category ? ` (category: ${category})` : ''} as made in a restaurant kitchen in Dubai, UAE. ` +
    `unit is g, ml or pc. qty is the amount per portion in that unit. cost is a typical wholesale price in AED per kg (g), per litre (ml) or per piece (pc). ` +
    `Use simple generic names such as "Chicken breast". ` +
    (existing.length ? `Reuse these existing names when they fit: ${existing.join(', ')}.` : '')
  const messages = [
    { role: 'system', content: 'You are a restaurant recipe-costing assistant. Reply with JSON only.' },
    { role: 'user', content: prompt }
  ]

  try {
    // Try schema-enforced output first; fall back to plain JSON mode if the chosen model doesn't support it.
    let r = await groq({ messages, response_format: { type: 'json_schema', json_schema: { name: 'ingredients', schema } } })
    if (!r.ok) {
      r = await groq({
        messages: [...messages, { role: 'user', content: 'Return {"ingredients":[{"name":string,"unit":"g"|"ml"|"pc","qty":number,"cost":number}]}.' }],
        response_format: { type: 'json_object' }
      })
    }
    if (!r.ok) throw new Error('Groq ' + r.status)
    const out = JSON.parse((await r.json()).choices[0].message.content)
    const ingredients = (out.ingredients || []).filter(x => x?.name && x.qty > 0 && ['g', 'ml', 'pc'].includes(x.unit)).slice(0, 12)
    return res.status(200).json({ ingredients })
  } catch (e) {
    return res.status(502).json({ error: 'The AI request failed. Check GROQ_API_KEY and GROQ_MODEL in Vercel.' })
  }
}

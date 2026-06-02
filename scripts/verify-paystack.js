import fs from 'fs'
import path from 'path'

const args = process.argv.slice(2)
if (args.length < 1) {
  console.error('Usage: node scripts/verify-paystack.js <PAYSTACK_REFERENCE>')
  process.exit(2)
}
const reference = args[0]

// Read .env.local in project root
const envPath = path.resolve(process.cwd(), '.env.local')
let env = {}
try {
  const raw = fs.readFileSync(envPath, 'utf8')
  raw.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (m) {
      let val = m[2]
      // strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      env[m[1]] = val
    }
  })
} catch (err) {
  console.error('Failed to read .env.local:', err.message)
  process.exit(1)
}

const key = env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY
if (!key) {
  console.error('PAYSTACK_SECRET_KEY not found in .env.local or environment')
  process.exit(1)
}

const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`

async function run() {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } })
    const text = await res.text()
    try {
      const json = JSON.parse(text)
      console.log(JSON.stringify(json, null, 2))
    } catch (e) {
      console.log('Non-JSON response:', text)
    }
  } catch (err) {
    console.error('Network error:', err.message)
    process.exit(1)
  }
}

run()

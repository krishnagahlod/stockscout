import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// The URL of your FastAPI backend (e.g. deployed on Railway)
const BACKEND_URL = Deno.env.get('FASTAPI_URL') || 'http://host.docker.internal:8000'
const API_SECRET = Deno.env.get('API_SECRET_KEY') || 'dev_shared_secret_key'

serve(async (req) => {
  try {
    console.log("Triggering stock data sync on backend...")
    
    // Call the FastAPI endpoint
    const response = await fetch(`${BACKEND_URL}/api/sync/trigger`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_SECRET}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      const err = await response.text()
      console.error(`Backend returned ${response.status}: ${err}`)
      return new Response(JSON.stringify({ error: `Backend sync failed: ${err}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const data = await response.json()
    console.log("Sync trigger successful:", data)
    
    return new Response(
      JSON.stringify(data),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("Failed to trigger sync:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

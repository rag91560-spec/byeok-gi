const TIMEOUT_MS = 600000
const BACKEND_API = process.env.GT_BACKEND_API
  ?? (process.env.NODE_ENV === "development" ? "http://localhost:8001/api" : "http://localhost:8000/api")

type RouteContext = {
  params: Promise<{ path: string[] }> | { path: string[] }
}

async function proxy(request: Request, context: RouteContext) {
  const { path } = await Promise.resolve(context.params)
  const sourceUrl = new URL(request.url)
  const backendPath = `${path.map(encodeURIComponent).join("/")}${sourceUrl.search}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const headers = new Headers(request.headers)
    headers.delete("host")
    headers.delete("content-length")

    const init: RequestInit = {
      method: request.method,
      headers,
      signal: controller.signal,
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.arrayBuffer()
    }

    const response = await fetch(`${BACKEND_API}/${backendPath}`, init)

    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete("content-encoding")
    responseHeaders.delete("content-length")

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backend request failed"
    return Response.json({ detail: message }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}

export function GET(request: Request, context: RouteContext) {
  return proxy(request, context)
}

export function POST(request: Request, context: RouteContext) {
  return proxy(request, context)
}

export function PUT(request: Request, context: RouteContext) {
  return proxy(request, context)
}

export function DELETE(request: Request, context: RouteContext) {
  return proxy(request, context)
}

export function PATCH(request: Request, context: RouteContext) {
  return proxy(request, context)
}

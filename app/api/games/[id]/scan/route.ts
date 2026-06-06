const BACKEND_PORT =
  process.env.GT_BACKEND_PORT
  ?? (process.env.NODE_ENV === "development" ? "8001" : "8000")
const BACKEND_API = process.env.GT_BACKEND_API ?? `http://localhost:${BACKEND_PORT}/api`

type RouteContext = {
  params: Promise<{ id: string }> | { id: string }
}

async function backendPost(path: string, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${BACKEND_API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    })
    const body = await response.arrayBuffer()
    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backend request failed"
    return Response.json({ detail: message }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await Promise.resolve(context.params)
  return backendPost(`/games/${encodeURIComponent(id)}/scan`, 600000)
}

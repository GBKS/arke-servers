// Minimal gRPC-Web client for unary calls, using fetch and protobufjs.
// gRPC-Web is used instead of native gRPC because some servers sit behind
// proxies that only pass gRPC-Web, and it keeps every server measured the
// same way.

import { fileURLToPath } from 'node:url'
import protobuf from 'protobufjs'

const PROTO_DIR = fileURLToPath(new URL('../../protos/', import.meta.url))

let rootPromise: Promise<protobuf.Root> | null = null

export function loadProtos(): Promise<protobuf.Root> {
  rootPromise ??= (async () => {
    const root = new protobuf.Root()
    root.resolvePath = (_origin, target) => PROTO_DIR + target.split('/').pop()
    await root.load(['bark_server.proto', 'health.proto'], { keepCase: false })
    return root
  })()
  return rootPromise
}

export class GrpcWebError extends Error {}

export interface Frames {
  messages: Uint8Array[]
  trailers: Record<string, string>
}

/** Splits a gRPC-Web response body into data frames and parsed trailers. */
export function parseFrames(buf: Uint8Array): Frames {
  const messages: Uint8Array[] = []
  const trailers: Record<string, string> = {}
  let i = 0
  while (i < buf.length) {
    if (i + 5 > buf.length) throw new GrpcWebError('truncated frame header')
    const flag = buf[i]!
    const len = new DataView(buf.buffer, buf.byteOffset + i + 1, 4).getUint32(0)
    if (i + 5 + len > buf.length) throw new GrpcWebError('truncated frame body')
    const body = buf.subarray(i + 5, i + 5 + len)
    i += 5 + len
    if (flag & 0x80) {
      for (const line of new TextDecoder().decode(body).split('\r\n')) {
        const idx = line.indexOf(':')
        if (idx > 0) trailers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim()
      }
    } else {
      messages.push(body)
    }
  }
  return { messages, trailers }
}

function frame(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + payload.length)
  new DataView(out.buffer).setUint32(1, payload.length)
  out.set(payload, 5)
  return out
}

function grpcError(status: string, message: string | null | undefined): GrpcWebError {
  const msg = message ? decodeURIComponent(message) : ''
  return new GrpcWebError(`grpc status ${status}${msg ? `: ${msg}` : ''}`)
}

export async function unary<T = Record<string, unknown>>(
  host: string,
  method: string,
  requestType: string,
  request: Record<string, unknown>,
  responseType: string,
  timeoutMs: number,
): Promise<T> {
  const root = await loadProtos()
  const ReqType = root.lookupType(requestType)
  const ResType = root.lookupType(responseType)
  const body = frame(ReqType.encode(ReqType.create(request)).finish())

  let res: Response
  try {
    res = await fetch(`https://${host}/${method}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/grpc-web+proto',
        'x-grpc-web': '1',
      },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    const e = err as Error
    if (e.name === 'TimeoutError') throw new GrpcWebError(`timeout after ${timeoutMs}ms`)
    const cause = (e.cause as { code?: string } | undefined)?.code
    throw new GrpcWebError(cause ? `network error (${cause})` : 'network error')
  }

  if (!res.ok) throw new GrpcWebError(`HTTP ${res.status}`)

  // Trailers-only responses put the status in headers.
  const headerStatus = res.headers.get('grpc-status')
  if (headerStatus && headerStatus !== '0') throw grpcError(headerStatus, res.headers.get('grpc-message'))

  const { messages, trailers } = parseFrames(new Uint8Array(await res.arrayBuffer()))
  const status = trailers['grpc-status'] ?? headerStatus
  if (status && status !== '0') throw grpcError(status, trailers['grpc-message'])
  if (messages.length === 0) throw new GrpcWebError('empty response')

  return ResType.toObject(ResType.decode(messages[0]!), {
    longs: String,
    enums: String,
    bytes: Array,
    defaults: true,
  }) as T
}

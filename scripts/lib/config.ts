import type { ServerConfig } from '../../shared/types/status'

const ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/
// Public DNS hostname only: no scheme, port, path, credentials, or IP literal.
const HOST_RE = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/

/**
 * Validates the curated server list. The probe only ever talks to
 * `https://<host>:443`, so the hostname is the only input that matters.
 */
export function parseServers(raw: unknown): ServerConfig[] {
  if (!Array.isArray(raw)) throw new Error('servers.json must be an array')
  const seen = new Set<string>()
  return raw.map((entry, i) => {
    const where = `servers.json[${i}]`
    if (!entry || typeof entry !== 'object') throw new Error(`${where}: must be an object`)
    const { id, name, host } = entry as Record<string, unknown>
    if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error(`${where}: invalid id`)
    if (typeof name !== 'string' || !name.trim()) throw new Error(`${where}: missing name`)
    if (typeof host !== 'string' || !HOST_RE.test(host)) throw new Error(`${where}: host must be a bare public hostname`)
    if (host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal')) {
      throw new Error(`${where}: host must be public`)
    }
    if (seen.has(id)) throw new Error(`${where}: duplicate id "${id}"`)
    seen.add(id)
    return { id, name: name.trim(), host }
  })
}

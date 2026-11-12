import config from '~~/servers.json'
import type { ServerConfig } from '~~/shared/types/status'

const byId = new Map((config as ServerConfig[]).map(s => [s.id, s]))

export const brandColor = (id: string) => byId.get(id)?.color ?? '#F6EDE1'
export const brandLogo = (id: string) => byId.get(id)?.logo ?? null

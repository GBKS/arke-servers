import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CheckRecord } from '../../shared/types/status'

export function monthKey(tSecs: number): string {
  return new Date(tSecs * 1000).toISOString().slice(0, 7) // YYYY-MM
}

/** Month keys covering [fromSecs, toSecs]. */
export function monthsBetween(fromSecs: number, toSecs: number): string[] {
  const out: string[] = []
  const d = new Date(fromSecs * 1000)
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  while (d.getTime() <= toSecs * 1000) {
    out.push(d.toISOString().slice(0, 7))
    d.setUTCMonth(d.getUTCMonth() + 1)
  }
  return out
}

export function parseLines(text: string): CheckRecord[] {
  const out: CheckRecord[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const r = JSON.parse(line)
      if (typeof r?.t === 'number' && typeof r?.id === 'string' && typeof r?.ok === 'boolean') out.push(r)
    } catch {
      // Skip a corrupt line rather than failing the whole run.
    }
  }
  return out
}

export async function readHistory(dir: string, fromSecs: number, toSecs: number): Promise<CheckRecord[]> {
  const all: CheckRecord[] = []
  for (const m of monthsBetween(fromSecs, toSecs)) {
    try {
      all.push(...parseLines(await readFile(join(dir, `${m}.jsonl`), 'utf8')))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }
  return all.filter(r => r.t >= fromSecs && r.t <= toSecs)
}

export async function appendHistory(dir: string, records: CheckRecord[]): Promise<void> {
  if (!records.length) return
  await mkdir(dir, { recursive: true })
  const byMonth = new Map<string, string>()
  for (const r of records) {
    const k = monthKey(r.t)
    byMonth.set(k, (byMonth.get(k) ?? '') + JSON.stringify(r) + '\n')
  }
  for (const [k, text] of byMonth) await appendFile(join(dir, `${k}.jsonl`), text)
}

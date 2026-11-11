import status from '../../data/status.json'

// Public, stable JSON of the current status. Prerendered at build time.
export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'application/json; charset=utf-8')
  return status
})

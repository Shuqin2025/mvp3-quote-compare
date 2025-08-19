// Very naive translator stub. Replace with real API.
export async function translate(input, lang='zh') {
  if (Array.isArray(input)) {
    return input // keep headers same in MVP (hook real translation here)
  }
  if (typeof input === 'string') {
    return input // return original text for MVP
  }
  return input
}

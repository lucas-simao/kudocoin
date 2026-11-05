// Plain values to Firestore's REST Value format and back.
// Whole numbers become integerValue, other numbers doubleValue; Date becomes timestampValue.

export type FsValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } }

export type Plain = null | boolean | number | string | Date | Plain[] | { [key: string]: Plain | undefined }

export function encode(value: Plain): FsValue {
  if (value === null) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  }
  if (typeof value === 'string') return { stringValue: value }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } }
  return { mapValue: { fields: encodeFields(value) } }
}

export function encodeFields(object: { [key: string]: Plain | undefined }): Record<string, FsValue> {
  const fields: Record<string, FsValue> = {}
  for (const [key, value] of Object.entries(object)) if (value !== undefined) fields[key] = encode(value)
  return fields
}

export function decode(value: FsValue): Plain {
  if ('nullValue' in value) return null
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('stringValue' in value) return value.stringValue
  if ('timestampValue' in value) return new Date(value.timestampValue)
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decode)
  return decodeFields(value.mapValue.fields ?? {})
}

export function decodeFields(fields: Record<string, FsValue>): { [key: string]: Plain } {
  const object: { [key: string]: Plain } = {}
  for (const [key, value] of Object.entries(fields)) object[key] = decode(value)
  return object
}

/** A field path segment, quoted with backticks unless it is a simple name (Firebase uids can start with a digit). */
export function fieldSegment(name: string): string {
  return /^[A-Za-z_][A-Za-z_0-9]*$/.test(name) ? name : `\`${name.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\``
}

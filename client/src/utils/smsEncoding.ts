// SMS encoding helpers for Notify.lk.
//
// A single SMS holds 160 characters when the whole message fits the GSM-7
// (7-bit) default alphabet, but only 70 characters when any character falls
// outside it (Sinhala, Tamil, emoji, etc. — sent as UCS-2/Unicode).
// A few GSM-7 characters live in an "extension table" and each occupies two
// GSM character slots.

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
const GSM7_EXT = "^{}\\[~]|€" // each counts as 2 GSM characters

export function isGsm7(text: string): boolean {
  return measureText(text).gsm
}

export interface SmsInfo {
  encoding: 'GSM-7' | 'Unicode'
  length: number
  singleMax: number
  overLimit: boolean
  // Billable SMS parts. A message longer than one SMS is split into parts of
  // 153 (GSM-7) or 67 (Unicode) characters, each charged as one SMS.
  parts: number
}

// The pieces of a text the SMS length depends on, so the length of a
// combination (template + name) can be worked out without re-scanning it.
export interface TextMeasure {
  gsm: boolean       // fits the GSM-7 alphabet
  gsmUnits: number   // length in GSM-7 slots (extension chars count 2)
  codePoints: number // length in Unicode code points (emoji count 1)
}

export function measureText(text: string): TextMeasure {
  let gsm = true
  let gsmUnits = 0
  let codePoints = 0
  for (const ch of text) {
    codePoints += 1
    if (GSM7_EXT.includes(ch)) gsmUnits += 2
    else if (GSM7_BASIC.includes(ch)) gsmUnits += 1
    else gsm = false
  }
  return { gsm, gsmUnits, codePoints }
}

// SMS length and parts for a measured text.
export function infoFromMeasure(m: TextMeasure): SmsInfo {
  const length = m.gsm ? m.gsmUnits : m.codePoints
  const singleMax = m.gsm ? 160 : 70
  const perPart = m.gsm ? 153 : 67
  return {
    encoding: m.gsm ? 'GSM-7' : 'Unicode',
    length,
    singleMax,
    overLimit: length > singleMax,
    parts: length === 0 ? 0 : length <= singleMax ? 1 : Math.ceil(length / perPart),
  }
}

export function smsInfo(text: string): SmsInfo {
  return infoFromMeasure(measureText(text))
}

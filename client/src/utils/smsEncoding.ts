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
  return [...text].every((ch) => GSM7_BASIC.includes(ch) || GSM7_EXT.includes(ch))
}

export interface SmsInfo {
  encoding: 'GSM-7' | 'Unicode'
  length: number
  singleMax: number
  overLimit: boolean
}

export function smsInfo(text: string): SmsInfo {
  const gsm = isGsm7(text)
  let length = 0
  if (gsm) {
    for (const ch of text) length += GSM7_EXT.includes(ch) ? 2 : 1
  } else {
    // Count Unicode code points (so emoji/surrogate pairs count as 1).
    length = [...text].length
  }
  const singleMax = gsm ? 160 : 70
  return {
    encoding: gsm ? 'GSM-7' : 'Unicode',
    length,
    singleMax,
    overLimit: length > singleMax,
  }
}

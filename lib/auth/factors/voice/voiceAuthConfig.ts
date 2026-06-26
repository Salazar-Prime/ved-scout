export function isVoiceAuthConfigured(): boolean {
  return Boolean(process.env.VOICE_AUTH_PASSPHRASE);
}

export function normalizePassphrase(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

export function passphrasesMatch(transcript: string, expected: string): boolean {
  return normalizePassphrase(transcript) === normalizePassphrase(expected);
}

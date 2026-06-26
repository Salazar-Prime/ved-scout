/**
 * Voice authentication stub.
 *
 * Currently always authenticates the user without any verification.
 * Future implementation will capture and verify a voice passphrase against
 * a stored voiceprint using the app's existing Whisper transcription pipeline.
 *
 * When implementing:
 * 1. Record a short audio clip via the MediaRecorder API.
 * 2. Send to the transcription endpoint (app/api/transcribe/route.ts).
 * 3. Compare the transcript (or a voice embedding) to a registered profile.
 * 4. Return authenticated: true only on a confident match.
 */
export const VOICE_AUTH_STUB_ALWAYS_AUTHENTICATED = true;

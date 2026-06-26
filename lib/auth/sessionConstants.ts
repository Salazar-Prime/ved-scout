export const SESSION_COOKIE_NAME = "vedScoutSession";
export const SESSION_MAX_AGE_SECONDS = 86400; // 24 hours

export const AUTH_FACTOR_IDS = {
  face: "face",
  voice: "voice",
} as const;

export type AuthFactorId = (typeof AUTH_FACTOR_IDS)[keyof typeof AUTH_FACTOR_IDS];

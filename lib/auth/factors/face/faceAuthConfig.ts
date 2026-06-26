export const faceAuthConfig = {
  domain: process.env.NEXT_PUBLIC_FACE_AUTH_DOMAIN ?? "",
  clientToken: process.env.NEXT_PUBLIC_FACE_AUTH_CLIENT_TOKEN ?? "",
};

export function isFaceAuthConfigured(): boolean {
  return Boolean(faceAuthConfig.domain && faceAuthConfig.clientToken);
}

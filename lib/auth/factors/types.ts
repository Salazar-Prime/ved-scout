export type AuthFactorStatus = "idle" | "pending" | "authenticated" | "error";

export interface AuthFactorState {
  status: AuthFactorStatus;
  errorMessage?: string;
}

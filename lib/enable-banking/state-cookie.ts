/** Shared between the "use server" actions file and the callback route —
 * a "use server" module can only export async functions, so this constant
 * can't live there. */
export const ENABLE_BANKING_STATE_COOKIE = "eb_auth_state";

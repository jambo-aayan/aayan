import "server-only";
import bcrypt from "bcryptjs";

/**
 * The shared app password is stored as a base64-encoded bcrypt hash
 * (APP_PASSWORD_HASH_B64). Base64 avoids "$" in the raw bcrypt hash being
 * mangled by env-var expansion (Next.js's .env loader interpolates "$word"
 * as a variable reference, corrupting hashes like "$2b$10$...").
 *
 * Generate one with:
 *   node -e "console.log(Buffer.from(require('bcryptjs').hashSync(process.argv[1], 10)).toString('base64'))" "your-password"
 */
export async function verifyPassword(candidate: string): Promise<boolean> {
  const encoded = process.env.APP_PASSWORD_HASH_B64;
  if (!encoded) {
    throw new Error("APP_PASSWORD_HASH_B64 is not set");
  }
  const hash = Buffer.from(encoded, "base64").toString("utf8");
  return bcrypt.compare(candidate, hash);
}

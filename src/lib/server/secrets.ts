import { SESSION_SECRET } from "$env/static/private"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

/**
 * AES-256-GCM encryption for user-provided secrets (e.g. Anthropic API keys) stored in MongoDB.
 * The key is derived from SESSION_SECRET, so rotating it makes stored secrets unreadable
 * and users will need to re-enter them.
 */
const key = createHash("sha256").update(`kenko:user-secrets:${SESSION_SECRET}`).digest()

export interface EncryptedSecret {
  iv: string
  tag: string
  ciphertext: string
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  }
}

/** Returns null if the secret can't be decrypted (e.g. SESSION_SECRET was rotated). */
export function decryptSecret(secret: EncryptedSecret): string | null {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(secret.iv, "base64"))
    decipher.setAuthTag(Buffer.from(secret.tag, "base64"))
    return Buffer.concat([decipher.update(Buffer.from(secret.ciphertext, "base64")), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}

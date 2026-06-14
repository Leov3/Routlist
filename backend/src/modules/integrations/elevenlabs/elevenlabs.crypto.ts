import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const IV_LENGTH = 12;
const ALGORITHM = 'aes-256-gcm';

function deriveKey(secret: string) {
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plainText: string, secret: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptSecret(
  encrypted: string,
  iv: string,
  authTag: string,
  secret: string,
) {
  const decipher = createDecipheriv(
    ALGORITHM,
    deriveKey(secret),
    Buffer.from(iv, 'base64'),
  );

  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function maskSecret(value?: string | null) {
  if (!value) {
    return null;
  }

  const suffix = value.slice(-4);
  return `••••${suffix}`;
}

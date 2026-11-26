import argon2 from 'argon2';

/**
 * Hash argon2 usado apenas para igualar o tempo de resposta quando o e-mail não
 * existe. Assim, "e-mail inexistente" e "senha errada" custam o mesmo.
 */
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$rC4YM6c+z4TXBxSC62beaQ$Xhh8i1IAciznskEobCY2aLkfu0k04JvbdraLz0AXt54';

export function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, plainPassword);
  } catch {
    return false;
  }
}

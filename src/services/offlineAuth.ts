/**
 * Generador de UUID offline y validador de jugadores No-Premium
 * Sigue el estándar exacto de Mojang / Java:
 * UUID.nameUUIDFromBytes(("OfflinePlayer:" + username).getBytes(StandardCharsets.UTF_8))
 */

// Implementación ligera de MD5 puro (RFC 1321) sin dependencias externas
function md5(input: string): Uint8Array {
  const utf8 = new TextEncoder().encode(input);
  const n = utf8.length;

  // Pre-processing: padding
  const totalLength = ((n + 8) >>> 6) + 1;
  const words = new Uint32Array(totalLength * 16);

  for (let i = 0; i < n; i++) {
    words[i >>> 2] |= utf8[i] << ((i % 4) * 8);
  }
  words[n >>> 2] |= 0x80 << ((n % 4) * 8);
  words[words.length - 2] = n * 8;

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  const k = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];

  const r = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  for (let i = 0; i < words.length; i += 16) {
    let A = a;
    let B = b;
    let C = c;
    let D = d;

    for (let j = 0; j < 64; j++) {
      let f = 0;
      let g = 0;
      if (j < 16) {
        f = (B & C) | (~B & D);
        g = j;
      } else if (j < 32) {
        f = (D & B) | (~D & C);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = B ^ C ^ D;
        g = (3 * j + 5) % 16;
      } else {
        f = C ^ (B | ~D);
        g = (7 * j) % 16;
      }

      const temp = D;
      D = C;
      C = B;
      const sum = (A + f + k[j] + words[i + g]) >>> 0;
      const rot = (sum << r[j]) | (sum >>> (32 - r[j]));
      B = (B + rot) >>> 0;
      A = temp;
    }

    a = (a + A) >>> 0;
    b = (b + B) >>> 0;
    c = (c + C) >>> 0;
    d = (d + D) >>> 0;
  }

  const result = new Uint8Array(16);
  const outWords = [a, b, c, d];
  for (let i = 0; i < 4; i++) {
    result[i * 4] = outWords[i] & 0xff;
    result[i * 4 + 1] = (outWords[i] >>> 8) & 0xff;
    result[i * 4 + 2] = (outWords[i] >>> 16) & 0xff;
    result[i * 4 + 3] = (outWords[i] >>> 24) & 0xff;
  }

  return result;
}

/**
 * Genera el UUID v3 RFC 4122 que Java/Mojang asigna a cuentas No-Premium (Offline)
 */
export function generateOfflineUuid(username: string): string {
  const hash = md5(`OfflinePlayer:${username.trim()}`);

  // Set version to 3 (UUIDv3) -> bytes[6] = (bytes[6] & 0x0f) | 0x30
  hash[6] = (hash[6] & 0x0f) | 0x30;
  // Set variant to IETF RFC 4122 -> bytes[8] = (bytes[8] & 0x3f) | 0x80
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(hash[i].toString(16).padStart(2, '0'));
  }

  // Formato: 8-4-4-4-12
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

/**
 * Valida si un nombre de usuario de Minecraft es sintácticamente válido
 */
export function validateMinecraftUsername(username: string): { valid: boolean; error?: string } {
  const clean = username.trim();
  if (clean.length < 3) {
    return { valid: false, error: 'El nombre debe tener al menos 3 caracteres.' };
  }
  if (clean.length > 16) {
    return { valid: false, error: 'El nombre no puede exceder 16 caracteres.' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
    return { valid: false, error: 'Solo se permiten letras, números y guiones bajos (_).' };
  }
  return { valid: true };
}

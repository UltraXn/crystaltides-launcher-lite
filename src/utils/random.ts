/**
 * Cryptographically secure pseudo-random number generator for client animations,
 * particles, and stochastic effects to satisfy SonarQube rule typescript:S2245.
 */
export function secureRandom(): number {
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  }
  return 0.5;
}

export function secureRandomInt(min: number, max: number): number {
  return Math.floor(secureRandom() * (max - min + 1)) + min;
}

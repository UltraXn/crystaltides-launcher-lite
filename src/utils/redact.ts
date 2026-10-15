/**
 * Redacts sensitive tokens, credentials, and parameters from log messages.
 * Replaces values of access_token, refresh_token, Token, RpsTicket, identityToken,
 * code=, --accessToken <val>, -Dcrystaltides.ipc.token=<val>, and JWTs (eyJ...) with [REDACTED].
 */

const SENSITIVE_KEYS = [
  'access_token',
  'refresh_token',
  'Token',
  'RpsTicket',
  'identityToken',
];

// Matches JSON fields: "key": "value" or 'key': 'value'
const JSON_KEYS_REGEX = new RegExp(
  `(["'])(${SENSITIVE_KEYS.join('|')})\\1\\s*:\\s*(["'])(?:(?!\\3).|\\\\.)*\\3`,
  'gi',
);

// Matches query string / urlencoded / key=value: key=value
const KV_KEYS_REGEX = new RegExp(
  `([?&"'\\s]|^)(${[...SENSITIVE_KEYS, 'code'].join('|')})=([^&"'\\s;,]+)`,
  'gi',
);

// Matches --accessToken <value>
const ACCESS_TOKEN_ARG_REGEX = /(--accessToken\s+)([^\s"']+)/gi;

// Matches -Dcrystaltides.ipc.token=<value>
const IPC_TOKEN_ARG_REGEX = /(-Dcrystaltides\.ipc\.token=)([^\s"']+)/gi;

// Matches JWTs: starts with eyJ and has 3 base64url segments separated by dots
const JWT_REGEX = /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g;

export const redact = (text: string): string => {
  if (typeof text !== 'string') {
    return text ? String(text) : '';
  }

  let result = text;

  // 1. Redact sensitive JSON fields
  result = result.replace(JSON_KEYS_REGEX, '$1$2$1: $3[REDACTED]$3');

  // 2. Redact query string / urlencoded / key=value pairs
  result = result.replace(KV_KEYS_REGEX, '$1$2=[REDACTED]');

  // 3. Redact CLI args: --accessToken <value>
  result = result.replace(ACCESS_TOKEN_ARG_REGEX, '$1[REDACTED]');

  // 4. Redact JVM args: -Dcrystaltides.ipc.token=<value>
  result = result.replace(IPC_TOKEN_ARG_REGEX, '$1[REDACTED]');

  // 5. Redact JWT tokens (any eyJ...)
  result = result.replace(JWT_REGEX, '[REDACTED]');

  return result;
};

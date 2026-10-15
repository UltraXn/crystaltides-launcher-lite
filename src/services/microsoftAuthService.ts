import { invoke } from '@tauri-apps/api/core';

export interface MicrosoftDeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message?: string;
}

export interface MicrosoftAuthResult {
  username: string;
  uuid: string;
  accessToken: string;
  refreshToken?: string;
}

interface OAuthDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message?: string;
  error?: string;
  error_description?: string;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface XblResponse {
  Token?: string;
  DisplayClaims?: {
    xui?: Array<{ uhs?: string }>;
  };
  error?: string;
  errorMessage?: string;
}

interface XstsResponse {
  Token?: string;
  XErr?: number | string;
  error?: string;
  errorMessage?: string;
}

interface McAuthResponse {
  access_token?: string;
  error?: string;
  errorMessage?: string;
}

const CLIENT_ID = '3974b918-cd84-4d60-8955-2ad65234d16b';
const SCOPE = 'XboxLive.SignIn XboxLive.offline_access';
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';

export class MicrosoftAuthError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'MicrosoftAuthError';
    this.code = code;
  }
}

export class ProxyHttpError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = 'ProxyHttpError';
    this.code = options?.code;
    this.status = options?.status;
  }
}

export const parseProxyHttpError = <T = Record<string, unknown>>(err: unknown): T => {
  // Manejo de errores con estructura de backend { code, message }
  if (err && typeof err === 'object') {
    if ('code' in err && 'message' in err) {
      const bErr = err as { code: string; message: string; data?: unknown };
      if (bErr.data && typeof bErr.data === 'object') {
        return bErr.data as T;
      }
      return { error: bErr.code, errorMessage: bErr.message } as unknown as T;
    }
    if ('error' in err || 'XErr' in err || 'errorMessage' in err) {
      return err as T;
    }
  }

  const msg = err instanceof Error ? err.message : String(err);
  const statusMatch = msg.match(/HTTP\s+(\d{3})/i);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : undefined;

  const jsonStart = msg.indexOf('{');
  const jsonEnd = msg.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(msg.slice(jsonStart, jsonEnd + 1));
      if (
        parsed &&
        typeof parsed === 'object' &&
        ('error' in parsed || 'XErr' in parsed || 'errorMessage' in parsed)
      ) {
        return parsed as T;
      }
    } catch {
      // Ignorar fallo de parseo JSON y re-lanzar error
    }
  }

  throw new ProxyHttpError(msg, { status });
};

type HttpProxyMethod = 'http_get' | 'http_post' | 'http_put' | 'http_delete';

interface ProxyRequestOptions {
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

const executeProxyRequest = async <T = Record<string, unknown>>(
  method: HttpProxyMethod,
  options: ProxyRequestOptions,
): Promise<T> => {
  let responseText: string;
  try {
    const args: Record<string, unknown> = {
      url: options.url,
      headers: options.headers ?? {},
    };
    if (options.body !== undefined) {
      args.body = options.body;
    }
    responseText = await invoke<string>(method, args);
  } catch (err) {
    return parseProxyHttpError<T>(err);
  }

  if (typeof responseText !== 'string' || responseText.trim().length === 0) {
    return {} as T;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new ProxyHttpError(
      `Respuesta del proxy no válida como JSON para ${options.url}: ${responseText.slice(0, 100)}`,
    );
  }
};

const proxyPost = <T = Record<string, unknown>>(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<T> => executeProxyRequest<T>('http_post', { url, headers, body });

const proxyGet = <T = Record<string, unknown>>(
  url: string,
  headers: Record<string, string>,
): Promise<T> => executeProxyRequest<T>('http_get', { url, headers });

const proxyPut = <T = Record<string, unknown>>(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<T> => executeProxyRequest<T>('http_put', { url, headers, body });

const proxyDelete = <T = Record<string, unknown>>(
  url: string,
  headers: Record<string, string>,
): Promise<T> => executeProxyRequest<T>('http_delete', { url, headers });

export const startMicrosoftOAuthFlow = async (): Promise<MicrosoftDeviceCode> => {
  const body = `client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPE)}`;
  const res = await proxyPost<OAuthDeviceCodeResponse>(
    'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode',
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  );
  if (res.error) throw new Error(res.error_description ?? res.error);
  return res;
};

export const requestDeviceCode = startMicrosoftOAuthFlow;

export const pollMicrosoftToken = async (
  deviceCode: string,
  interval: number,
  expiresIn: number,
  onStatus?: (msg: string) => void,
): Promise<MicrosoftAuthResult> => {
  const body = `client_id=${CLIENT_ID}&grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=${encodeURIComponent(deviceCode)}`;
  const deadline = Date.now() + expiresIn * 1000;
  // RFC 8628 §3.4: Default minimum interval is 5 seconds to prevent rate-limiting and IP bans
  let currentIntervalMs = Math.max(interval || 5, 5) * 1000;

  const pollStep = async (): Promise<MicrosoftAuthResult> => {
    if (Date.now() >= deadline) {
      throw new Error('Tiempo de espera agotado para la autenticación.');
    }

    onStatus?.('Esperando autorización en Microsoft...');
    await new Promise((resolve) => setTimeout(resolve, currentIntervalMs));

    const res = await proxyPost<OAuthTokenResponse>(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    );

    if (res.access_token) {
      onStatus?.('Autenticando con Xbox Live...');
      return completeMinecraftAuth(res.access_token, res.refresh_token, onStatus);
    }

    if (res.error) {
      if (res.error === 'authorization_pending') {
        return pollStep();
      }
      if (res.error === 'slow_down') {
        // RFC 8628 §3.5: interval MUST be increased by 5 seconds for all subsequent requests
        currentIntervalMs += 5000;
        return pollStep();
      }
      if (res.error === 'expired_token') {
        throw new Error('El código de verificación expiró. Inténtalo de nuevo.');
      }
      throw new Error(res.error_description ?? res.error);
    }

    return pollStep();
  };

  return pollStep();
};

export const refreshMicrosoftSession = async (
  refreshToken: string,
  onStatus?: (msg: string) => void,
): Promise<MicrosoftAuthResult> => {
  onStatus?.('Renovando token de Microsoft...');
  const body = `client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPE)}&grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`;

  const res = await proxyPost<OAuthTokenResponse>(
    'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  );

  if (res.error) {
    throw new MicrosoftAuthError(
      `Error al renovar token (${res.error}): ${res.error_description ?? res.error}`,
      res.error,
    );
  }

  onStatus?.('Autenticando con Xbox Live...');
  return completeMinecraftAuth(res.access_token, res.refresh_token ?? refreshToken, onStatus);
};

import { logFrontend } from './logger';

const debugLog = (msg: string) => {
  logFrontend('INFO', msg);
};

const debugLogError = (msg: string) => {
  logFrontend('ERROR', msg);
};

export const completeMinecraftAuth = async (
  msAccessToken: string,
  msRefreshToken?: string,
  onStatus?: (msg: string) => void,
): Promise<MicrosoftAuthResult> => {
  // 1. Xbox Live Authenticate
  onStatus?.('Autenticando con Xbox Live...');
  debugLog('[MS Auth] completeMinecraftAuth step 1: Xbox Live Authenticate...');
  const xblRes = await proxyPost<XblResponse>(
    'https://user.auth.xboxlive.com/user/authenticate',
    {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${msAccessToken}`,
      },
      RelyingParty: 'http://auth.xboxlive.com', // NOSONAR
      TokenType: 'JWT',
    }),
  );
  if (!xblRes.Token) {
    debugLogError(
      '[MS Auth] Step 1 failed: missing Token' + (xblRes.error ? ` (error: ${xblRes.error})` : ''),
    );
    throw new Error(
      `Error de Xbox Live: ${xblRes.errorMessage ?? xblRes.error ?? 'Token ausente'}`,
    );
  }
  debugLog('[MS Auth] Step 1 complete (Xbox Live)');

  const xblToken = xblRes.Token;
  const uhs = xblRes.DisplayClaims?.xui?.[0]?.uhs;
  if (!uhs) {
    debugLogError('[MS Auth] Step 1 failed, missing uhs claim');
    throw new Error('No se pudo obtener el claim de usuario de Xbox.');
  }

  // 2. XSTS Authorize
  onStatus?.('Obteniendo token de Minecraft...');
  debugLog('[MS Auth] completeMinecraftAuth step 2: XSTS Authorize...');
  const xstsRes = await proxyPost<XstsResponse>(
    'https://xsts.auth.xboxlive.com/xsts/authorize',
    {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    JSON.stringify({
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xblToken],
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    }),
  );

  if (xstsRes.XErr) {
    const errCode = xstsRes.XErr.toString();
    debugLogError('[MS Auth] Step 2 failed with XErr: ' + errCode);
    if (errCode === '2148916233')
      throw new Error('Esta cuenta no tiene comprado Minecraft Java Edition.');
    if (errCode === '2148916238') {
      throw new Error(
        'La cuenta Xbox necesita configuración adicional (perfil Xbox / edad). ' +
          'Entra en xbox.com, crea un gamertag e inténtalo de nuevo.',
      );
    }
    throw new Error(`Error de Xbox (XSTS): XErr=${errCode}`);
  }
  debugLog('[MS Auth] Step 2 complete (XSTS)');

  const xstsToken = xstsRes.Token;

  // 3. Login with Xbox
  debugLog('[MS Auth] completeMinecraftAuth step 3: Login with Xbox...');
  const mcRes = await proxyPost<McAuthResponse>(
    'https://api.minecraftservices.com/authentication/login_with_xbox',
    {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    JSON.stringify({
      identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
    }),
  );

  if (!mcRes.access_token) {
    debugLogError(
      '[MS Auth] Step 3 failed: missing Minecraft access token' +
        (mcRes.error ? ` (error: ${mcRes.error})` : ''),
    );
    throw new Error(
      `Error de inicio de sesión de Minecraft: ${mcRes.errorMessage ?? mcRes.error ?? 'Token ausente'}`,
    );
  }
  debugLog('[MS Auth] Step 3 complete (Minecraft Auth)');

  const mcAccessToken = mcRes.access_token;

  // 4. Get Minecraft Profile
  onStatus?.('Obteniendo perfil del jugador...');
  debugLog('[MS Auth] completeMinecraftAuth step 4: Get Minecraft Profile...');
  const profileRes = await proxyGet<MinecraftProfileRawResponse>(
    'https://api.minecraftservices.com/minecraft/profile',
    { Authorization: `Bearer ${mcAccessToken}` },
  );

  if (profileRes.error) {
    debugLogError('[MS Auth] Step 4 failed, error: ' + profileRes.error);
    if (profileRes.error === 'NOT_FOUND') {
      throw new Error(
        'Esta cuenta Microsoft no tiene comprado Minecraft Java Edition. ' +
          'Necesitas tener el juego en tu cuenta.',
      );
    }
    throw new Error(
      `Error al obtener perfil: ${profileRes.errorMessage ?? profileRes.error ?? 'Error desconocido'}`,
    );
  }
  debugLog(`[MS Auth] Step 4 complete (Profile: ${profileRes.name ?? 'OK'})`);

  const rawUuid = profileRes.id;
  if (typeof rawUuid !== 'string' || rawUuid.length < 32) {
    throw new Error(
      `ID de perfil de Minecraft inválido: se esperaba un string de al menos 32 caracteres pero se recibió "${String(rawUuid)}".`,
    );
  }
  const formattedUuid = `${rawUuid.substring(0, 8)}-${rawUuid.substring(8, 12)}-${rawUuid.substring(12, 16)}-${rawUuid.substring(16, 20)}-${rawUuid.substring(20, 32)}`;

  return {
    username: profileRes.name,
    uuid: formattedUuid,
    accessToken: mcAccessToken,
    refreshToken: msRefreshToken,
  };
};

export const loginMicrosoftRedirect = async (
  onStatus?: (msg: string) => void,
): Promise<MicrosoftAuthResult> => {
  onStatus?.('Abriendo ventana de inicio de sesión de Microsoft...');
  debugLog('[MS Auth] Opening native Microsoft login window with PKCE and state protection...');

  let codeVerifier: string | undefined;
  let codeChallenge: string | undefined;
  let state: string | undefined;

  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.subtle) {
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      codeVerifier = Array.from(randomBytes, (b) => b.toString(16).padStart(2, '0')).join('');

      const stateBytes = new Uint8Array(16);
      crypto.getRandomValues(stateBytes);
      state = Array.from(stateBytes, (b) => b.toString(16).padStart(2, '0')).join('');

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const base64 = btoa(String.fromCharCode(...hashArray));
      codeChallenge = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
  } catch (pkceErr) {
    debugLog(`[MS Auth] Fallback without PKCE: ${pkceErr}`);
  }

  // 1. Open child WebviewWindow in Rust, wait for user login, and intercept redirect_uri
  const code = await invoke<string>('open_microsoft_auth_window', {
    codeChallenge: codeChallenge ?? null,
    state: state ?? null,
  });
  debugLog('[MS Auth] Authorization code received from auth window');

  onStatus?.('Obteniendo tokens de Microsoft...');
  let tokenBody = `client_id=${CLIENT_ID}&grant_type=authorization_code&code=${encodeURIComponent(
    code,
  )}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPE)}`;

  if (codeVerifier) {
    tokenBody += `&code_verifier=${encodeURIComponent(codeVerifier)}`;
  }

  debugLog('[MS Auth] Fetching Microsoft tokens from OAuth endpoint...');
  const res = await proxyPost<OAuthTokenResponse>(
    'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    tokenBody,
  );
  debugLog('[MS Auth] Token endpoint response received');

  if (res.error) {
    debugLogError(
      '[MS Auth] Token endpoint returned error: ' + (res.error_description ?? res.error),
    );
    throw new Error(res.error_description ?? res.error);
  }

  onStatus?.('Autenticando con Xbox Live...');
  debugLog('[MS Auth] Completing Minecraft authentication steps...');
  const result = await completeMinecraftAuth(res.access_token, res.refresh_token, onStatus);
  debugLog(
    `[MS Auth] Authentication completed successfully for user: ${result.username} (${result.uuid})`,
  );
  return result;
};

export interface MinecraftCape {
  id: string;
  state: 'ACTIVE' | 'INACTIVE';
  url: string;
  alias: string;
}

export interface MinecraftProfileResponse {
  id: string;
  name: string;
  skins: Array<{
    id: string;
    state: 'ACTIVE' | 'INACTIVE';
    url: string;
    variant: 'CLASSIC' | 'SLIM';
  }>;
  capes: MinecraftCape[];
}

interface MinecraftProfileRawResponse extends MinecraftProfileResponse {
  error?: string;
  errorMessage?: string;
}

const parseMinecraftProfile = (profile: unknown): MinecraftProfileResponse => {
  let parsed = profile as MinecraftProfileResponse & { error?: string; errorMessage?: string };
  if (typeof profile === 'string') {
    try {
      parsed = JSON.parse(profile);
    } catch {
      throw new Error(`La respuesta del perfil de Minecraft no es un JSON válido: ${profile}`);
    }
  }

  if (parsed?.error || parsed?.errorMessage) {
    throw new Error(parsed.errorMessage ?? parsed.error);
  }

  if (parsed?.capes) {
    parsed.capes = parsed.capes.map((cape: MinecraftCape) => ({
      ...cape,
      url: cape.url ? cape.url.replace('http://', 'https://') : '',
    }));
  }
  return parsed;
};

export const fetchMinecraftProfile = async (
  accessToken: string,
): Promise<MinecraftProfileResponse> => {
  const profile = await proxyGet<MinecraftProfileRawResponse>(
    'https://api.minecraftservices.com/minecraft/profile',
    {
      Authorization: `Bearer ${accessToken}`,
    },
  );
  return parseMinecraftProfile(profile);
};

export const setActiveCape = async (accessToken: string, capeId: string): Promise<void> => {
  const res = await proxyPut<{ error?: string; errorMessage?: string }>(
    'https://api.minecraftservices.com/minecraft/profile/capes/active',
    {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    JSON.stringify({ capeId }),
  );
  if (res?.error) {
    throw new Error(res.errorMessage ?? res.error);
  }
};

export const hideCape = async (accessToken: string): Promise<void> => {
  const res = await proxyDelete<{ error?: string; errorMessage?: string }>(
    'https://api.minecraftservices.com/minecraft/profile/capes/active',
    {
      Authorization: `Bearer ${accessToken}`,
    },
  );
  if (res?.error) {
    throw new Error(res.errorMessage ?? res.error);
  }
};

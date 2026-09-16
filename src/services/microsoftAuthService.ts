import { invoke } from "@tauri-apps/api/core";

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

const CLIENT_ID = "3974b918-cd84-4d60-8955-2ad65234d16b";
const SCOPE = "XboxLive.SignIn XboxLive.offline_access";
const REDIRECT_URI = "https://login.live.com/oauth20_desktop.srf";

// Helper for POST requests through Rust proxy
const proxyPost = async <T = Record<string, unknown>>(url: string, headers: Record<string, string>, body: string): Promise<T> => {
  const responseText: string = await invoke("http_post", { url, headers, body });
  try {
    return JSON.parse(responseText) as T;
  } catch {
    return responseText as unknown as T;
  }
};

// Helper for GET requests through Rust proxy
const proxyGet = async <T = Record<string, unknown>>(url: string, headers: Record<string, string>): Promise<T> => {
  const responseText: string = await invoke("http_get", { url, headers });
  try {
    return JSON.parse(responseText) as T;
  } catch {
    return responseText as unknown as T;
  }
};

// Helper for PUT requests through Rust proxy
const proxyPut = async <T = Record<string, unknown>>(url: string, headers: Record<string, string>, body: string): Promise<T> => {
  const responseText: string = await invoke("http_put", { url, headers, body });
  try {
    return JSON.parse(responseText) as T;
  } catch {
    return responseText as unknown as T;
  }
};

// Helper for DELETE requests through Rust proxy
const proxyDelete = async <T = Record<string, unknown>>(url: string, headers: Record<string, string>): Promise<T> => {
  const responseText: string = await invoke("http_delete", { url, headers });
  try {
    return JSON.parse(responseText) as T;
  } catch {
    return responseText as unknown as T;
  }
};

export const startMicrosoftOAuthFlow = async (): Promise<MicrosoftDeviceCode> => {
  const body = `client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPE)}`;
  const res = await proxyPost<OAuthDeviceCodeResponse>(
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode",
    { "Content-Type": "application/x-www-form-urlencoded" },
    body
  );
  if (res.error) throw new Error(res.error_description || res.error);
  return res;
};

export const requestDeviceCode = startMicrosoftOAuthFlow;

export const pollMicrosoftToken = async (
  deviceCode: string,
  interval: number,
  expiresIn: number,
  onStatus?: (msg: string) => void
): Promise<MicrosoftAuthResult> => {
  const body = `client_id=${CLIENT_ID}&grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=${deviceCode}`;
  const deadline = Date.now() + expiresIn * 1000;
  const pollIntervalMs = interval * 1000;

  while (Date.now() < deadline) {
    onStatus?.("Esperando autorización en Microsoft...");
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const res = await proxyPost<OAuthTokenResponse>(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
      { "Content-Type": "application/x-www-form-urlencoded" },
      body
    );

    if (res.access_token) {
      onStatus?.("Autenticando con Xbox Live...");
      return completeMinecraftAuth(res.access_token, res.refresh_token, onStatus);
    }

    if (res.error) {
      if (res.error === "authorization_pending") continue;
      if (res.error === "slow_down") {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      if (res.error === "expired_token") {
        throw new Error("El código de verificación expiró. Inténtalo de nuevo.");
      }
      throw new Error(res.error_description || res.error);
    }
  }

  throw new Error("Tiempo de espera agotado para la autenticación.");
};

export const refreshMicrosoftSession = async (
  refreshToken: string,
  onStatus?: (msg: string) => void
): Promise<MicrosoftAuthResult> => {
  onStatus?.("Renovando token de Microsoft...");
  const body = `client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPE)}&grant_type=refresh_token&refresh_token=${refreshToken}`;
  
  const res = await proxyPost<OAuthTokenResponse>(
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    { "Content-Type": "application/x-www-form-urlencoded" },
    body
  );

  if (res.error) {
    throw new Error(`Error al renovar token: ${res.error_description || res.error}`);
  }

  onStatus?.("Autenticando con Xbox Live...");
  return completeMinecraftAuth(res.access_token, res.refresh_token || refreshToken, onStatus);
};

const debugLog = (msg: string) => {
  console.log(msg);
  invoke("log_frontend", { msg }).catch(() => {});
};

const debugLogError = (msg: string) => {
  console.error(msg);
  invoke("log_frontend", { msg: `[Error] ${msg}` }).catch(() => {});
};

export const completeMinecraftAuth = async (
  msAccessToken: string,
  msRefreshToken?: string,
  onStatus?: (msg: string) => void
): Promise<MicrosoftAuthResult> => {
  // 1. Xbox Live Authenticate
  onStatus?.("Autenticando con Xbox Live...");
  debugLog("[MS Auth] completeMinecraftAuth step 1: Xbox Live Authenticate...");
  const xblRes = await proxyPost<XblResponse>(
    "https://user.auth.xboxlive.com/user/authenticate",
    {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    JSON.stringify({
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${msAccessToken}`,
      },
      RelyingParty: "http:" + "//auth.xboxlive.com",
      TokenType: "JWT",
    })
  );
  debugLog("[MS Auth] Step 1 response: " + JSON.stringify(xblRes));

  if (!xblRes.Token) {
    debugLogError("[MS Auth] Step 1 failed, missing Token");
    throw new Error(`Error de Xbox Live: ${JSON.stringify(xblRes)}`);
  }

  const xblToken = xblRes.Token;
  const uhs = xblRes.DisplayClaims?.xui?.[0]?.uhs;
  if (!uhs) {
    debugLogError("[MS Auth] Step 1 failed, missing uhs claim");
    throw new Error("No se pudo obtener el claim de usuario de Xbox.");
  }

  // 2. XSTS Authorize
  onStatus?.("Obteniendo token de Minecraft...");
  debugLog("[MS Auth] completeMinecraftAuth step 2: XSTS Authorize...");
  const xstsRes = await proxyPost<XstsResponse>(
    "https://xsts.auth.xboxlive.com/xsts/authorize",
    {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    JSON.stringify({
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [xblToken],
      },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    })
  );
  debugLog("[MS Auth] Step 2 response: " + JSON.stringify(xstsRes));

  if (xstsRes.XErr) {
    const errCode = xstsRes.XErr.toString();
    debugLogError("[MS Auth] Step 2 failed with XErr: " + errCode);
    if (errCode === "2148916233") throw new Error("Esta cuenta no tiene comprado Minecraft Java Edition.");
    if (errCode === "2148916238") {
      throw new Error(
        "La cuenta Xbox necesita configuración adicional (perfil Xbox / edad). " +
        "Entra en xbox.com, crea un gamertag e inténtalo de nuevo."
      );
    }
    throw new Error(`Error de Xbox (XSTS): ${JSON.stringify(xstsRes)}`);
  }

  const xstsToken = xstsRes.Token;

  // 3. Login with Xbox
  debugLog("[MS Auth] completeMinecraftAuth step 3: Login with Xbox...");
  const mcRes = await proxyPost<McAuthResponse>(
    "https://api.minecraftservices.com/authentication/login_with_xbox",
    {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    JSON.stringify({
      identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
    })
  );
  debugLog("[MS Auth] Step 3 response: " + JSON.stringify(mcRes));

  if (!mcRes.access_token) {
    debugLogError("[MS Auth] Step 3 failed, missing Minecraft access token");
    throw new Error(`Error de inicio de sesión de Minecraft: ${JSON.stringify(mcRes)}`);
  }

  const mcAccessToken = mcRes.access_token;

  // 4. Get Minecraft Profile
  onStatus?.("Obteniendo perfil del jugador...");
  debugLog("[MS Auth] completeMinecraftAuth step 4: Get Minecraft Profile...");
  const profileRes = await proxyGet<MinecraftProfileRawResponse>(
    "https://api.minecraftservices.com/minecraft/profile",
    { Authorization: `Bearer ${mcAccessToken}` }
  );
  debugLog("[MS Auth] Step 4 response: " + JSON.stringify(profileRes));

  if (profileRes.error) {
    debugLogError("[MS Auth] Step 4 failed, error: " + profileRes.error);
    if (profileRes.error === "NOT_FOUND") {
      throw new Error(
        "Esta cuenta Microsoft no tiene comprado Minecraft Java Edition. " +
        "Necesitas tener el juego en tu cuenta."
      );
    }
    throw new Error(`Error al obtener perfil: ${profileRes.errorMessage || JSON.stringify(profileRes)}`);
  }

  const rawUuid = profileRes.id;
  const formattedUuid = `${rawUuid.substring(0, 8)}-${rawUuid.substring(8, 12)}-${rawUuid.substring(12, 16)}-${rawUuid.substring(16, 20)}-${rawUuid.substring(20, 32)}`;

  return {
    username: profileRes.name,
    uuid: formattedUuid,
    accessToken: mcAccessToken,
    refreshToken: msRefreshToken,
  };
};

export const loginMicrosoftRedirect = async (
  onStatus?: (msg: string) => void
): Promise<MicrosoftAuthResult> => {
  onStatus?.("Abriendo ventana de inicio de sesión de Microsoft...");
  debugLog("[MS Auth] Opening native Microsoft login window with official redirect URI...");

  // 1. Open child WebviewWindow in Rust, wait for user login, and intercept redirect_uri
  const code = await invoke<string>("open_microsoft_auth_window");
  debugLog("[MS Auth] Code received successfully from Rust auth window: " + code);

  onStatus?.("Obteniendo tokens de Microsoft...");
  const tokenBody = `client_id=${CLIENT_ID}&grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=${encodeURIComponent(SCOPE)}`;

  debugLog("[MS Auth] Fetching Microsoft tokens from OAuth endpoint...");
  const res = await proxyPost<OAuthTokenResponse>(
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    { "Content-Type": "application/x-www-form-urlencoded" },
    tokenBody
  );
  debugLog("[MS Auth] Token endpoint response received: " + JSON.stringify(res));

  if (res.error) {
    debugLogError("[MS Auth] Token endpoint returned error: " + (res.error_description || res.error));
    throw new Error(res.error_description || res.error);
  }

  onStatus?.("Autenticando con Xbox Live...");
  debugLog("[MS Auth] Completing Minecraft authentication steps...");
  const result = await completeMinecraftAuth(res.access_token, res.refresh_token, onStatus);
  debugLog("[MS Auth] Authentication completed successfully! Result: " + JSON.stringify(result));
  return result;
};

export interface MinecraftCape {
  id: string;
  state: "ACTIVE" | "INACTIVE";
  url: string;
  alias: string;
}

export interface MinecraftProfileResponse {
  id: string;
  name: string;
  skins: Array<{
    id: string;
    state: "ACTIVE" | "INACTIVE";
    url: string;
    variant: "CLASSIC" | "SLIM";
  }>;
  capes: MinecraftCape[];
}

interface MinecraftProfileRawResponse extends MinecraftProfileResponse {
  error?: string;
  errorMessage?: string;
}

const parseMinecraftProfile = (profile: unknown): MinecraftProfileResponse => {
  let parsed = profile as (MinecraftProfileResponse & { error?: string; errorMessage?: string });
  if (typeof profile === "string") {
    try {
      parsed = JSON.parse(profile);
    } catch {
      throw new Error(`La respuesta del perfil de Minecraft no es un JSON válido: ${profile}`);
    }
  }

  if (parsed?.error || parsed?.errorMessage) {
    throw new Error(parsed.errorMessage || parsed.error);
  }

  if (parsed?.capes) {
    parsed.capes = parsed.capes.map((cape: MinecraftCape) => ({
      ...cape,
      url: cape.url ? cape.url.replace("http://", "https://") : "",
    }));
  }
  return parsed;
};

export const fetchMinecraftProfile = async (accessToken: string): Promise<MinecraftProfileResponse> => {
  const profile = await proxyGet<MinecraftProfileRawResponse>("https://api.minecraftservices.com/minecraft/profile", {
    Authorization: `Bearer ${accessToken}`,
  });
  return parseMinecraftProfile(profile);
};

export const setActiveCape = async (accessToken: string, capeId: string): Promise<void> => {
  const res = await proxyPut<{ error?: string; errorMessage?: string }>(
    "https://api.minecraftservices.com/minecraft/profile/capes/active",
    {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    JSON.stringify({ capeId })
  );
  if (res?.error) {
    throw new Error(res.errorMessage || res.error);
  }
};

export const hideCape = async (accessToken: string): Promise<void> => {
  const res = await proxyDelete<{ error?: string; errorMessage?: string }>(
    "https://api.minecraftservices.com/minecraft/profile/capes/active",
    {
      Authorization: `Bearer ${accessToken}`,
    }
  );
  if (res?.error) {
    throw new Error(res.errorMessage || res.error);
  }
};

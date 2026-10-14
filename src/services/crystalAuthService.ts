/**
 * CrystalTides SMP - Web Account Authentication Service
 * Conecta directamente con la API REST y autenticación de Supabase de crystaltidessmp.net
 * Sin dependencias pesadas adicionales (usa fetch nativo).
 */

import { generateOfflineUuid } from './offlineAuth';
import { decodeProtectedHeader, decodeJwt } from 'jose';

const SUPABASE_URL = 'https://gyoqnqvqhuxlcbrvtfia.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b3FucXZxaHV4bGNicnZ0ZmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTk0MTEsImV4cCI6MjA4MDg3NTQxMX0.eLU_-IrRfixx7dpR9jeiEoOT1u-exQMhIsxSXVINbRA';

export interface CrystalAuthProfile {
  id: string;
  username: string;
  uuid: string;
  role: string;
  email: string;
  skinUrl?: string;
  accessToken: string;
  refreshToken: string;
}

function validateLoginInputs(email: string, password: string): void {
  if (!email?.includes('@')) {
    throw new Error(
      'Por favor introduce un correo electrónico válido registrado en crystaltidessmp.net.',
    );
  }
  if (!password) {
    throw new Error('Por favor introduce tu contraseña.');
  }
}

function getRawErrorMessage(data: Record<string, unknown>): string {
  if (typeof data.error_description === 'string') {
    return data.error_description;
  }
  if (typeof data.msg === 'string') {
    return data.msg;
  }
  if (typeof data.message === 'string') {
    return data.message;
  }
  return '';
}

function parseAuthErrorMessage(data: Record<string, unknown>, status: number): string {
  const errorMsg = getRawErrorMessage(data);

  if (errorMsg.includes('Invalid login credentials')) {
    return 'Correo o contraseña incorrectos. Verifica tus datos de acceso en crystaltidessmp.net.';
  }
  if (errorMsg.includes('Email not confirmed')) {
    return 'Debes confirmar tu correo electrónico en crystaltidessmp.net antes de ingresar.';
  }
  if (status === 429) {
    return 'Demasiados intentos fallidos. Por favor espera unos momentos antes de reintentar.';
  }
  return errorMsg || 'Error al autenticar con la cuenta de CrystalTides.';
}

async function fetchUserProfile(
  userId: string,
  accessToken: string,
): Promise<Record<string, unknown> | null> {
  // Defensive architecture: Ensure the query strictly enforces RLS and identity matching
  // The query string includes id=eq.userId, but we must verify that accessToken belongs to userId to prevent IDOR/BOLA.
  // Since we already check payload.sub === userId in loginWithCrystalTides, this acts as an extra layer
  // of access control inside the fetch itself if it is exported or used elsewhere.
  try {
    if (accessToken) {
      const payload = decodeJwt(accessToken);
      if (payload.sub !== userId) {
        throw new Error('Violación de seguridad: intento de consultar un perfil que no pertenece a la sesión activa.');
      }
    }

    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    if (profileRes.ok) {
      const rows = await profileRes.json();
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0] as Record<string, unknown>;
      }
    }
  } catch (pErr) {
    console.warn('[CrystalAuth] Error al obtener datos de perfil:', pErr);
  }
  return null;
}

function extractUsername(
  profileData: Record<string, unknown> | null,
  userMetadata: Record<string, unknown> | undefined,
  email: string,
): string {
  const raw =
    (typeof profileData?.username === 'string' && profileData.username) ||
    (typeof userMetadata?.username === 'string' && userMetadata.username) ||
    email.split('@')[0];
  const cleaned = raw.trim().replace(/\W/g, '_').slice(0, 16);
  return cleaned.length < 3 ? cleaned.padEnd(3, '_') : cleaned;
}

function extractMinecraftUuid(
  profileData: Record<string, unknown> | null,
  userMetadata: Record<string, unknown> | undefined,
): string | null {
  if (typeof profileData?.minecraft_uuid === 'string' && profileData.minecraft_uuid) {
    return profileData.minecraft_uuid;
  }
  if (typeof userMetadata?.minecraft_uuid === 'string' && userMetadata.minecraft_uuid) {
    return userMetadata.minecraft_uuid;
  }
  return null;
}

function extractAvatarUrl(
  profileData: Record<string, unknown> | null,
  userMetadata: Record<string, unknown> | undefined,
  rawMinecraftUuid: string | null,
): string | undefined {
  return (
    (typeof profileData?.avatar_url === 'string' && profileData.avatar_url) ||
    (typeof profileData?.social_avatar_url === 'string' && profileData.social_avatar_url) ||
    (typeof userMetadata?.avatar_url === 'string' && userMetadata.avatar_url) ||
    (rawMinecraftUuid ? `https://mc-heads.net/avatar/${rawMinecraftUuid}/48` : undefined)
  );
}

function extractRole(
  profileData: Record<string, unknown> | null,
  userMetadata: Record<string, unknown> | undefined,
): string {
  return (
    (typeof profileData?.role === 'string' && profileData.role) ||
    (typeof userMetadata?.role === 'string' && userMetadata.role) ||
    'user'
  );
}

export async function loginWithCrystalTides(
  emailInput: string,
  passwordInput: string,
): Promise<CrystalAuthProfile> {
  const email = emailInput.trim();
  const password = passwordInput;
  validateLoginInputs(email, password);

  const tokenUrl = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;

  let response: Response;
  try {
    response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });
  } catch (netErr: unknown) {
    console.error('[CrystalAuth] Network error:', netErr);
    throw new Error(
      'No se pudo conectar con el servidor de CrystalTidesSMP. Revisa tu conexión a internet.',
    );
  }

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(parseAuthErrorMessage(errorData, response.status));
  }

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  const user = data.user as { id?: string; user_metadata?: Record<string, unknown> } | undefined;
  const accessToken = typeof data.access_token === 'string' ? data.access_token : '';
  const refreshToken = typeof data.refresh_token === 'string' ? data.refresh_token : '';

  if (!user?.id) {
    throw new Error('Respuesta inválida del servidor de autenticación.');
  }

  if (accessToken) {
    try {
      const header = decodeProtectedHeader(accessToken);
      if (header.alg !== 'HS256' && header.alg !== 'RS256') {
        throw new Error('Algoritmo de token JWT no seguro o no soportado.');
      }

      const payload = decodeJwt(accessToken);

      if (payload.exp && Date.now() >= payload.exp * 1000) {
        throw new Error('La sesión ha expirado.');
      }

      if (payload.sub !== user.id) {
        throw new Error('Violación de seguridad: El token no pertenece al usuario autenticado.');
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Violación')) {
        throw e;
      }
      if (e instanceof Error && e.message.includes('Algoritmo')) {
        throw e;
      }
      if (e instanceof Error && e.message.includes('expirado')) {
        throw e;
      }
      throw new Error('Token de sesión inválido o corrupto.');
    }
  }

  const profileData = await fetchUserProfile(user.id, accessToken);
  const cleanUsername = extractUsername(profileData, user.user_metadata, email);
  const rawMinecraftUuid = extractMinecraftUuid(profileData, user.user_metadata);
  const resolvedUuid = rawMinecraftUuid ?? generateOfflineUuid(cleanUsername);
  const rawAvatarUrl = extractAvatarUrl(profileData, user.user_metadata, rawMinecraftUuid);
  const role = extractRole(profileData, user.user_metadata);

  return {
    id: `crystal_${user.id}`,
    username: cleanUsername,
    uuid: resolvedUuid,
    role,
    email,
    skinUrl: rawAvatarUrl,
    accessToken,
    refreshToken,
  };
}

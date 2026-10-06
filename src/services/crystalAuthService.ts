/**
 * CrystalTides SMP - Web Account Authentication Service
 * Conecta directamente con la API REST y autenticación de Supabase de crystaltidessmp.net
 * Sin dependencias pesadas adicionales (usa fetch nativo).
 */

import { generateOfflineUuid } from './offlineAuth';

const SUPABASE_URL = 'https://gyoqnqvqhuxlcbrvtfia.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b3FucXZxaHV4bGNicnZ0ZmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1Mjk5NDEsImV4cCI6MjA4MDg3NTQxMX0.eLU_-IrRfixx7dpR9jeiEoOT1u-exQMhIsxSXVINbRA';

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

export async function loginWithCrystalTides(
  emailInput: string,
  passwordInput: string,
): Promise<CrystalAuthProfile> {
  const email = emailInput.trim();
  const password = passwordInput;

  if (!email || !email.includes('@')) {
    throw new Error('Por favor introduce un correo electrónico válido registrado en crystaltidessmp.net.');
  }

  if (!password) {
    throw new Error('Por favor introduce tu contraseña.');
  }

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
    throw new Error('No se pudo conectar con el servidor de CrystalTidesSMP. Revisa tu conexión a internet.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      typeof data?.error_description === 'string'
        ? data.error_description
        : typeof data?.msg === 'string'
        ? data.msg
        : typeof data?.message === 'string'
        ? data.message
        : '';

    if (errorMsg.includes('Invalid login credentials')) {
      throw new Error('Correo o contraseña incorrectos. Verifica tus datos de acceso en crystaltidessmp.net.');
    }
    if (errorMsg.includes('Email not confirmed')) {
      throw new Error('Debes confirmar tu correo electrónico en crystaltidessmp.net antes de ingresar.');
    }
    if (response.status === 429) {
      throw new Error('Demasiados intentos fallidos. Por favor espera unos momentos antes de reintentar.');
    }
    throw new Error(errorMsg || 'Error al autenticar con la cuenta de CrystalTides.');
  }

  const user = data.user;
  const accessToken = data.access_token || '';
  const refreshToken = data.refresh_token || '';

  if (!user || !user.id) {
    throw new Error('Respuesta inválida del servidor de autenticación.');
  }

  // Consultar perfil de la tabla profiles si existe
  let profileData: Record<string, unknown> | null = null;
  try {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=*`,
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
        profileData = rows[0] as Record<string, unknown>;
      }
    }
  } catch (pErr) {
    console.warn('[CrystalAuth] Error al obtener datos de perfil:', pErr);
  }

  const rawUsername =
    (typeof profileData?.username === 'string' && profileData.username) ||
    (typeof user.user_metadata?.username === 'string' && user.user_metadata.username) ||
    email.split('@')[0];

  const cleanUsername = rawUsername.trim().replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 16);

  const rawMinecraftUuid =
    typeof profileData?.minecraft_uuid === 'string' && profileData.minecraft_uuid
      ? profileData.minecraft_uuid
      : typeof user.user_metadata?.minecraft_uuid === 'string' && user.user_metadata.minecraft_uuid
      ? user.user_metadata.minecraft_uuid
      : null;

  const resolvedUuid = rawMinecraftUuid || generateOfflineUuid(cleanUsername);

  const rawAvatarUrl =
    (typeof profileData?.avatar_url === 'string' && profileData.avatar_url) ||
    (typeof profileData?.social_avatar_url === 'string' && profileData.social_avatar_url) ||
    (typeof user.user_metadata?.avatar_url === 'string' && user.user_metadata.avatar_url) ||
    (rawMinecraftUuid ? `https://mc-heads.net/avatar/${rawMinecraftUuid}/48` : undefined);

  const role =
    (typeof profileData?.role === 'string' && profileData.role) ||
    (typeof user.user_metadata?.role === 'string' && user.user_metadata.role) ||
    'user';

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

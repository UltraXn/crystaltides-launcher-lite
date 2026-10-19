/**
 * CrystalTides SMP - Configuración de Supabase para Launcher Lite.
 *
 * En producción y desarrollo se configuran mediante variables de entorno (VITE_*).
 * En caso de no existir .env.local, utiliza placeholders de demostración solo en desarrollo (DEV).
 * En producción, si faltan las variables requeridas, marca isConfigured: false sin arrojar excepciones
 * al cargar el módulo para permitir que la interfaz muestre una pantalla de error adecuada.
 */

export interface SupabaseConfigResult {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export const getSupabaseConfig = (env: {
  DEV?: boolean;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}): SupabaseConfigResult => {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

  if (url && anonKey) {
    return { url, anonKey, isConfigured: true };
  }

  if (env.DEV) {
    return {
      url: url || 'https://demo-project.supabase.co',
      anonKey: anonKey || 'demo-anon-key',
      isConfigured: true,
    };
  }

  return {
    url: url ?? '',
    anonKey: anonKey ?? '',
    isConfigured: false,
  };
};

const activeConfig = getSupabaseConfig(import.meta.env);

export const SUPABASE_URL: string = activeConfig.url;
export const SUPABASE_ANON_KEY: string = activeConfig.anonKey;
export const IS_SUPABASE_CONFIGURED: boolean = activeConfig.isConfigured;

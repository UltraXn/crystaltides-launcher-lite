/**
 * CrystalTides SMP - Configuración de Supabase para Launcher Lite.
 *
 * En producción y desarrollo se configuran mediante variables de entorno (VITE_*).
 * En caso de no existir .env.local, utiliza placeholders de demostración seguros para el portafolio.
 */

export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL || 'https://demo-project.supabase.co';

export const SUPABASE_ANON_KEY: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-anon-key';

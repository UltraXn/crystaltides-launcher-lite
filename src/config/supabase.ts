/**
 * CrystalTides SMP - Configuración Centralizada de Supabase para Launcher Lite.
 * 
 * Permite sobreescribir la URL y la Anon Key vía variables de entorno VITE_*
 * con fallback por defecto al backend oficial de CrystalTides en producción.
 */

export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL || 'https://gyoqnqvqhuxlcbrvtfia.supabase.co';

export const SUPABASE_ANON_KEY: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5b3FucXZxaHV4bGNicnZ0ZmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTk0MTEsImV4cCI6MjA4MDg3NTQxMX0.eLU_-IrRfixx7dpR9jeiEoOT1u-exQMhIsxSXVINbRA';

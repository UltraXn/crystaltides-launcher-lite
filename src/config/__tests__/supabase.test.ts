import { describe, it, expect } from 'vitest';
import { getSupabaseConfig } from '../supabase';

describe('Supabase Configuration', () => {
  it('uses configured variables when both are provided', () => {
    const config = getSupabaseConfig({
      DEV: false,
      VITE_SUPABASE_URL: 'https://custom-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'custom-secret-key-123',
    });

    expect(config.url).toBe('https://custom-project.supabase.co');
    expect(config.anonKey).toBe('custom-secret-key-123');
    expect(config.isConfigured).toBe(true);
  });

  it('falls back to demo placeholders in development mode (DEV: true)', () => {
    const config = getSupabaseConfig({
      DEV: true,
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    });

    expect(config.url).toBe('https://demo-project.supabase.co');
    expect(config.anonKey).toBe('demo-anon-key');
    expect(config.isConfigured).toBe(true);
  });

  it('does not throw and returns isConfigured: false in production mode when variables are missing', () => {
    const config = getSupabaseConfig({
      DEV: false,
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    });

    expect(config.url).toBe('');
    expect(config.anonKey).toBe('');
    expect(config.isConfigured).toBe(false);
  });

  it('does not throw and returns isConfigured: false in production if only one variable is provided', () => {
    const config = getSupabaseConfig({
      DEV: false,
      VITE_SUPABASE_URL: 'https://partial.supabase.co',
      VITE_SUPABASE_ANON_KEY: '',
    });

    expect(config.url).toBe('https://partial.supabase.co');
    expect(config.anonKey).toBe('');
    expect(config.isConfigured).toBe(false);
  });
});

import { invoke } from '@tauri-apps/api/core';

export interface ProfileRecord {
  id: string;
  name: string;
  mc_version: string;
  loader_type: string;
  loader_version?: string;
  min_ram: number;
  max_ram: number;
  jvm_args?: string;
  game_dir?: string;
  resolution_width?: number;
  resolution_height?: number;
  fullscreen?: boolean;
  pre_launch_command?: string;
  wrapper_command?: string;
  post_exit_command?: string;
  environment_variables?: string;
  created_at: number;
  updated_at: number;
}

export interface AccountRecord {
  id: string;
  username: string;
  uuid: string;
  account_type: string;
  access_token?: string;
  skin_url?: string;
  is_active: boolean;
  created_at: number;
}

/**
 * Consulta la lista de perfiles almacenados en la base de datos local SQLite (crystaltides.db).
 */
export const getDatabaseProfiles = async (): Promise<ProfileRecord[]> => {
  try {
    return await invoke<ProfileRecord[]>('db_get_profiles');
  } catch (err) {
    console.warn('[DbService] Error obteniendo perfiles de SQLite:', err);
    return [];
  }
};

/**
 * Guarda o actualiza un perfil en SQLite con transacciones atómicas.
 */
export const saveDatabaseProfile = async (profile: ProfileRecord): Promise<void> => {
  try {
    await invoke('db_save_profile', { profile });
  } catch (err) {
    console.error('[DbService] Error guardando perfil en SQLite:', err);
    throw err;
  }
};

/**
 * Elimina un perfil de SQLite por su ID.
 */
export const deleteDatabaseProfile = async (id: string): Promise<void> => {
  try {
    await invoke('db_delete_profile', { id });
  } catch (err) {
    console.error('[DbService] Error eliminando perfil de SQLite:', err);
    throw err;
  }
};

/**
 * Obtiene todas las cuentas guardadas en SQLite.
 */
export const getDatabaseAccounts = async (): Promise<AccountRecord[]> => {
  try {
    return await invoke<AccountRecord[]>('db_get_accounts');
  } catch (err) {
    console.warn('[DbService] Error obteniendo cuentas de SQLite:', err);
    return [];
  }
};

/**
 * Guarda o actualiza una cuenta en SQLite.
 */
export const saveDatabaseAccount = async (account: AccountRecord): Promise<void> => {
  try {
    await invoke('db_save_account', { account });
  } catch (err) {
    console.error('[DbService] Error guardando cuenta en SQLite:', err);
    throw err;
  }
};

/**
 * Elimina una cuenta de SQLite.
 */
export const deleteDatabaseAccount = async (id: string): Promise<void> => {
  try {
    await invoke('db_delete_account', { id });
  } catch (err) {
    console.error('[DbService] Error eliminando cuenta en SQLite:', err);
    throw err;
  }
};

/**
 * Establece la cuenta activa en SQLite desactivando las demás.
 */
export const setActiveDatabaseAccount = async (id: string): Promise<void> => {
  try {
    await invoke('db_set_active_account', { id });
  } catch (err) {
    console.error('[DbService] Error marcando cuenta activa en SQLite:', err);
    throw err;
  }
};

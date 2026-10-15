use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProfileRecord {
    pub id: String,
    pub name: String,
    pub mc_version: String,
    pub loader_type: String,
    pub loader_version: Option<String>,
    pub min_ram: i64,
    pub max_ram: i64,
    pub jvm_args: Option<String>,
    pub game_dir: Option<String>,
    pub resolution_width: Option<i64>,
    pub resolution_height: Option<i64>,
    pub fullscreen: Option<bool>,
    pub pre_launch_command: Option<String>,
    pub wrapper_command: Option<String>,
    pub post_exit_command: Option<String>,
    pub environment_variables: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AccountRecord {
    pub id: String,
    pub username: String,
    pub uuid: String,
    pub account_type: String,
    pub access_token: Option<String>,
    pub skin_url: Option<String>,
    pub is_active: bool,
    pub created_at: i64,
}

static DB_CONN: OnceLock<Mutex<Connection>> = OnceLock::new();

fn get_db_path() -> PathBuf {
    if let Some(custom) = std::env::var_os("CRYSTALTIDES_HOME") {
        let base_dir = PathBuf::from(custom);
        let _ = fs::create_dir_all(&base_dir);
        return base_dir.join("crystaltides.db");
    }
    let base_dir = dirs::home_dir()
        .map(|h| h.join(".crystaltides"))
        .unwrap_or_else(|| PathBuf::from(".crystaltides"));
    let _ = fs::create_dir_all(&base_dir);
    base_dir.join("crystaltides.db")
}

pub fn lock_or_recover<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|e| {
        crate::logger::log(
            "WARN",
            "DB",
            &format!("Mutex envenenado, recuperando lock... {}", e),
        );
        e.into_inner()
    })
}

pub fn init_db(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA busy_timeout = 5000;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;",
    )
    .map_err(|e| {
        format!(
            "Error configurando pragmas SQLite (WAL / busy_timeout): {}",
            e
        )
    })?;

    let version: i32 = conn
        .query_row("PRAGMA user_version;", [], |row| row.get(0))
        .unwrap_or(0);

    if version < 1 {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                mc_version TEXT NOT NULL,
                loader_type TEXT NOT NULL,
                loader_version TEXT,
                min_ram INTEGER DEFAULT 1024,
                max_ram INTEGER DEFAULT 4096,
                jvm_args TEXT,
                game_dir TEXT,
                resolution_width INTEGER,
                resolution_height INTEGER,
                fullscreen INTEGER DEFAULT 0,
                pre_launch_command TEXT,
                wrapper_command TEXT,
                post_exit_command TEXT,
                environment_variables TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                uuid TEXT NOT NULL,
                account_type TEXT NOT NULL,
                access_token TEXT,
                skin_url TEXT,
                is_active INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS game_cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            PRAGMA user_version = 1;",
        )
        .map_err(|e| format!("Error ejecutando migraciones DDL v1: {}", e))?;
    }

    Ok(())
}

#[allow(dead_code)]
pub struct DbState(pub &'static Mutex<Connection>);

#[allow(dead_code)]
impl DbState {
    pub fn connection(&self) -> &'static Mutex<Connection> {
        self.0
    }
}

pub fn init_managed_db() -> Result<DbState, String> {
    let conn = get_connection()?;
    Ok(DbState(conn))
}

pub fn get_connection() -> Result<&'static Mutex<Connection>, String> {
    if let Some(conn) = DB_CONN.get() {
        return Ok(conn);
    }

    let db_path = get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| {
        format!(
            "Error abriendo base de datos SQLite en {:?}: {}",
            db_path, e
        )
    })?;

    init_db(&conn)?;

    let _ = DB_CONN.set(Mutex::new(conn));
    DB_CONN
        .get()
        .ok_or_else(|| "Error: Database connection not initialized".to_string())
}

pub fn get_profiles(conn: &Connection) -> Result<Vec<ProfileRecord>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, mc_version, loader_type, loader_version, min_ram, max_ram, jvm_args, game_dir, resolution_width, resolution_height, fullscreen, pre_launch_command, wrapper_command, post_exit_command, environment_variables, created_at, updated_at FROM profiles ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let is_fullscreen: Option<i64> = row.get(11)?;
            Ok(ProfileRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                mc_version: row.get(2)?,
                loader_type: row.get(3)?,
                loader_version: row.get(4)?,
                min_ram: row.get(5)?,
                max_ram: row.get(6)?,
                jvm_args: row.get(7)?,
                game_dir: row.get(8)?,
                resolution_width: row.get(9)?,
                resolution_height: row.get(10)?,
                fullscreen: is_fullscreen.map(|v| v != 0),
                pre_launch_command: row.get(12)?,
                wrapper_command: row.get(13)?,
                post_exit_command: row.get(14)?,
                environment_variables: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut profiles = Vec::new();
    for r in rows {
        let p = r.map_err(|e| format!("Error deserializando fila de perfil: {}", e))?;
        profiles.push(p);
    }
    Ok(profiles)
}

pub fn get_profiles_sync() -> Result<Vec<ProfileRecord>, String> {
    let mutex = get_connection()?;
    let conn = lock_or_recover(mutex);
    get_profiles(&conn)
}

#[tauri::command]
pub async fn db_get_profiles() -> Result<Vec<ProfileRecord>, String> {
    tokio::task::spawn_blocking(move || {
        let mutex = get_connection()?;
        let conn = lock_or_recover(mutex);
        get_profiles(&conn)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn save_profile(conn: &Connection, profile: &ProfileRecord) -> Result<(), String> {
    conn.execute(
        "INSERT INTO profiles (id, name, mc_version, loader_type, loader_version, min_ram, max_ram, jvm_args, game_dir, resolution_width, resolution_height, fullscreen, pre_launch_command, wrapper_command, post_exit_command, environment_variables, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            mc_version = excluded.mc_version,
            loader_type = excluded.loader_type,
            loader_version = excluded.loader_version,
            min_ram = excluded.min_ram,
            max_ram = excluded.max_ram,
            jvm_args = excluded.jvm_args,
            game_dir = excluded.game_dir,
            resolution_width = excluded.resolution_width,
            resolution_height = excluded.resolution_height,
            fullscreen = excluded.fullscreen,
            pre_launch_command = excluded.pre_launch_command,
            wrapper_command = excluded.wrapper_command,
            post_exit_command = excluded.post_exit_command,
            environment_variables = excluded.environment_variables,
            updated_at = excluded.updated_at;",
        params![
            profile.id,
            profile.name,
            profile.mc_version,
            profile.loader_type,
            profile.loader_version,
            profile.min_ram,
            profile.max_ram,
            profile.jvm_args,
            profile.game_dir,
            profile.resolution_width,
            profile.resolution_height,
            profile.fullscreen.map(|f| if f { 1 } else { 0 }),
            profile.pre_launch_command,
            profile.wrapper_command,
            profile.post_exit_command,
            profile.environment_variables,
            profile.created_at,
            profile.updated_at,
        ],
    )
    .map_err(|e| format!("Error guardando perfil en SQLite: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn db_save_profile(profile: ProfileRecord) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mutex = get_connection()?;
        let conn = lock_or_recover(mutex);
        save_profile(&conn, &profile)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn delete_profile(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM profiles WHERE id = ?1", params![id])
        .map_err(|e| format!("Error eliminando perfil: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn db_delete_profile(id: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mutex = get_connection()?;
        let conn = lock_or_recover(mutex);
        delete_profile(&conn, &id)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn get_accounts(conn: &Connection) -> Result<Vec<AccountRecord>, String> {
    let mut stmt = conn
        .prepare("SELECT id, username, uuid, account_type, access_token, skin_url, is_active, created_at FROM accounts ORDER BY is_active DESC, created_at DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let active_int: i32 = row.get(6)?;
            Ok(AccountRecord {
                id: row.get(0)?,
                username: row.get(1)?,
                uuid: row.get(2)?,
                account_type: row.get(3)?,
                access_token: row.get(4)?,
                skin_url: row.get(5)?,
                is_active: active_int == 1,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut accounts = Vec::new();
    for r in rows {
        let mut a = r.map_err(|e| format!("Error deserializando cuenta de SQLite: {}", e))?;
        if a.access_token.is_none() || a.access_token.as_deref() == Some("") {
            if let Some(secret) = crate::keyring_store::get_secret(&a.id) {
                a.access_token = Some(secret);
            }
        }
        accounts.push(a);
    }
    Ok(accounts)
}

#[tauri::command]
pub async fn db_get_accounts() -> Result<Vec<AccountRecord>, String> {
    tokio::task::spawn_blocking(move || {
        let mutex = get_connection()?;
        let conn = lock_or_recover(mutex);
        get_accounts(&conn)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn save_account(conn: &Connection, account: &AccountRecord) -> Result<(), String> {
    let mut account_to_save = account.clone();
    if let Some(ref token) = account.access_token {
        if !token.is_empty()
            && crate::keyring_store::set_secret(&account.id, token).is_ok()
            && crate::keyring_store::is_keyring_enabled()
        {
            account_to_save.access_token = None;
        }
    }

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Error iniciando transacción: {}", e))?;

    if account_to_save.is_active {
        tx.execute("UPDATE accounts SET is_active = 0", [])
            .map_err(|e| format!("Error desactivando cuentas previas: {}", e))?;
    }

    tx.execute(
        "INSERT INTO accounts (id, username, uuid, account_type, access_token, skin_url, is_active, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
            username = excluded.username,
            uuid = excluded.uuid,
            account_type = excluded.account_type,
            access_token = excluded.access_token,
            skin_url = excluded.skin_url,
            is_active = excluded.is_active;",
        params![
            account_to_save.id,
            account_to_save.username,
            account_to_save.uuid,
            account_to_save.account_type,
            account_to_save.access_token,
            account_to_save.skin_url,
            if account_to_save.is_active { 1 } else { 0 },
            account_to_save.created_at,
        ],
    )
    .map_err(|e| format!("Error guardando cuenta en SQLite: {}", e))?;

    tx.commit()
        .map_err(|e| format!("Error confirmando transacción: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn db_save_account(account: AccountRecord) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mutex = get_connection()?;
        let conn = lock_or_recover(mutex);
        save_account(&conn, &account)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn delete_account(conn: &Connection, id: &str) -> Result<(), String> {
    let _ = crate::keyring_store::delete_secret(id);
    conn.execute("DELETE FROM accounts WHERE id = ?1", params![id])
        .map_err(|e| format!("Error eliminando cuenta: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn db_delete_account(id: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mutex = get_connection()?;
        let conn = lock_or_recover(mutex);
        delete_account(&conn, &id)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub fn set_active_account(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE accounts SET is_active = CASE WHEN id = ?1 THEN 1 ELSE 0 END",
        params![id],
    )
    .map_err(|e| format!("Error marcando cuenta activa: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn db_set_active_account(id: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let mutex = get_connection()?;
        let conn = lock_or_recover(mutex);
        set_active_account(&conn, &id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_set_active_account_single_active_logic() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        let acc1 = AccountRecord {
            id: "acc-1".to_string(),
            username: "User1".to_string(),
            uuid: "u1".to_string(),
            account_type: "offline".to_string(),
            access_token: None,
            skin_url: None,
            is_active: true,
            created_at: 100,
        };
        let acc2 = AccountRecord {
            id: "acc-2".to_string(),
            username: "User2".to_string(),
            uuid: "u2".to_string(),
            account_type: "offline".to_string(),
            access_token: None,
            skin_url: None,
            is_active: false,
            created_at: 200,
        };

        save_account(&conn, &acc1).unwrap();
        save_account(&conn, &acc2).unwrap();

        set_active_account(&conn, "acc-2").unwrap();

        let accounts = get_accounts(&conn).unwrap();
        let active: Vec<_> = accounts.into_iter().filter(|a| a.is_active).collect();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].id, "acc-2");
    }

    #[test]
    fn test_db_save_account_resets_previous_active() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        let acc1 = AccountRecord {
            id: "acc-1".to_string(),
            username: "User1".to_string(),
            uuid: "u1".to_string(),
            account_type: "offline".to_string(),
            access_token: None,
            skin_url: None,
            is_active: true,
            created_at: 100,
        };
        save_account(&conn, &acc1).unwrap();

        let acc2 = AccountRecord {
            id: "acc-2".to_string(),
            username: "User2".to_string(),
            uuid: "u2".to_string(),
            account_type: "offline".to_string(),
            access_token: None,
            skin_url: None,
            is_active: true,
            created_at: 200,
        };
        save_account(&conn, &acc2).unwrap();

        let accounts = get_accounts(&conn).unwrap();
        let active: Vec<_> = accounts.into_iter().filter(|a| a.is_active).collect();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].id, "acc-2");
    }

    #[test]
    fn test_db_save_and_delete_profile() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        let profile = ProfileRecord {
            id: "prof-test".to_string(),
            name: "Test Profile".to_string(),
            mc_version: "1.21.1".to_string(),
            loader_type: "fabric".to_string(),
            loader_version: Some("0.16.0".to_string()),
            min_ram: 1024,
            max_ram: 4096,
            jvm_args: None,
            game_dir: None,
            resolution_width: Some(1920),
            resolution_height: Some(1080),
            fullscreen: Some(true),
            pre_launch_command: None,
            wrapper_command: None,
            post_exit_command: None,
            environment_variables: None,
            created_at: 1000,
            updated_at: 1000,
        };

        save_profile(&conn, &profile).unwrap();
        let profiles = get_profiles(&conn).unwrap();
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].id, "prof-test");
        assert_eq!(profiles[0].fullscreen, Some(true));

        delete_profile(&conn, "prof-test").unwrap();
        let profiles_after = get_profiles(&conn).unwrap();
        assert!(profiles_after.is_empty());
    }
}

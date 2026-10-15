use keyring::Entry;

const SERVICE_NAME: &str = "crystaltides-launcher";

pub fn is_keyring_enabled() -> bool {
    if cfg!(test) {
        return std::env::var("CRYSTALTIDES_TEST_KEYRING").is_ok();
    }
    true
}

pub fn set_secret(account_id: &str, secret: &str) -> Result<(), String> {
    if !is_keyring_enabled() {
        return Ok(());
    }
    let entry = Entry::new(SERVICE_NAME, account_id)
        .map_err(|e| format!("Error inicializando keyring: {}", e))?;
    entry
        .set_password(secret)
        .map_err(|e| format!("Error guardando secreto en keyring: {}", e))?;
    Ok(())
}

pub fn get_secret(account_id: &str) -> Option<String> {
    if !is_keyring_enabled() {
        return None;
    }
    let entry = Entry::new(SERVICE_NAME, account_id).ok()?;
    entry.get_password().ok()
}

pub fn delete_secret(account_id: &str) -> Result<(), String> {
    if !is_keyring_enabled() {
        return Ok(());
    }
    if let Ok(entry) = Entry::new(SERVICE_NAME, account_id) {
        let _ = entry.delete_credential();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keyring_disabled_in_test_by_default() {
        assert!(!is_keyring_enabled());
        assert_eq!(get_secret("dummy"), None);
        assert!(set_secret("dummy", "secret").is_ok());
        assert!(delete_secret("dummy").is_ok());
    }
}

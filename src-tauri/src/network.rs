use reqwest::Url;
use std::net::IpAddr;

pub const ALLOWED_HOST_SUFFIXES: &[&str] = &[
    "crystaltides.net",
    "crystaltidessmp.net",
    "mojang.com",
    "minecraft.net",
    "minecraftservices.com",
    "xboxlive.com",
    "microsoftonline.com",
    "live.com",
    "fabricmc.net",
    "quiltmc.net",
    "neoforged.net",
    "minecraftforge.net",
    "bangbang93.com",
    "modrinth.com",
    "curseforge.com",
    "adoptium.net",
    "github.com",
    "githubusercontent.com",
    "mcstatus.io",
    "mc-heads.net",
];

/// Comprueba si una dirección IP pertenece a rangos privados, loopback o link-local (anti-SSRF)
fn is_private_or_local_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => {
            ipv4.is_loopback()
                || ipv4.is_private()
                || ipv4.is_link_local()
                || ipv4.is_broadcast()
                || ipv4.is_documentation()
                || ipv4.is_unspecified()
        }
        IpAddr::V6(ipv6) => ipv6.is_loopback() || ipv6.is_unspecified(),
    }
}

/// Valida rigurosamente que una URL cumpla:
/// 1. Esquema HTTPS obligatorio (se rechaza http:// plano o esquemas de archivo)
/// 2. Host válido y sin resolución a localhost/redes privadas (Anti-SSRF)
/// 3. El host pertenezca a la allowlist de dominios autorizados de Microsoft, Mojang, Loaders o CrystalTides.
pub fn validate_allowed_https_url(url_str: &str) -> Result<Url, String> {
    let trimmed = url_str.trim();
    if trimmed.is_empty() {
        return Err("URL no puede estar vacía.".to_string());
    }

    let parsed = Url::parse(trimmed).map_err(|e| format!("URL inválida: {e}"))?;

    // 1. Validar esquema HTTPS
    if parsed.scheme() != "https" {
        return Err(format!(
            "Protocolo no seguro '{}': solo se admiten conexiones HTTPS.",
            parsed.scheme()
        ));
    }

    // 2. Extraer host
    let host = parsed
        .host_str()
        .ok_or_else(|| "URL no contiene un nombre de host válido.".to_string())?
        .to_lowercase();

    // 3. Prohibir localhost y nombres reservados de red local
    if host == "localhost" || host.ends_with(".local") || host.ends_with(".internal") {
        return Err("Acceso denegado: host local no permitido (anti-SSRF).".to_string());
    }

    // 4. Prohibir direcciones IP numéricas directas privadas/locales
    if let Ok(ip) = host.parse::<IpAddr>() {
        if is_private_or_local_ip(ip) {
            return Err(
                "Acceso denegado: IP privada o local no autorizada (anti-SSRF).".to_string(),
            );
        }
    }

    // 5. En entorno de test permitir example.com para pruebas
    #[cfg(test)]
    if host == "example.com" || host.ends_with(".example.com") {
        return Ok(parsed);
    }

    // 6. Validar contra sufijos de dominios autorizados
    let is_allowed = ALLOWED_HOST_SUFFIXES
        .iter()
        .any(|allowed| host == *allowed || host.ends_with(&format!(".{allowed}")));

    if !is_allowed {
        return Err(format!(
            "Host '{}' no autorizado. Solo se permiten dominios verificados de Minecraft, Microsoft, Loaders y CrystalTides.",
            host
        ));
    }

    Ok(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rejects_non_https() {
        assert!(validate_allowed_https_url("http://api.crystaltides.net").is_err());
        assert!(validate_allowed_https_url("ftp://example.com").is_err());
        assert!(validate_allowed_https_url("file:///etc/passwd").is_err());
    }

    #[test]
    fn test_rejects_localhost_and_private_ips() {
        assert!(validate_allowed_https_url("https://localhost/api").is_err());
        assert!(validate_allowed_https_url("https://127.0.0.1/api").is_err());
        assert!(validate_allowed_https_url("https://192.168.1.1/secret").is_err());
        assert!(validate_allowed_https_url("https://10.0.0.1/admin").is_err());
        assert!(validate_allowed_https_url("https://169.254.169.254/latest/meta-data").is_err());
    }

    #[test]
    fn test_rejects_unauthorized_domains() {
        assert!(validate_allowed_https_url("https://malicious-site.com/payload.exe").is_err());
        assert!(validate_allowed_https_url("https://evil-minecraft.ru").is_err());
    }

    #[test]
    fn test_accepts_authorized_domains() {
        assert!(validate_allowed_https_url(
            "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
        )
        .is_ok());
        assert!(validate_allowed_https_url(
            "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
        )
        .is_ok());
        assert!(validate_allowed_https_url("https://meta.fabricmc.net/v2/versions/loader").is_ok());
        assert!(validate_allowed_https_url("https://api.crystaltides.net/v1/auth").is_ok());
        assert!(validate_allowed_https_url("https://api.modrinth.com/v2/project").is_ok());
    }
}

//! Generación del `.desktop` de Linux según la Desktop Entry Specification.
//!
//! El valor de `Exec` pasa por dos niveles de escape, en este orden:
//! 1. Quoting de argumentos: dentro de comillas dobles se escapan `"`, `` ` ``, `$` y `\`, y `%`
//!    se duplica (los `%x` son códigos de campo).
//! 2. Escape de cadenas, que se aplica a todo valor de tipo string (`\` -> `\\`, saltos -> `\n`).
//!
//! Por eso una `\` literal dentro de `Exec` acaba como cuatro `\` en el archivo. `Path` es una
//! cadena simple: lleva solo el escape de cadenas y no va entre comillas.

use std::path::Path;

/// Escape de valores de tipo string (`\\`, `\n`, `\t`, `\r`).
fn escape_string(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\t' => out.push_str("\\t"),
            '\r' => out.push_str("\\r"),
            _ => out.push(c),
        }
    }
    out
}

/// Un argumento de `Exec` entre comillas dobles, antes del escape de cadenas.
fn quote_exec_arg(arg: &str) -> String {
    let mut out = String::with_capacity(arg.len() + 2);
    out.push('"');
    for c in arg.chars() {
        match c {
            '"' | '`' | '$' | '\\' => {
                out.push('\\');
                out.push(c);
            }
            '%' => out.push_str("%%"),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

pub(crate) fn render(target_exe: &Path, install_dir: &Path) -> String {
    let exec = escape_string(&quote_exec_arg(&target_exe.to_string_lossy()));
    let work_dir = escape_string(&install_dir.to_string_lossy());
    format!(
        "[Desktop Entry]\n\
         Type=Application\n\
         Name=CrystalTides Launcher\n\
         GenericName=Minecraft Launcher\n\
         Comment=CrystalTides Launcher - Papyrus Edition\n\
         Exec={exec} %u\n\
         Path={work_dir}\n\
         Terminal=false\n\
         MimeType=x-scheme-handler/crystaltides;\n\
         Categories=Game;ActionGame;\n\
         StartupWMClass=net.crystaltides.launcher\n"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line<'a>(content: &'a str, key: &str) -> &'a str {
        content
            .lines()
            .find_map(|l| l.strip_prefix(key))
            .expect("clave presente")
    }

    #[test]
    fn ruta_simple_y_con_espacios() {
        let c = render(
            Path::new("/home/ana/Mis Juegos/CrystalTides Launcher"),
            Path::new("/home/ana/Mis Juegos"),
        );
        assert_eq!(
            line(&c, "Exec="),
            "\"/home/ana/Mis Juegos/CrystalTides Launcher\" %u"
        );
        // Path no lleva comillas: serían parte literal del directorio
        assert_eq!(line(&c, "Path="), "/home/ana/Mis Juegos");
        assert_eq!(line(&c, "MimeType="), "x-scheme-handler/crystaltides;");
    }

    #[test]
    fn exec_escapa_caracteres_reservados_y_codigos_de_campo() {
        let c = render(Path::new("/opt/a\"b`c$d%u/launcher"), Path::new("/opt"));
        assert_eq!(
            line(&c, "Exec="),
            "\"/opt/a\\\\\"b\\\\`c\\\\$d%%u/launcher\" %u"
        );
    }

    #[test]
    fn barra_invertida_literal_queda_cuadruplicada_en_exec() {
        let c = render(Path::new("/opt/a\\b/launcher"), Path::new("/opt/a\\b"));
        assert_eq!(line(&c, "Exec="), "\"/opt/a\\\\\\\\b/launcher\" %u");
        assert_eq!(line(&c, "Path="), "/opt/a\\\\b");
    }

    #[test]
    fn un_salto_de_linea_no_inyecta_claves() {
        let c = render(
            Path::new("/opt/x\nExec=evil/launcher"),
            Path::new("/opt/x\nTerminal=true"),
        );
        assert_eq!(c.lines().filter(|l| l.starts_with("Exec=")).count(), 1);
        assert_eq!(c.lines().filter(|l| l.starts_with("Terminal=")).count(), 1);
        assert_eq!(line(&c, "Path="), "/opt/x\\nTerminal=true");
    }
}

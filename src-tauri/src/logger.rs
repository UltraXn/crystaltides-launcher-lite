use std::collections::VecDeque;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::SystemTime;

static LOGGER: OnceLock<Arc<Mutex<LoggerState>>> = OnceLock::new();

struct LoggerState {
    #[allow(dead_code)]
    log_dir: PathBuf,
    launcher_file: Option<File>,
    minecraft_file: Option<File>,
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

fn compute_year_and_remaining_days(mut days: i64) -> (i32, i64) {
    let mut year = 1970;
    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if days >= days_in_year {
            days -= days_in_year;
            year += 1;
        } else {
            break;
        }
    }
    (year, days)
}

fn compute_month_and_day(year: i32, mut days: i64) -> (i32, i64) {
    let leap = if is_leap_year(year) { 1 } else { 0 };
    let month_days = [31, 28 + leap, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut month = 1;
    for &m_days in &month_days {
        if days >= m_days {
            days -= m_days;
            month += 1;
        } else {
            break;
        }
    }
    (month, days + 1)
}

pub fn format_timestamp() -> String {
    let now = SystemTime::now();
    let duration = now
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let total_secs = duration.as_secs();
    let millis = duration.subsec_millis();

    let secs = total_secs % 60;
    let mins = (total_secs / 60) % 60;
    let hours = (total_secs / 3600) % 24;

    let days = (total_secs / 86400) as i64;
    let (year, rem_days) = compute_year_and_remaining_days(days);
    let (month, day) = compute_month_and_day(year, rem_days);

    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:03}",
        year, month, day, hours, mins, secs, millis
    )
}

pub fn get_logs_directory() -> PathBuf {
    if let Some(home) = dirs::home_dir() {
        home.join(".crystaltides").join("logs")
    } else {
        PathBuf::from(".crystaltides_logs")
    }
}

fn get_logger_state() -> &'static Arc<Mutex<LoggerState>> {
    LOGGER.get_or_init(|| {
        let dir = get_logs_directory();
        let _ = fs::create_dir_all(&dir);

        let launcher_log = dir.join("launcher.log");
        let launcher_prev = dir.join("launcher-previous.log");
        if launcher_log.exists() {
            let _ = fs::copy(&launcher_log, &launcher_prev);
        }

        let mc_log = dir.join("minecraft.log");
        let mc_prev = dir.join("minecraft-previous.log");
        if mc_log.exists() {
            let _ = fs::copy(&mc_log, &mc_prev);
        }

        let launcher_file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&launcher_log)
            .ok();

        let mc_file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&mc_log)
            .ok();

        let mut state = LoggerState {
            log_dir: dir,
            launcher_file,
            minecraft_file: mc_file,
        };

        let header = format!(
            "================================================================================\r\n\
             CrystalTides Launcher - Log Session Started\r\n\
             Date/Time: {}\r\n\
             Platform: {} ({})\r\n\
             Launcher Version: {}\r\n\
             ================================================================================\r\n",
            format_timestamp(),
            std::env::consts::OS,
            std::env::consts::ARCH,
            env!("CARGO_PKG_VERSION")
        );

        if let Some(ref mut f) = state.launcher_file {
            let _ = f.write_all(header.as_bytes());
            let _ = f.flush();
        }

        Arc::new(Mutex::new(state))
    })
}

pub fn init() {
    let _ = get_logger_state();
}

pub fn log(level: &str, module: &str, message: &str) {
    let timestamp = format_timestamp();
    let formatted = format!("[{}] [{}] [{}] {}\r\n", timestamp, level, module, message);

    let state_arc = get_logger_state();
    if let Ok(mut state) = state_arc.lock() {
        if let Some(ref mut file) = state.launcher_file {
            let _ = file.write_all(formatted.as_bytes());
            let _ = file.flush();
        }
    }
}

pub fn log_minecraft(line: &str, level: &str) {
    let timestamp = format_timestamp();
    let formatted_mc = format!("[{}] [{}] {}\r\n", timestamp, level, line);

    let state_arc = get_logger_state();
    if let Ok(mut state) = state_arc.lock() {
        if let Some(ref mut file) = state.minecraft_file {
            let _ = file.write_all(formatted_mc.as_bytes());
            if level == "ERROR" {
                let _ = file.flush();
            }
        }
        // Only write critical errors or warnings from Minecraft to the main launcher log to avoid log bloat
        if level == "ERROR" || level == "WARN" {
            let formatted_launcher =
                format!("[{}] [{}] [Minecraft] {}\r\n", timestamp, level, line);
            if let Some(ref mut file) = state.launcher_file {
                let _ = file.write_all(formatted_launcher.as_bytes());
                let _ = file.flush();
            }
        }
    }
}

pub fn read_recent_lines(file_path: &Path, max_lines: usize) -> Result<String, String> {
    if max_lines == 0 {
        return Ok(String::new());
    }

    if !file_path.exists() {
        return Ok("No hay registros disponibles aún.".to_string());
    }

    let file = File::open(file_path).map_err(|e| format!("Error abriendo log: {}", e))?;
    let reader = BufReader::new(file);
    let mut ring_buffer = VecDeque::with_capacity(max_lines);

    for line in reader.lines().map_while(Result::ok) {
        if ring_buffer.len() >= max_lines {
            ring_buffer.pop_front();
        }
        ring_buffer.push_back(line);
    }

    let lines_vec: Vec<String> = ring_buffer.into();
    Ok(lines_vec.join("\n"))
}

pub fn get_launcher_logs(max_lines: Option<usize>) -> Result<String, String> {
    let dir = get_logs_directory();
    let path = dir.join("launcher.log");
    read_recent_lines(&path, max_lines.unwrap_or(250))
}

pub fn get_minecraft_logs(max_lines: Option<usize>) -> Result<String, String> {
    let dir = get_logs_directory();
    let path = dir.join("minecraft.log");
    read_recent_lines(&path, max_lines.unwrap_or(250))
}

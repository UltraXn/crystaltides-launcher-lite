use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GpuTier {
    Ultra,
    High,
    Medium,
    Low,
    Integrated,
}

impl std::fmt::Display for GpuTier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GpuTier::Ultra => write!(f, "ULTRA"),
            GpuTier::High => write!(f, "HIGH"),
            GpuTier::Medium => write!(f, "MEDIUM"),
            GpuTier::Low => write!(f, "LOW"),
            GpuTier::Integrated => write!(f, "INTEGRATED"),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct GpuProfile {
    pub vendor: String,
    pub model: String,
    pub tier: GpuTier,
    pub vram_mb: Option<u64>,
}

fn detect_vendor(model: &str) -> &'static str {
    if model.contains("nvidia")
        || model.contains("rtx")
        || model.contains("geforce")
        || model.contains("gtx")
    {
        "NVIDIA GeForce"
    } else if model.contains("amd") || model.contains("radeon") || model.contains("rx ") {
        "AMD Radeon"
    } else if model.contains("intel") || model.contains("arc") {
        "Intel"
    } else {
        "Graphics Adapter"
    }
}

fn is_ultra_tier(model: &str, vram: u64) -> bool {
    model.contains("rtx 409")
        || model.contains("rtx 408")
        || model.contains("rtx 407")
        || model.contains("rtx 309")
        || model.contains("rtx 308")
        || model.contains("rtx 307")
        || model.contains("rx 7900")
        || model.contains("rx 7800")
        || model.contains("rx 6900")
        || model.contains("rx 6800")
        || model.contains("arc a770")
        || model.contains("arc b580")
        || vram >= 12288
}

fn is_high_tier(model: &str, vram: u64) -> bool {
    model.contains("rtx")
        || model.contains("gtx 108")
        || model.contains("rx 7600")
        || model.contains("rx 6700")
        || model.contains("rx 6600")
        || model.contains("rx 5700")
        || model.contains("arc a750")
        || model.contains("arc a580")
        || vram >= 6144
}

fn is_medium_tier(model: &str, vram: u64) -> bool {
    model.contains("gtx")
        || model.contains("rx 5")
        || model.contains("rx 4")
        || model.contains("radeon rx")
        || model.contains("rx ")
        || model.contains("arc a380")
        || vram >= 3500
}

fn is_low_tier(model: &str, vram: u64) -> bool {
    model.contains("gt ")
        || model.contains("radeon hd")
        || model.contains("radeon r5")
        || model.contains("radeon r7")
        || model.contains("radeon r9")
        || model.contains("radeon pro")
        || model.contains("geforce gt")
        || vram >= 1024
}

/// Evaluates the GPU model name and VRAM size to produce an informative profile without enforcing graphic limits
pub fn evaluate_gpu_tier(model: &str, vram_mb: Option<u64>) -> GpuProfile {
    let lower_model = model.to_lowercase();
    let vram = vram_mb.unwrap_or(0);

    let tier = if is_ultra_tier(&lower_model, vram) {
        GpuTier::Ultra
    } else if is_high_tier(&lower_model, vram) {
        GpuTier::High
    } else if is_medium_tier(&lower_model, vram) {
        GpuTier::Medium
    } else if is_low_tier(&lower_model, vram) {
        GpuTier::Low
    } else {
        GpuTier::Integrated
    };

    let vendor = detect_vendor(&lower_model);

    GpuProfile {
        vendor: vendor.to_string(),
        model: model.to_string(),
        tier,
        vram_mb: if vram > 0 { Some(vram) } else { None },
    }
}

#[cfg(target_os = "windows")]
#[allow(unsafe_code)]
unsafe fn read_driver_desc(sub_key: windows::Win32::System::Registry::HKEY) -> String {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{RegQueryValueExW, REG_SZ, REG_VALUE_TYPE};

    let desc_key: Vec<u16> = "DriverDesc\0".encode_utf16().collect();
    let mut data_type = REG_VALUE_TYPE::default();
    let mut data_buf = [0u16; 256];
    let mut data_len = (data_buf.len() * std::mem::size_of::<u16>()) as u32;

    if RegQueryValueExW(
        sub_key,
        PCWSTR(desc_key.as_ptr()),
        None,
        Some(&mut data_type),
        Some(data_buf.as_mut_ptr() as *mut u8),
        Some(&mut data_len),
    )
    .is_ok()
        && data_type == REG_SZ
    {
        let u16_slice = &data_buf[..(data_len as usize / 2)];
        let os_str = OsString::from_wide(u16_slice);
        os_str
            .to_string_lossy()
            .trim_matches('\0')
            .trim()
            .to_string()
    } else {
        String::new()
    }
}

#[cfg(target_os = "windows")]
#[allow(unsafe_code)]
unsafe fn read_vram_bytes(sub_key: windows::Win32::System::Registry::HKEY) -> u64 {
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{
        RegQueryValueExW, REG_DWORD, REG_QWORD, REG_VALUE_TYPE,
    };

    let qw_key: Vec<u16> = "HardwareInformation.qwMemorySize\0"
        .encode_utf16()
        .collect();
    let mut qw_val: u64 = 0;
    let mut qw_len = std::mem::size_of::<u64>() as u32;
    let mut data_type = REG_VALUE_TYPE::default();

    if RegQueryValueExW(
        sub_key,
        PCWSTR(qw_key.as_ptr()),
        None,
        Some(&mut data_type),
        Some(&mut qw_val as *mut u64 as *mut u8),
        Some(&mut qw_len),
    )
    .is_ok()
        && data_type == REG_QWORD
    {
        return qw_val;
    }

    let dword_key: Vec<u16> = "HardwareInformation.MemorySize\0".encode_utf16().collect();
    let mut dword_val: u32 = 0;
    let mut dword_len = std::mem::size_of::<u32>() as u32;
    if RegQueryValueExW(
        sub_key,
        PCWSTR(dword_key.as_ptr()),
        None,
        Some(&mut data_type),
        Some(&mut dword_val as *mut u32 as *mut u8),
        Some(&mut dword_len),
    )
    .is_ok()
        && data_type == REG_DWORD
    {
        dword_val as u64
    } else {
        0
    }
}

#[cfg(target_os = "windows")]
#[allow(unsafe_code)]
unsafe fn query_gpu_entry(
    class_key: windows::Win32::System::Registry::HKEY,
    subkey_name: &[u16],
) -> Option<(String, u64)> {
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{RegCloseKey, RegOpenKeyExW, HKEY, KEY_READ};

    let mut sub_key = HKEY::default();
    if RegOpenKeyExW(
        class_key,
        PCWSTR(subkey_name.as_ptr()),
        None,
        KEY_READ,
        &mut sub_key,
    )
    .is_err()
    {
        return None;
    }

    let driver_desc = read_driver_desc(sub_key);
    let vram_bytes = read_vram_bytes(sub_key);
    let _ = RegCloseKey(sub_key);

    if !driver_desc.is_empty()
        && !driver_desc.contains("Basic Render")
        && !driver_desc.contains("Remote Desktop")
    {
        let vram_mb = vram_bytes / 1024 / 1024;
        Some((driver_desc, vram_mb))
    } else {
        None
    }
}

#[cfg(target_os = "windows")]
#[allow(unsafe_code)]
fn scan_windows_gpus() -> Vec<(String, u64)> {
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegEnumKeyExW, RegOpenKeyExW, HKEY, HKEY_LOCAL_MACHINE, KEY_READ,
    };

    let mut gpus = Vec::new();
    let class_path: Vec<u16> =
        "SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\0"
            .encode_utf16()
            .collect();

    unsafe {
        let mut class_key = HKEY::default();
        if RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(class_path.as_ptr()),
            None,
            KEY_READ,
            &mut class_key,
        )
        .is_err()
        {
            return gpus;
        }

        let mut index = 0;
        let mut subkey_name = [0u16; 256];

        loop {
            let mut name_len = subkey_name.len() as u32;
            let status = RegEnumKeyExW(
                class_key,
                index,
                Some(windows::core::PWSTR(subkey_name.as_mut_ptr())),
                &mut name_len,
                None,
                None,
                None,
                None,
            );

            if status.is_err() {
                break;
            }

            index += 1;

            if let Some(entry) = query_gpu_entry(class_key, &subkey_name) {
                gpus.push(entry);
            }
        }

        let _ = RegCloseKey(class_key);
    }

    // Sort by VRAM descending so dedicated dGPU (RTX/Radeon) is selected ahead of iGPU
    gpus.sort_by(|a, b| b.1.cmp(&a.1));
    gpus
}

/// Inspects system graphics hardware and produces recommended Shader and Render Distance config
#[tauri::command]
pub fn detect_gpu_profile() -> Result<GpuProfile, String> {
    #[cfg(target_os = "windows")]
    {
        let detected_gpus = scan_windows_gpus();
        if let Some((model, vram_mb)) = detected_gpus.into_iter().next() {
            return Ok(evaluate_gpu_tier(&model, Some(vram_mb)));
        }
    }

    // Fallback detection
    let fallback_model = "Generic Graphics Adapter".to_string();
    Ok(evaluate_gpu_tier(&fallback_model, None))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nvidia_rtx_4080_profile() {
        let profile = evaluate_gpu_tier("NVIDIA GeForce RTX 4080", Some(16384));
        assert_eq!(profile.tier, GpuTier::Ultra);
        assert_eq!(profile.vendor, "NVIDIA GeForce");
        assert_eq!(profile.vram_mb, Some(16384));
    }

    #[test]
    fn test_amd_rx_6700_profile() {
        let profile = evaluate_gpu_tier("AMD Radeon RX 6700 XT", Some(12288));
        assert_eq!(profile.tier, GpuTier::Ultra);
        assert_eq!(profile.vendor, "AMD Radeon");
        assert_eq!(profile.vram_mb, Some(12288));
    }

    #[test]
    fn test_intel_integrated_profile() {
        let profile = evaluate_gpu_tier("Intel(R) UHD Graphics 770", Some(128));
        assert_eq!(profile.tier, GpuTier::Integrated);
        assert_eq!(profile.vram_mb, Some(128));
    }

    #[test]
    fn test_midrange_gtx_1660_profile() {
        let profile = evaluate_gpu_tier("NVIDIA GeForce GTX 1660 SUPER", Some(6144));
        assert_eq!(profile.tier, GpuTier::High);
        assert_eq!(profile.vendor, "NVIDIA GeForce");
        assert_eq!(profile.vram_mb, Some(6144));
    }

    #[test]
    fn test_legacy_low_tier_profile() {
        let profile = evaluate_gpu_tier("NVIDIA GeForce GT 730", Some(2048));
        assert_eq!(profile.tier, GpuTier::Low);
        assert_eq!(profile.vendor, "NVIDIA GeForce");
        assert_eq!(profile.vram_mb, Some(2048));
    }

    #[test]
    fn test_amd_rx_dedicated_zero_vram_profile() {
        let profile = evaluate_gpu_tier("AMD Radeon RX 6500 XT", None);
        assert_eq!(profile.tier, GpuTier::Medium);
        assert_eq!(profile.vendor, "AMD Radeon");
        assert_eq!(profile.vram_mb, None);
    }

    #[test]
    fn test_amd_integrated_radeon_graphics_profile() {
        let profile = evaluate_gpu_tier("AMD Radeon(TM) Graphics", Some(512));
        assert_eq!(profile.tier, GpuTier::Integrated);
        assert_eq!(profile.vendor, "AMD Radeon");
        assert_eq!(profile.vram_mb, Some(512));
    }
}

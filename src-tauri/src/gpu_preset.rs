use serde::{Serialize, Deserialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct GpuProfile {
    pub vendor: String,
    pub model: String,
    pub tier: String, // "ULTRA", "HIGH", "MEDIUM", "LOW", "INTEGRATED"
    pub vram_mb: Option<u64>,
    pub recommended_render_distance: u32,
    pub recommended_shader: String,
    pub recommended_simulation_distance: u32,
    pub max_fps: u32,
    pub recommended_render_scale: f32,
    pub enable_temporal_upscaling: bool,
}

/// Evaluates the GPU model name and VRAM size to produce an optimal tuning profile
pub fn evaluate_gpu_tier(model: &str, vram_mb: Option<u64>) -> GpuProfile {
    let lower_model = model.to_lowercase();
    let vram = vram_mb.unwrap_or(0);

    let (tier, vendor, render_dist, sim_dist, max_fps, shader, render_scale, upscaling) = if lower_model.contains("rtx 409")
        || lower_model.contains("rtx 408")
        || lower_model.contains("rtx 407")
        || lower_model.contains("rtx 309")
        || lower_model.contains("rtx 308")
        || lower_model.contains("rtx 307")
        || lower_model.contains("rx 7900")
        || lower_model.contains("rx 7800")
        || lower_model.contains("rx 6900")
        || lower_model.contains("rx 6800")
        || lower_model.contains("arc a770")
        || lower_model.contains("arc b580")
        || vram >= 12288
    {
        (
            "ULTRA",
            if lower_model.contains("nvidia") || lower_model.contains("rtx") || lower_model.contains("geforce") {
                "NVIDIA GeForce"
            } else if lower_model.contains("amd") || lower_model.contains("radeon") || lower_model.contains("rx ") {
                "AMD Radeon"
            } else if lower_model.contains("intel") || lower_model.contains("arc") {
                "Intel Arc"
            } else {
                "High-End Dedicated GPU"
            },
            18,
            12,
            165,
            "ComplementaryShaders_Ultra.zip",
            1.0,
            false,
        )
    } else if lower_model.contains("rtx")
        || lower_model.contains("gtx 108")
        || lower_model.contains("rx 7600")
        || lower_model.contains("rx 6700")
        || lower_model.contains("rx 6600")
        || lower_model.contains("rx 5700")
        || lower_model.contains("arc a750")
        || lower_model.contains("arc a580")
        || vram >= 6144
    {
        (
            "HIGH",
            if lower_model.contains("nvidia") || lower_model.contains("geforce") {
                "NVIDIA GeForce"
            } else if lower_model.contains("amd") || lower_model.contains("radeon") {
                "AMD Radeon"
            } else if lower_model.contains("intel") || lower_model.contains("arc") {
                "Intel Arc"
            } else {
                "Performance Dedicated GPU"
            },
            14,
            10,
            144,
            "ComplementaryReimagined_Medium.zip",
            0.85,
            true,
        )
    } else if lower_model.contains("gtx")
        || lower_model.contains("rx 5")
        || lower_model.contains("rx 4")
        || lower_model.contains("arc a380")
        || vram >= 3500
    {
        (
            "MEDIUM",
            if lower_model.contains("nvidia") || lower_model.contains("geforce") {
                "NVIDIA GeForce"
            } else {
                "AMD / Intel Discrete GPU"
            },
            10,
            8,
            90,
            "MakeUp_UltraFast_Medium.zip",
            0.75,
            true,
        )
    } else {
        (
            "INTEGRATED",
            if lower_model.contains("intel") {
                "Intel Integrated Graphics"
            } else if lower_model.contains("amd") || lower_model.contains("radeon") {
                "AMD Radeon Graphics (iGPU)"
            } else {
                "Integrated / Basic Graphics"
            },
            8,
            6,
            60,
            "MakeUp_UltraFast_Low.zip",
            0.67,
            true,
        )
    };

    GpuProfile {
        vendor: vendor.to_string(),
        model: model.to_string(),
        tier: tier.to_string(),
        vram_mb: if vram > 0 { Some(vram) } else { None },
        recommended_render_distance: render_dist,
        recommended_shader: shader.to_string(),
        recommended_simulation_distance: sim_dist,
        max_fps,
        recommended_render_scale: render_scale,
        enable_temporal_upscaling: upscaling,
    }
}

#[cfg(target_os = "windows")]
#[allow(unsafe_code)]
fn scan_windows_gpus() -> Vec<(String, u64)> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegEnumKeyExW, RegOpenKeyExW, RegQueryValueExW, HKEY,
        HKEY_LOCAL_MACHINE, KEY_READ, REG_DWORD, REG_QWORD, REG_SZ, REG_VALUE_TYPE,
    };

    let mut gpus = Vec::new();
    let class_path: Vec<u16> = "SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\0"
        .encode_utf16()
        .collect();

    unsafe {
        let mut class_key = HKEY::default();
        if RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(class_path.as_ptr()),
            0,
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
                windows::core::PWSTR(subkey_name.as_mut_ptr()),
                &mut name_len,
                None,
                windows::core::PWSTR::null(),
                None,
                None,
            );

            if status.is_err() {
                break;
            }

            index += 1;

            // Open subkey (0000, 0001, etc.)
            let mut sub_key = HKEY::default();
            if RegOpenKeyExW(
                class_key,
                PCWSTR(subkey_name.as_ptr()),
                0,
                KEY_READ,
                &mut sub_key,
            )
            .is_ok()
            {
                // Query DriverDesc
                let desc_key: Vec<u16> = "DriverDesc\0".encode_utf16().collect();
                let mut data_type = REG_VALUE_TYPE::default();
                let mut data_buf = [0u8; 512];
                let mut data_len = data_buf.len() as u32;

                let mut driver_desc = String::new();
                if RegQueryValueExW(
                    sub_key,
                    PCWSTR(desc_key.as_ptr()),
                    None,
                    Some(&mut data_type),
                    Some(data_buf.as_mut_ptr()),
                    Some(&mut data_len),
                )
                .is_ok()
                    && data_type == REG_SZ
                {
                    let u16_slice = std::slice::from_raw_parts(
                        data_buf.as_ptr() as *const u16,
                        (data_len / 2) as usize,
                    );
                    let os_str = OsString::from_wide(u16_slice);
                    driver_desc = os_str.to_string_lossy().trim_matches('\0').trim().to_string();
                }

                // Query VRAM size: HardwareInformation.qwMemorySize (64-bit) or HardwareInformation.MemorySize (32-bit)
                let mut vram_bytes: u64 = 0;
                let qw_key: Vec<u16> = "HardwareInformation.qwMemorySize\0".encode_utf16().collect();
                let mut qw_val: u64 = 0;
                let mut qw_len = std::mem::size_of::<u64>() as u32;

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
                    vram_bytes = qw_val;
                } else {
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
                        vram_bytes = dword_val as u64;
                    }
                }

                let _ = RegCloseKey(sub_key);

                if !driver_desc.is_empty()
                    && !driver_desc.contains("Basic Render")
                    && !driver_desc.contains("Remote Desktop")
                {
                    let vram_mb = vram_bytes / 1024 / 1024;
                    gpus.push((driver_desc, vram_mb));
                }
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

    // Fallback detection via sysinfo or environment
    let mut system = sysinfo::System::new_all();
    system.refresh_all();

    let fallback_model = "Generic Graphics Adapter".to_string();
    Ok(evaluate_gpu_tier(&fallback_model, None))
}

/// Applies recommended graphics settings directly to options.txt and config/iris.properties
#[tauri::command]
pub fn apply_gpu_options(
    game_dir: String,
    render_distance: u32,
    max_fps: u32,
    shader_name: Option<String>,
    render_scale: Option<f32>,
) -> Result<(), String> {
    let base_path = Path::new(&game_dir);
    let options_path = base_path.join("options.txt");
    let mut options_content = String::new();

    if options_path.exists() {
        if let Ok(existing) = fs::read_to_string(&options_path) {
            options_content = existing;
        }
    }

    let mut lines: Vec<String> = options_content
        .lines()
        .filter(|l| !l.starts_with("renderDistance:") && !l.starts_with("maxFps:"))
        .map(|l| l.to_string())
        .collect();

    lines.push(format!("renderDistance:{}", render_distance));
    lines.push(format!("maxFps:{}", max_fps));

    fs::write(&options_path, lines.join("\n")).map_err(|e| e.to_string())?;

    // Auto-configure Iris shaderpack and render scale if specified
    if let Some(shader) = shader_name {
        let config_dir = base_path.join("config");
        let _ = fs::create_dir_all(&config_dir);
        let iris_path = config_dir.join("iris.properties");

        let scale = render_scale.unwrap_or(1.0);
        let iris_config = format!(
            "# CrystalTides Auto-Tuned Iris Configuration\nenableShaders=true\ncurrentShaderpack={}\nrenderScale={:.2}\n",
            shader,
            scale
        );
        let _ = fs::write(&iris_path, iris_config);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nvidia_rtx_4080_profile() {
        let profile = evaluate_gpu_tier("NVIDIA GeForce RTX 4080", Some(16384));
        assert_eq!(profile.tier, "ULTRA");
        assert_eq!(profile.vendor, "NVIDIA GeForce");
        assert_eq!(profile.recommended_render_distance, 18);
        assert_eq!(profile.max_fps, 165);
        assert_eq!(profile.recommended_shader, "ComplementaryShaders_Ultra.zip");
        assert_eq!(profile.recommended_render_scale, 1.0);
        assert!(!profile.enable_temporal_upscaling);
    }

    #[test]
    fn test_amd_rx_6700_profile() {
        let profile = evaluate_gpu_tier("AMD Radeon RX 6700 XT", Some(12288));
        assert_eq!(profile.tier, "ULTRA");
        assert_eq!(profile.vendor, "AMD Radeon");
        assert_eq!(profile.recommended_render_distance, 18);
        assert_eq!(profile.recommended_render_scale, 1.0);
        assert!(!profile.enable_temporal_upscaling);
    }

    #[test]
    fn test_intel_integrated_profile() {
        let profile = evaluate_gpu_tier("Intel(R) UHD Graphics 770", Some(128));
        assert_eq!(profile.tier, "INTEGRATED");
        assert_eq!(profile.recommended_render_distance, 8);
        assert_eq!(profile.max_fps, 60);
        assert_eq!(profile.recommended_render_scale, 0.67);
        assert!(profile.enable_temporal_upscaling);
    }

    #[test]
    fn test_midrange_gtx_1660_profile() {
        let profile = evaluate_gpu_tier("NVIDIA GeForce GTX 1660 SUPER", Some(6144));
        assert_eq!(profile.tier, "HIGH");
        assert_eq!(profile.recommended_render_distance, 14);
        assert_eq!(profile.recommended_render_scale, 0.85);
        assert!(profile.enable_temporal_upscaling);
    }
}

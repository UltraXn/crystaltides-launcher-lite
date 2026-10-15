use serde::{Deserialize, Serialize};
use sysinfo::{CpuRefreshKind, RefreshKind, System};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct CpuInfo {
    pub brand: String,
    pub vendor: String,
    pub physical_cores: usize,
    pub logical_cores: usize,
    pub has_hyperthreading: bool,
    pub is_hybrid: bool,
    pub is_ryzen_x3d_dual_ccd: bool,
    pub is_xeon_or_legacy: bool,
    pub recommended_affinity_mask: u64,
    pub jvm_recommended_flags: Vec<String>,
}

fn is_intel_hybrid(
    brand_lower: &str,
    vendor: &str,
    physical_cores: usize,
    logical_cores: usize,
) -> bool {
    let is_intel = brand_lower.contains("intel") || vendor.to_lowercase().contains("intel");
    if !is_intel {
        return false;
    }

    // Invariante matemático: Si los hilos lógicos son exactamente el doble de los núcleos físicos,
    // todos los núcleos cuentan con multithreading simultáneo (2 hilos/núcleo). Los núcleos de eficiencia
    // (E-cores) de Intel nunca poseen HyperThreading (1 hilo/núcleo), por lo que la cantidad de E-cores es 0.
    if physical_cores > 0 && logical_cores == 2 * physical_cores {
        return false;
    }

    // Modelos de sobremesa explícitamente no híbridos (i3 12/13/14va gen, i5-12400/12500/12600 no-K)
    if brand_lower.contains("i3-12")
        || brand_lower.contains("i3-13")
        || brand_lower.contains("i3-14")
        || brand_lower.contains("12100")
        || brand_lower.contains("12300")
        || brand_lower.contains("12400")
        || brand_lower.contains("12500")
        || (brand_lower.contains("12600") && !brand_lower.contains("12600k"))
        || brand_lower.contains("13100")
        || brand_lower.contains("14100")
    {
        return false;
    }

    brand_lower.contains("ultra")
        || brand_lower.contains("12th")
        || brand_lower.contains("13th")
        || brand_lower.contains("14th")
        || brand_lower.contains("i7-12")
        || brand_lower.contains("i7-13")
        || brand_lower.contains("i7-14")
        || brand_lower.contains("i9-12")
        || brand_lower.contains("i9-13")
        || brand_lower.contains("i9-14")
        || brand_lower.contains("i5-12")
        || brand_lower.contains("i5-13")
        || brand_lower.contains("i5-14")
}

fn is_ryzen_dual_ccd_x3d(brand_lower: &str, vendor: &str, physical_cores: usize) -> bool {
    let is_amd = brand_lower.contains("amd")
        || brand_lower.contains("ryzen")
        || vendor.to_lowercase().contains("amd");
    is_amd && brand_lower.contains("x3d") && physical_cores >= 12
}

fn is_xeon_or_legacy_cpu(brand_lower: &str) -> bool {
    brand_lower.contains("xeon")
        || brand_lower.contains("v3")
        || brand_lower.contains("v4")
        || brand_lower.contains("fx-")
        || brand_lower.contains("opteron")
}

fn mask_range(count: usize) -> u64 {
    let mut mask = 0u64;
    for i in 0..count.min(64) {
        mask |= 1u64 << i;
    }
    mask
}

fn mask_even_threads(core_count: usize, safe_logical: usize) -> u64 {
    let mut mask = 0u64;
    for i in 0..core_count {
        let thread_idx = i * 2;
        if thread_idx < safe_logical && thread_idx < 64 {
            mask |= 1u64 << thread_idx;
        }
    }
    mask
}

fn calculate_cpu_affinity_mask(
    physical_cores: usize,
    safe_logical: usize,
    is_ryzen_x3d: bool,
    is_hybrid: bool,
    has_ht: bool,
    is_xeon: bool,
) -> u64 {
    let mask = if is_ryzen_x3d {
        let ccd0_threads = (physical_cores / 2).max(1) * 2;
        mask_range(ccd0_threads.min(safe_logical))
    } else if is_hybrid {
        let p_cores = if safe_logical > physical_cores {
            (safe_logical - physical_cores).clamp(1, 8)
        } else {
            physical_cores.min(8)
        };
        if has_ht {
            mask_even_threads(p_cores, safe_logical)
        } else {
            mask_range(p_cores)
        }
    } else if has_ht && (is_xeon || physical_cores >= 16) {
        mask_even_threads(physical_cores.min(8), safe_logical)
    } else {
        mask_range(safe_logical)
    };

    if mask == 0 {
        mask_range(safe_logical)
    } else {
        mask
    }
}

fn build_recommended_jvm_flags(
    is_xeon_or_legacy: bool,
    total_memory_mb: u64,
    java_version: Option<u8>,
) -> Vec<String> {
    let jv = java_version.unwrap_or(21);
    let mut jvm_flags = Vec::new();

    if jv >= 21 && total_memory_mb >= 4096 {
        jvm_flags.push("-XX:+UseZGC".to_string());
        if jv <= 22 {
            jvm_flags.push("-XX:+ZGenerational".to_string());
        }
        jvm_flags.push("-XX:ZAllocationSpikeTolerance=5".to_string());
    } else {
        jvm_flags.push("-XX:+UseG1GC".to_string());
        jvm_flags.push("-XX:+ParallelRefProcEnabled".to_string());
        jvm_flags.push("-XX:MaxGCPauseMillis=50".to_string());
        jvm_flags.push("-XX:+UnlockExperimentalVMOptions".to_string());

        if is_xeon_or_legacy {
            jvm_flags.push("-XX:G1ReservePercent=20".to_string());
            jvm_flags.push("-XX:InitiatingHeapOccupancyPercent=15".to_string());
            jvm_flags.push("-XX:G1MixedGCLiveThresholdPercent=90".to_string());
        } else {
            jvm_flags.push("-XX:G1NewSizePercent=20".to_string());
            jvm_flags.push("-XX:G1MaxNewSizePercent=35".to_string());
            if total_memory_mb < 8192 {
                jvm_flags.push("-XX:G1HeapRegionSize=4M".to_string());
            } else {
                jvm_flags.push("-XX:G1HeapRegionSize=8M".to_string());
            }
            jvm_flags.push("-XX:G1ReservePercent=15".to_string());
        }
    }

    jvm_flags.push("-XX:+UseAES".to_string());
    jvm_flags.push("-XX:+UseSHA".to_string());
    jvm_flags.push("-XX:CICompilerCount=4".to_string());
    jvm_flags.push("-Djava.net.preferIPv4Stack=true".to_string());
    jvm_flags
}

/// Pure calculation function for hardware profiling, enabling unit testing
pub fn calculate_hardware_profile(
    brand: &str,
    vendor: &str,
    physical_cores: usize,
    logical_cores: usize,
    total_memory_mb: u64,
    java_version: Option<u8>,
) -> CpuInfo {
    let brand_lower = brand.to_lowercase();
    let has_hyperthreading = logical_cores > physical_cores;
    let is_xeon_or_legacy = is_xeon_or_legacy_cpu(&brand_lower);
    let is_hybrid = is_intel_hybrid(&brand_lower, vendor, physical_cores, logical_cores);
    let is_ryzen_x3d_dual_ccd = is_ryzen_dual_ccd_x3d(&brand_lower, vendor, physical_cores);

    let safe_logical = logical_cores.clamp(1, 64);
    let mask = calculate_cpu_affinity_mask(
        physical_cores,
        safe_logical,
        is_ryzen_x3d_dual_ccd,
        is_hybrid,
        has_hyperthreading,
        is_xeon_or_legacy,
    );

    let jvm_flags = build_recommended_jvm_flags(is_xeon_or_legacy, total_memory_mb, java_version);

    CpuInfo {
        brand: brand.to_string(),
        vendor: vendor.to_string(),
        physical_cores,
        logical_cores,
        has_hyperthreading,
        is_hybrid,
        is_ryzen_x3d_dual_ccd,
        is_xeon_or_legacy,
        recommended_affinity_mask: mask,
        jvm_recommended_flags: jvm_flags,
    }
}

pub fn detect_hardware_profile_sync(java_version: Option<u8>) -> CpuInfo {
    let sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(sysinfo::MemoryRefreshKind::everything()),
    );

    let cpus = sys.cpus();
    let logical_cores = cpus.len();
    let physical_cores = sys.physical_core_count().unwrap_or(logical_cores);
    let total_memory_mb = sys.total_memory() / 1024 / 1024;

    let brand = if !cpus.is_empty() {
        cpus[0].brand().to_string()
    } else {
        "Unknown CPU".to_string()
    };

    let vendor = if !cpus.is_empty() {
        cpus[0].vendor_id().to_string()
    } else {
        "Unknown Vendor".to_string()
    };

    calculate_hardware_profile(
        &brand,
        &vendor,
        physical_cores,
        logical_cores,
        total_memory_mb,
        java_version,
    )
}

#[tauri::command]
pub async fn detect_hardware_profile(java_version: Option<u8>) -> CpuInfo {
    tokio::task::spawn_blocking(move || detect_hardware_profile_sync(java_version))
        .await
        .unwrap_or_else(|_| detect_hardware_profile_sync(java_version))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_intel_hybrid_affinity() {
        let info = calculate_hardware_profile(
            "13th Gen Intel(R) Core(TM) i7-13700K",
            "GenuineIntel",
            16,
            24,
            32768,
            Some(21),
        );
        assert!(info.is_hybrid);
        assert!(!info.is_ryzen_x3d_dual_ccd);
        // Should have affinity only for even threads of physical P-cores
        assert_eq!(info.recommended_affinity_mask & 0b1010101010101010, 0);
        assert!(info.recommended_affinity_mask > 0);
    }

    #[test]
    fn test_intel_hybrid_asymmetric_p_cores() {
        // i5-13400 has 10 physical cores (6 P-cores + 4 E-cores) and 16 logical threads
        let info = calculate_hardware_profile(
            "13th Gen Intel(R) Core(TM) i5-13400",
            "GenuineIntel",
            10,
            16,
            16384,
            Some(21),
        );
        assert!(info.is_hybrid);
        // Even threads for 6 P-cores: bits 0, 2, 4, 6, 8, 10
        let expected_mask = (1 << 0) | (1 << 2) | (1 << 4) | (1 << 6) | (1 << 8) | (1 << 10);
        assert_eq!(info.recommended_affinity_mask, expected_mask);
    }

    #[test]
    fn test_amd_ryzen_x3d_dual_ccd_affinity() {
        let info = calculate_hardware_profile(
            "AMD Ryzen 9 7950X3D 16-Core Processor",
            "AuthenticAMD",
            16,
            32,
            32768,
            Some(21),
        );
        assert!(!info.is_hybrid);
        assert!(info.is_ryzen_x3d_dual_ccd);
        // CCD0 is first 8 cores (16 threads) -> mask should be 0xFFFF (16 ones)
        assert_eq!(info.recommended_affinity_mask, 0xFFFF);
    }

    #[test]
    fn test_amd_ryzen_single_ccd_uses_all_threads() {
        let info = calculate_hardware_profile(
            "AMD Ryzen 7 7800X3D 8-Core Processor",
            "AuthenticAMD",
            8,
            16,
            16384,
            Some(21),
        );
        assert!(!info.is_hybrid);
        assert!(!info.is_ryzen_x3d_dual_ccd);
        // 16 logical cores -> all 16 bits active (0xFFFF)
        assert_eq!(info.recommended_affinity_mask, 0xFFFF);
    }

    #[test]
    fn test_generational_zgc_on_java21_high_ram() {
        let info = calculate_hardware_profile(
            "AMD Ryzen 7 7800X3D 8-Core Processor",
            "AuthenticAMD",
            8,
            16,
            32768,
            Some(21),
        );
        assert!(info
            .jvm_recommended_flags
            .contains(&"-XX:+UseZGC".to_string()));
        assert!(info
            .jvm_recommended_flags
            .contains(&"-XX:+ZGenerational".to_string()));
        assert!(info
            .jvm_recommended_flags
            .contains(&"-XX:ZAllocationSpikeTolerance=5".to_string()));
        assert!(!info
            .jvm_recommended_flags
            .contains(&"-XX:+UseG1GC".to_string()));
        assert!(!info
            .jvm_recommended_flags
            .contains(&"-XX:+UnlockExperimentalVMOptions".to_string()));
    }

    #[test]
    fn test_zgc_omits_generational_flag_on_java23_plus() {
        let info = calculate_hardware_profile(
            "AMD Ryzen 7 7800X3D 8-Core Processor",
            "AuthenticAMD",
            8,
            16,
            32768,
            Some(25),
        );
        assert!(info
            .jvm_recommended_flags
            .contains(&"-XX:+UseZGC".to_string()));
        assert!(!info
            .jvm_recommended_flags
            .contains(&"-XX:+ZGenerational".to_string()));
        assert!(info
            .jvm_recommended_flags
            .contains(&"-XX:ZAllocationSpikeTolerance=5".to_string()));
    }

    #[test]
    fn test_g1gc_retained_on_java17() {
        let info = calculate_hardware_profile(
            "AMD Ryzen 7 7800X3D 8-Core Processor",
            "AuthenticAMD",
            8,
            16,
            32768,
            Some(17),
        );
        assert!(info
            .jvm_recommended_flags
            .contains(&"-XX:+UseG1GC".to_string()));
        assert!(!info
            .jvm_recommended_flags
            .contains(&"-XX:+UseZGC".to_string()));
    }

    #[test]
    fn test_g1gc_fallback_on_low_ram_even_on_java21() {
        let info = calculate_hardware_profile(
            "Intel Core i5-10400",
            "GenuineIntel",
            6,
            12,
            3072, // 3GB RAM
            Some(21),
        );
        assert!(info
            .jvm_recommended_flags
            .contains(&"-XX:+UseG1GC".to_string()));
        assert!(!info
            .jvm_recommended_flags
            .contains(&"-XX:+UseZGC".to_string()));
    }

    #[test]
    fn test_intel_core_ultra_no_ht_p_cores() {
        // Intel Core Ultra 9 285K: 8 P-cores + 16 E-cores = 24 físicos, 24 lógicos (Sin HT)
        let info = calculate_hardware_profile(
            "Intel Core Ultra 9 285K",
            "GenuineIntel",
            24,
            24,
            32768,
            Some(21),
        );
        assert!(info.is_hybrid);
        // Sin HT: debe tomar los primeros 8 P-cores correlativos (bits 0..7 = 0xFF), sin saltar con hilos pares
        assert_eq!(info.recommended_affinity_mask, 0xFF);
    }

    #[test]
    fn test_intel_non_hybrid_i5_12400_uses_all_threads() {
        // i5-12400 has 6 physical cores and 12 logical threads (6P/12T, 0 E-cores)
        let info = calculate_hardware_profile(
            "12th Gen Intel(R) Core(TM) i5-12400F",
            "GenuineIntel",
            6,
            12,
            16384,
            Some(21),
        );
        assert!(!info.is_hybrid, "i5-12400F no es híbrido (0 E-cores)");
        assert!(!info.is_ryzen_x3d_dual_ccd);
        // Debe tener todos los 12 hilos habilitados (0x0FFF = 12 bits en 1)
        assert_eq!(info.recommended_affinity_mask, 0x0FFF);
    }

    #[test]
    fn test_intel_non_hybrid_i3_12100_uses_all_threads() {
        // i3-12100 has 4 physical cores and 8 logical threads (4P/8T, 0 E-cores)
        let info = calculate_hardware_profile(
            "12th Gen Intel(R) Core(TM) i3-12100",
            "GenuineIntel",
            4,
            8,
            16384,
            Some(21),
        );
        assert!(!info.is_hybrid, "i3-12100 no es híbrido (0 E-cores)");
        assert_eq!(info.recommended_affinity_mask, 0x00FF);
    }
}

use sysinfo::{System, CpuRefreshKind, RefreshKind};
use serde::{Serialize, Deserialize};

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
    let is_xeon_or_legacy = brand_lower.contains("xeon")
        || brand_lower.contains("v3")
        || brand_lower.contains("v4")
        || brand_lower.contains("fx-")
        || brand_lower.contains("opteron");

    // Detect Intel Hybrid P/E Core architecture (12th, 13th, 14th Gen, Core Ultra)
    let is_intel = brand_lower.contains("intel") || vendor.to_lowercase().contains("intel");
    let is_hybrid = is_intel
        && (brand_lower.contains("12th")
            || brand_lower.contains("13th")
            || brand_lower.contains("14th")
            || brand_lower.contains("ultra")
            || brand_lower.contains("i7-12")
            || brand_lower.contains("i7-13")
            || brand_lower.contains("i7-14")
            || brand_lower.contains("i9-12")
            || brand_lower.contains("i9-13")
            || brand_lower.contains("i9-14")
            || brand_lower.contains("i5-12")
            || brand_lower.contains("i5-13")
            || brand_lower.contains("i5-14"));

    // Detect AMD Ryzen Dual-CCD X3D processors (e.g. 7900X3D, 7950X3D, 9900X3D, 9950X3D)
    // where only CCD0 has 3D V-Cache (physical_cores >= 12 and contains x3d)
    let is_amd = brand_lower.contains("amd") || brand_lower.contains("ryzen") || vendor.to_lowercase().contains("amd");
    let is_ryzen_x3d_dual_ccd = is_amd && brand_lower.contains("x3d") && physical_cores >= 12;

    // Calculate optimal CPU Affinity mask
    let mut mask: u64 = 0;
    if is_ryzen_x3d_dual_ccd {
        // Pin strictly to CCD0 (first half of cores, e.g. 6 or 8 cores + SMT) with 3D V-Cache
        // to avoid cross-CCD Infinity Fabric latency penalties (up to 35% FPS gain)
        let ccd0_cores = physical_cores / 2;
        let ccd0_threads = ccd0_cores * 2;
        for i in 0..ccd0_threads.min(32) {
            mask |= 1 << i;
        }
    } else if is_hybrid {
        // For Intel hybrid, assign first N physical performance cores (even thread indices: 0, 2, 4, 6...)
        let target_p_cores = (physical_cores / 2).clamp(4, 8);
        for i in 0..target_p_cores {
            mask |= 1 << (i * 2);
        }
    } else if has_hyperthreading && (is_xeon_or_legacy || physical_cores >= 16) {
        // For Xeon / High Core count servers, use primary physical threads to avoid cache contention
        let target_cores = physical_cores.min(8);
        for i in 0..target_cores {
            mask |= 1 << (i * 2);
        }
    } else {
        // Standard CPUs / Single-CCD X3D (like 7800X3D, 5800X3D, 9800X3D): use all cores
        for i in 0..logical_cores.min(64) {
            mask |= 1 << i;
        }
    }

    // Recommended JVM Flags tailored for the detected architecture, Java version and RAM
    let mut jvm_flags = Vec::new();
    let current_java = java_version.unwrap_or(21);

    // If running on Java 21+ and with sufficient RAM (>= 10 GB), enable Generational ZGC for <1ms pauses
    if current_java >= 21 && total_memory_mb >= 10240 {
        jvm_flags.push("-XX:+UseZGC".to_string());
        jvm_flags.push("-XX:+ZGenerational".to_string());
        jvm_flags.push("-XX:+AlwaysPreTouch".to_string());
    } else {
        // Production-tuned G1GC
        jvm_flags.push("-XX:+UseG1GC".to_string());
        jvm_flags.push("-XX:+ParallelRefProcEnabled".to_string());
        jvm_flags.push("-XX:MaxGCPauseMillis=100".to_string());
        jvm_flags.push("-XX:+UnlockExperimentalVMOptions".to_string());
        jvm_flags.push("-XX:+AlwaysPreTouch".to_string());

        if is_xeon_or_legacy {
            jvm_flags.push("-XX:G1ReservePercent=20".to_string());
            jvm_flags.push("-XX:InitiatingHeapOccupancyPercent=15".to_string());
            jvm_flags.push("-XX:G1MixedGCLiveThresholdPercent=90".to_string());
        } else {
            jvm_flags.push("-XX:G1NewSizePercent=30".to_string());
            jvm_flags.push("-XX:G1MaxNewSizePercent=40".to_string());
            jvm_flags.push("-XX:G1HeapRegionSize=8M".to_string());
            jvm_flags.push("-XX:G1ReservePercent=15".to_string());
        }
    }

    // Hardware-accelerated instruction sets & networking optimizations
    jvm_flags.push("-XX:+UseFMA".to_string());
    jvm_flags.push("-XX:+UseAES".to_string());
    jvm_flags.push("-XX:+UseSHA".to_string());
    jvm_flags.push("-XX:CICompilerCount=4".to_string());
    jvm_flags.push("-Djava.net.preferIPv4Stack=true".to_string());

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

#[tauri::command]
pub fn detect_hardware_profile() -> CpuInfo {
    let sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(sysinfo::MemoryRefreshKind::everything())
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
        Some(21), // Default assumed Java 21 for modern launcher
    )
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
    fn test_generational_zgc_on_high_ram_java21() {
        let info = calculate_hardware_profile(
            "AMD Ryzen 7 7800X3D 8-Core Processor",
            "AuthenticAMD",
            8,
            16,
            32768,
            Some(21),
        );
        assert!(info.jvm_recommended_flags.contains(&"-XX:+UseZGC".to_string()));
        assert!(info.jvm_recommended_flags.contains(&"-XX:+ZGenerational".to_string()));
    }

    #[test]
    fn test_g1gc_fallback_on_low_ram() {
        let info = calculate_hardware_profile(
            "Intel Core i5-10400",
            "GenuineIntel",
            6,
            12,
            8192,
            Some(21),
        );
        assert!(info.jvm_recommended_flags.contains(&"-XX:+UseG1GC".to_string()));
        assert!(!info.jvm_recommended_flags.contains(&"-XX:+UseZGC".to_string()));
    }
}

// @generated por scripts/sync-launcher-assets.mjs (monorepo CrystalTides) a partir de
// mods/crystaltides-boost y de assets/boost: no editar a mano.

//! Jars de CrystalTides Boost embebidos: uno por grupo de versiones de Minecraft (nodo Stonecutter)
//! y loader. Quilt usa los de Fabric.

/// Versión de CrystalTides Boost de los jars embebidos.
pub const BOOST_VERSION: &str = "1.2.0";

/// Jar de CrystalTides Boost para un grupo de versiones de Minecraft y un loader.
pub struct BoostJar {
    /// "fabric" o "neoforge".
    pub loader: &'static str,
    /// Versiones exactas de Minecraft que cubre (mod.mc_releases).
    pub mc_releases: &'static [&'static str],
    /// Nombre del archivo en assets/boost: crystaltides-boost-<loader>-<grupo>.jar, donde el grupo
    /// es la última versión de Minecraft que cubre.
    pub file_name: &'static str,
    /// SHA-256 de `bytes`, también fijado en assets/MANIFEST.md.
    pub sha256: &'static str,
    pub bytes: &'static [u8],
}

pub const BOOST_JARS: &[BoostJar] = &[
    BoostJar {
        loader: "fabric",
        mc_releases: &["1.21", "1.21.1"],
        file_name: "crystaltides-boost-fabric-1.21.1.jar",
        sha256: "a97eb5f81fadd45d62afa9d92bd083da7a50041ed723df6541d3bad5d4d88012",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-fabric-1.21.1.jar"),
    },
    BoostJar {
        loader: "neoforge",
        mc_releases: &["1.21", "1.21.1"],
        file_name: "crystaltides-boost-neoforge-1.21.1.jar",
        sha256: "11111106c97cfd7c2837af4b1cca8cb99563ebf24fe4624cc1ac8b495851e705",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-neoforge-1.21.1.jar"),
    },
    BoostJar {
        loader: "fabric",
        mc_releases: &["1.21.2", "1.21.3"],
        file_name: "crystaltides-boost-fabric-1.21.3.jar",
        sha256: "95e3b736cf6d738b6f3e62775cb6aba405195db32e81aec28b9a5292d9b62a10",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-fabric-1.21.3.jar"),
    },
    BoostJar {
        loader: "neoforge",
        mc_releases: &["1.21.2", "1.21.3"],
        file_name: "crystaltides-boost-neoforge-1.21.3.jar",
        sha256: "3f7eb10dbda439c6932353e29ace1908a766483fd1d97c18af005a364dbdc17b",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-neoforge-1.21.3.jar"),
    },
    BoostJar {
        loader: "fabric",
        mc_releases: &["1.21.4"],
        file_name: "crystaltides-boost-fabric-1.21.4.jar",
        sha256: "8fa1f7f29d58cd20bb5b03096e257a9bd50f040a397953b67d07ee8cbd8782a1",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-fabric-1.21.4.jar"),
    },
    BoostJar {
        loader: "neoforge",
        mc_releases: &["1.21.4"],
        file_name: "crystaltides-boost-neoforge-1.21.4.jar",
        sha256: "eb7a855030e4a3c70ae055dcb161e215a2f75c566bf53b9c7a29cfc673539fa3",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-neoforge-1.21.4.jar"),
    },
    BoostJar {
        loader: "fabric",
        mc_releases: &["1.21.5"],
        file_name: "crystaltides-boost-fabric-1.21.5.jar",
        sha256: "512df4b87a4d41c95c702894de3a51492fb813ea101c59f3905fc6e495198578",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-fabric-1.21.5.jar"),
    },
    BoostJar {
        loader: "neoforge",
        mc_releases: &["1.21.5"],
        file_name: "crystaltides-boost-neoforge-1.21.5.jar",
        sha256: "84ffdb5a5e558dd7a41b300f945d2ce01a1028e63ea98134e12b05f6674a0c53",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-neoforge-1.21.5.jar"),
    },
    BoostJar {
        loader: "fabric",
        mc_releases: &["1.21.6", "1.21.7", "1.21.8"],
        file_name: "crystaltides-boost-fabric-1.21.8.jar",
        sha256: "ebf7bfcd4721cc76f09ef5bcab5e3b1db742d19a70c59d8e38110a3a5a9cacd9",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-fabric-1.21.8.jar"),
    },
    BoostJar {
        loader: "neoforge",
        mc_releases: &["1.21.6", "1.21.7", "1.21.8"],
        file_name: "crystaltides-boost-neoforge-1.21.8.jar",
        sha256: "bd6c8458732010b16a296d4d4498658f586c5319c18904812d6023812d63e983",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-neoforge-1.21.8.jar"),
    },
    BoostJar {
        loader: "fabric",
        mc_releases: &["1.21.9", "1.21.10"],
        file_name: "crystaltides-boost-fabric-1.21.10.jar",
        sha256: "76717036a39761e480452bcbba4b9ee7546b09d1774197c32c1383bb4e419e9a",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-fabric-1.21.10.jar"),
    },
    BoostJar {
        loader: "neoforge",
        mc_releases: &["1.21.9", "1.21.10"],
        file_name: "crystaltides-boost-neoforge-1.21.10.jar",
        sha256: "f5fc4f468a437552076abd433ec56f6a5cf48c3a69720eef32e215c6fffaf05a",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-neoforge-1.21.10.jar"),
    },
    BoostJar {
        loader: "fabric",
        mc_releases: &["1.21.11"],
        file_name: "crystaltides-boost-fabric-1.21.11.jar",
        sha256: "28c75703db660abf1629d277a122b000fa2f71bff9cfad41c84fd4ced94175ef",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-fabric-1.21.11.jar"),
    },
    BoostJar {
        loader: "neoforge",
        mc_releases: &["1.21.11"],
        file_name: "crystaltides-boost-neoforge-1.21.11.jar",
        sha256: "d2c1f9bebe4b9b2b15eb46c2214ba6e57f48c74c326ff86bca1a3672f4235f3b",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-neoforge-1.21.11.jar"),
    },
    BoostJar {
        loader: "fabric",
        mc_releases: &["26.1", "26.1.1", "26.1.2"],
        file_name: "crystaltides-boost-fabric-26.1.2.jar",
        sha256: "7e6e3f9e245492d929d50a21b16c9fd482b49266d382b59c5f70a4cb9e7a97b0",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-fabric-26.1.2.jar"),
    },
    BoostJar {
        loader: "neoforge",
        mc_releases: &["26.1", "26.1.1", "26.1.2"],
        file_name: "crystaltides-boost-neoforge-26.1.2.jar",
        sha256: "107144adde55c612119e1edcdf90487b27b2cf09e3b1060410640577bc69be7b",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-neoforge-26.1.2.jar"),
    },
    BoostJar {
        loader: "fabric",
        mc_releases: &["26.2"],
        file_name: "crystaltides-boost-fabric-26.2.jar",
        sha256: "865a70d93aa617b26ed2c1fe4f1df7bef86e90985cbcd1f7bf5c8c84108333cf",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-fabric-26.2.jar"),
    },
    BoostJar {
        loader: "neoforge",
        mc_releases: &["26.2"],
        file_name: "crystaltides-boost-neoforge-26.2.jar",
        sha256: "e857af9f453553dc6eb8311f7dd2b54e2f152ff397663c4348bd190fd13c4f38",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-neoforge-26.2.jar"),
    },
    BoostJar {
        loader: "fabric",
        mc_releases: &["26.3"],
        file_name: "crystaltides-boost-fabric-26.3.jar",
        sha256: "115f422f56ca29776b5491e630d0dd614b245c8956b176fda6cd84574e141485",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-fabric-26.3.jar"),
    },
    BoostJar {
        loader: "neoforge",
        mc_releases: &["26.3"],
        file_name: "crystaltides-boost-neoforge-26.3.jar",
        sha256: "c616793ef3d840ecbd7b58587fe5c1396c67afb9f9f951e9a94a426689b6bcbf",
        bytes: include_bytes!("../assets/boost/crystaltides-boost-neoforge-26.3.jar"),
    },
];

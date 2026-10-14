# Generational ZGC & Low-Latency JVM Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automatic Generational ZGC switching for Java 21+ and adaptive low-latency JVM tuning in Launcher Lite, eliminating garbage collection micro-stutters and resolving the Distant Horizons warning.

**Architecture:** 
1. Expand Rust hardware profiling in `hardware.rs` to support optional Java major version hints (`detect_hardware_profile(java_version: Option<u32>)`).
2. Generate modern Generational ZGC flags (`-XX:+UseZGC`, `-XX:+ZGenerational`, `-XX:ZAllocationSpikeTolerance=5`, `-XX:+UnlockExperimentalVMOptions`) when running on Java >= 21 with sufficient RAM, while retaining tuned G1GC for Java 8–17 or low-spec systems.
3. In `launcherService.ts`, pass the resolved Java major version to `resolveOptimizationJvmFlags` so the launcher seamlessly applies the optimal GC profile.
4. Ensure `sanitizeJvmArgs` cleanly removes any conflicting G1 flags when ZGC is active and vice versa, preserving any user-explicit `-XX:+Use...` overrides.

**Tech Stack:** Rust (Tauri v2, sysinfo), TypeScript / React 19, Vitest, Cargo Test.

---

## Global Constraints

- Never override explicit user arguments in `params.javaArgs`.
- Do not enable Generational ZGC on Java versions prior to 21 (ZGenerational was stabilized in Java 21 / JEP 439).
- Do not force ZGC on systems with severely constrained memory (< 4GB RAM) where G1GC has lower base overhead.
- Maintain 100% test pass rate in both Rust (`cargo test`) and TypeScript (`vitest`, `tsc --noEmit`, `oxlint`).

---

## Review Focus

1. **Java 21+ detection**: Correctly parses major version from both Minecraft version metadata and runtime binary path (e.g. `21.0.3` -> `21`).
2. **Flag conflict resolution**: When ZGC is active, any lingering G1GC flags (`-XX:G1NewSizePercent`, `-XX:MaxGCPauseMillis`, etc.) must be purged so HotSpot does not fail startup with conflicting flags.
3. **User override preservation**: If the user explicitly sets `-XX:+UseG1GC` or `-XX:+UseShenandoahGC` in custom arguments, the auto-tuning must respect their choice.
4. **Memory safety under 4GB**: Systems with <= 4GB RAM should stay on G1GC to avoid ZGC multi-generation mapping overhead on small heaps.
5. **Distant Horizons compatibility**: Resolves the `Distant Horizons: G1 Garbage collector detected` prompt observed in-game.

---

## Tasks

### Task 1: Rust Backend — Adaptive GC Flag Generation in `hardware.rs`

**Files:**
- Modify: `apps/launcher-lite/src-tauri/src/hardware.rs`
- Test: `apps/launcher-lite/src-tauri/src/hardware.rs` (unit tests)

- [ ] **Step 1: Write failing unit test in `hardware.rs`**
  - Add test `test_generational_zgc_on_java21_high_ram` expecting `-XX:+UseZGC`, `-XX:+ZGenerational`, and `-XX:ZAllocationSpikeTolerance=5`.
  - Add test `test_g1gc_retained_on_java17` expecting `-XX:+UseG1GC`.
  - Add test `test_g1gc_fallback_on_low_ram_even_on_java21` expecting G1GC when `total_memory_mb < 4096`.

- [ ] **Step 2: Run test to confirm failure**
  - Run `cargo test -p launcher-lite-tauri --lib hardware`.

- [ ] **Step 3: Implement `build_recommended_jvm_flags` with Java version support**
  - Update `build_recommended_jvm_flags(is_xeon_or_legacy: bool, total_memory_mb: u64, java_version: Option<u32>) -> Vec<String>`.
  - When `java_version.unwrap_or(17) >= 21 && total_memory_mb >= 4096`:
    - Output `["-XX:+UnlockExperimentalVMOptions", "-XX:+UseZGC", "-XX:+ZGenerational", "-XX:ZAllocationSpikeTolerance=5", "-XX:+UseAES", "-XX:+UseSHA"]`.
  - Otherwise retain optimized G1GC profile.
  - Update `detect_hardware_profile(java_version: Option<u32>)` command.

- [ ] **Step 4: Verify test passes**
  - Run `cargo test -p launcher-lite-tauri --lib hardware` and verify 100% green.

---

### Task 2: Frontend — Integration in `hardwareService.ts` and `launcherService.ts`

**Files:**
- Modify: `apps/launcher-lite/src/services/hardwareService.ts`
- Modify: `apps/launcher-lite/src/services/launcherService.ts`
- Test: `apps/launcher-lite/src/services/__tests__/launcherService.test.ts` (or relevant vitest file)

- [ ] **Step 1: Update `hardwareService.ts`**
  - Update `fetchHardwareProfile(javaVersion?: number)` to pass `{ javaVersion: javaVersion ?? null }` to Tauri.

- [ ] **Step 2: Update `launcherService.ts` resolution flow**
  - In `applyHardwareAndGpuOptimizations` (or `resolveOptimizationJvmFlags`), pass `requiredJavaVersion` into `fetchHardwareProfile(requiredJavaVersion)`.
  - When constructing default fallback optimization flags in TS (if hardware profile is null), check `requiredJavaVersion >= 21` and default to Generational ZGC flags.
  - Verify `sanitizeJvmArgs` and `isConflictingGcArg` cleanly sanitize ZGC flags when G1 is chosen, and purge G1 flags when ZGC is chosen.

- [ ] **Step 3: Run TypeScript compiler and Oxlint**
  - Run `pnpm exec tsc --noEmit`.
  - Run `pnpm exec oxlint -c .oxlintrc.json --no-ignore src`.

- [ ] **Step 4: Run Vitest suite**
  - Run `pnpm test -- --run`.

---

### Task 3: End-to-End Verification and Sanity Check

- [ ] **Step 1: Run full cargo test suite**
  - Run `cargo test -p launcher-lite-tauri`.

- [ ] **Step 2: Validate generated JVM tokens in simulation**
  - Ensure simulated launch for Minecraft 1.20.4 / 1.21 on Java 21 outputs:
    `"-XX:+UnlockExperimentalVMOptions", "-XX:+UseZGC", "-XX:+ZGenerational"` without any conflicting `-XX:+UseG1GC`.

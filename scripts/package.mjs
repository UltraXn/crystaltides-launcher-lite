import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distPackageDir = path.join(projectRoot, 'dist-package');

console.log('\n🚀 ==========================================');
console.log('   CrystalTides Launcher Lite - Packaging Pipeline');
console.log('==========================================\n');

// 1 & 2. Build Frontend & Tauri Release Binary (embedded production bundle)
console.log('🦀 [1/3] Compilando aplicación nativa con Tauri CLI (incrustando frontend en release)...');
execSync('npx tauri build --no-bundle', { cwd: projectRoot, stdio: 'inherit' });

// 3. Locate generated binary
console.log('\n🔍 [3/4] Localizando binario generado...');
const possibleTargetPaths = [
  'F:/cargo_target/release/launcher-lite-tauri.exe',
  path.join(projectRoot, 'target', 'release', 'launcher-lite-tauri.exe'),
  path.join(projectRoot, '..', '..', 'target', 'release', 'launcher-lite-tauri.exe'),
];

let sourceBinary = null;
for (const p of possibleTargetPaths) {
  if (fs.existsSync(p)) {
    sourceBinary = p;
    break;
  }
}

if (!sourceBinary) {
  console.error('❌ Error: No se encontró launcher-lite-tauri.exe en las rutas de destino de cargo.');
  process.exit(1);
}

console.log(`✓ Binario localizado en: ${sourceBinary}`);

// 4. Create dist-package directory
if (!fs.existsSync(distPackageDir)) {
  fs.mkdirSync(distPackageDir, { recursive: true });
}

const setupDest = path.join(distPackageDir, 'CrystalTides-Setup.exe');
const portableDest = path.join(distPackageDir, 'CrystalTides-Portable.exe');

function safeCopy(src, dest) {
  try {
    fs.copyFileSync(src, dest);
  } catch (err) {
    if (err.code === 'EBUSY') {
      console.warn(`[Aviso] ${path.basename(dest)} está en ejecución. Intentando rotación de archivo...`);
      try {
        const tempDest = dest + '.old';
        if (fs.existsSync(tempDest)) fs.unlinkSync(tempDest);
        fs.renameSync(dest, tempDest);
        fs.copyFileSync(src, dest);
        try { fs.unlinkSync(tempDest); } catch {}
      } catch {
        throw new Error(`El archivo ${path.basename(dest)} está en uso por Windows. Ciérralo para actualizarlo.`);
      }
    } else {
      throw err;
    }
  }
}

console.log('\n📁 [4/4] Empaquetando artefactos finales de distribución...');
safeCopy(sourceBinary, setupDest);
safeCopy(sourceBinary, portableDest);

// Firmar el instalador para el AutoUpdater (mismo artefacto que publica release.yml):
// tauri-plugin-updater descarga CrystalTides-Setup.exe y lo ejecuta con /P /UPDATE.
const localKeyPath = path.join(projectRoot, 'crystaltides.key');
const privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY || (fs.existsSync(localKeyPath) ? fs.readFileSync(localKeyPath, 'utf-8').trim() : null);
const tauriConf = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src-tauri', 'tauri.conf.json'), 'utf-8'));

if (privateKey) {
  console.log('🔐 Firmando instalador para AutoUpdater...');
  try {
    execSync(`npx tauri signer sign -k "${privateKey}" -p "${process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || ''}" "${setupDest}"`, { cwd: projectRoot, stdio: 'inherit' });
    const sigPath = `${setupDest}.sig`;
    if (fs.existsSync(sigPath)) {
      const sigContent = fs.readFileSync(sigPath, 'utf-8').trim();
      const version = tauriConf.version;
      const latestManifest = {
        version,
        notes: `Lanzamiento CrystalTides Launcher Lite v${version}`,
        pub_date: new Date().toISOString(),
        platforms: {
          'windows-x86_64': {
            signature: sigContent,
            url: `https://github.com/UltraXn/crystaltides-launcher-lite/releases/download/v${version}/CrystalTides-Setup.exe`,
          },
        },
      };
      fs.writeFileSync(path.join(distPackageDir, 'latest.json'), JSON.stringify(latestManifest, null, 2), 'utf-8');
      console.log('✓ latest.json generado con éxito.');
    }
  } catch (signErr) {
    console.warn('⚠️ Error al firmar el paquete de actualización:', signErr.message);
  }
}

function getSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

const setupHash = getSha256(setupDest);
const portableHash = getSha256(portableDest);
const setupSizeMb = (fs.statSync(setupDest).size / (1024 * 1024)).toFixed(2);

const checksumLines = [
  `${setupHash} *CrystalTides-Setup.exe`,
  `${portableHash} *CrystalTides-Portable.exe`,
];

fs.writeFileSync(path.join(distPackageDir, 'SHA256SUMS.txt'), checksumLines.join('\n') + '\n', 'utf-8');

console.log('\n✅ ========================================================');
console.log('   🎉 ¡EMPAQUETADO DE PRODUCCIÓN COMPLETADO CON ÉXITO!');
console.log('========================================================\n');
console.log(`📂 Carpeta de distribución: ${distPackageDir}`);
console.log(`   1. 📦 CrystalTides-Setup.exe                  (${setupSizeMb} MB) -> Instalador Windows`);
console.log(`   2. 🚀 CrystalTides-Portable.exe               (${setupSizeMb} MB) -> Ejecutable Portátil`);
if (fs.existsSync(`${setupDest}.sig`)) {
  console.log(`   3. 🔏 CrystalTides-Setup.exe.sig                    -> Firma del AutoUpdater`);
}
if (fs.existsSync(path.join(distPackageDir, 'latest.json'))) {
  console.log(`   4. 📋 latest.json                                   -> Manifiesto firmado de Update`);
}
console.log(`   5. 🛡️ SHA256SUMS.txt                                 -> Checksums de Integridad\n`);
console.log('💡 Listo para subir a tu release en GitHub o CDN.\n');

#!/usr/bin/env node
/**
 * Jules Orchestrator — Launcher Lite Multi-Agent Deployment
 * 
 * Despliega y coordina 10 agentes especializados de Google Jules
 * para auditoría continua de Bugs, Código Muerto y Fallos de Seguridad.
 */

import fs from 'node:fs';

const API_BASE = 'https://jules.googleapis.com/v1alpha';

function resolveApiKey() {
  if (process.env.JULES_API_KEY) {
    return process.env.JULES_API_KEY;
  }
  try {
    const configPath = 'C:\\Users\\nacho\\.gemini\\config\\mcp_config.json';
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const key = config?.mcpServers?.['google-jules']?.env?.JULES_API_KEY;
      if (key) return key;
    }
  } catch {
    // Silently continue
  }
  return null;
}

const API_KEY = resolveApiKey();

if (!API_KEY) {
  console.error('\x1b[31m[ERROR] No se encontró JULES_API_KEY en variables de entorno ni en mcp_config.json.\x1b[0m');
  process.exit(1);
}

export const JULES_10_AGENT_SPECS = [
  {
    id: 'SEC-01',
    category: 'Seguridad',
    title: 'Auditoría AppSec: Autenticación, JWT, RLS y Control de Acceso',
    prompt: `Actúa como un Ingeniero Principal de Seguridad de Aplicaciones (AppSec).
Tu objetivo exclusivo es auditar el flujo de autenticación y autorización:
1. Inspecciona validación de tokens JWT: asegúrate de que no haya Algorithm Confusion (forzar algoritmos como HS256/RS256 explícitos).
2. Verifica que las políticas de RLS (Row Level Security) estén activas y que nunca se use 'using (true)' para escrituras.
3. Verifica la mitigación de IDOR/BOLA: ninguna consulta por ID debe realizarse sin validar que pertenezca al usuario de la sesión autenticada.
4. Identifica endpoints desprotegidos o bypasses en middlewares.
Proporciona un reporte con causa raíz, archivo:línea exacto, y aplica el parche mínimo seguro para corregir cada fallo.`
  },
  {
    id: 'SEC-02',
    category: 'Seguridad',
    title: 'Defensa de Inyección: SQLi, XSS, SSRF y Sanitización Estricta',
    prompt: `Actúa como un Auditor de Seguridad Defensiva y Pentesting.
Tu objetivo exclusivo es auditar vectores de inyección y desinfección de entrada:
1. SQL Injection: verifica que toda consulta a bases de datos (SQLite, Postgres, MariaDB) use queries parametrizadas con '?' o query builders tipados. Queda prohibida la interpolación directa de strings con input de usuario.
2. XSS: verifica que todo renderizado HTML use sanitización estricta (DOMPurify.sanitize) o bindings nativos de React.
3. SSRF: cualquier fetch saliente hacia URLs provistas por usuarios debe validar contra rangos privados (RFC 1918, loopback 127.0.0.1, link-local 169.254.169.254).
4. Path Traversal: valida que nombres de archivos y rutas de guardado no permitan escapes '../'.
Genera el diff de hardening con el parche exacto.`
  },
  {
    id: 'SEC-03',
    category: 'Seguridad',
    title: 'Detección de Fuga de Secretos, Tokens y Credenciales Hardcodeadas',
    prompt: `Actúa como un Auditor de Detección de Fugas y Gestión de Secretos (Gitleaks / Secret Scanning).
Tu objetivo exclusivo es escanear todo el código fuente en busca de credenciales en texto plano:
1. Claves privadas (service_role, sk-, bearer tokens, passwords de bases de datos, tokens de Discord, certificados PEM/KEY).
2. Filtración en bundles frontend: revisa que ningún secreto sensible use prefijos públicos como VITE_ o NEXT_PUBLIC_ o se incluya en el bundle cliente.
3. Archivos sensibles no ignorados: valida que .env, certificados o dumps no estén expuestos ni commiteados.
Reemplaza secretos con variables de entorno validadas en tiempo de ejecución o Secure Vault.`
  },
  {
    id: 'DEAD-01',
    category: 'Código Muerto',
    title: 'Higiene de Dependencias y Poda de Exports Huérfanos (Knip)',
    prompt: `Actúa como un Especialista en Arquitectura y Optimización de Código Muerto (Knip Standard).
Tu objetivo exclusivo es eliminar código no utilizado y dependencias huérfanas:
1. Identifica exports en funciones, tipos, interfaces y componentes que no tengan ninguna referencia o importación en el proyecto.
2. Identifica dependencias en package.json (o Cargo.toml) que no sean importadas en ninguna parte del código base.
3. Identifica dependencias no declaradas que se estén importando de forma fantasma.
Poda limpiamente los exports muertos y dependencias sin uso preservando intacta la funcionalidad activa.`
  },
  {
    id: 'DEAD-02',
    category: 'Código Muerto',
    title: 'Eliminación de Funciones Zombie, Archivos Obsoletos y Ramas Muertas',
    prompt: `Actúa como un Ingeniero de Refactorización y Limpieza de Deuda Técnica.
Tu objetivo exclusivo es erradicar código zombie:
1. Archivos .ts, .tsx, .rs o .java que estén completamente desconectados del árbol de imports o del bundle de compilación.
2. Ramas de ejecución inalcanzables (unreachable code en condicionales 'if (false)', switches con casos muertos o early returns que bloquean código posterior).
3. Variables y parámetros declarados pero nunca leídos.
4. Helpers y utilidades duplicadas que puedan consolidarse en una única función pura.
Elimina los archivos y bloques muertos garantizando que los tests y compilación pasen sin errores.`
  },
  {
    id: 'BUG-01',
    category: 'Bugs & Concurrencia',
    title: 'Auditoría de Concurrencia, Race Conditions y Bloqueos de Base de Datos',
    prompt: `Actúa como un Especialista en Sistemas Concurrentes y Bases de Datos de Alto Rendimiento.
Tu objetivo exclusivo es encontrar y corregir condiciones de carrera (race conditions):
1. SQLite Concurrency: asegurar que conexiones SQLite concurrentes tengan 'timeout >= 30.0s' y modo WAL habilitado con checkpoints adecuados para prevenir 'database is locked'.
2. Locks en Rust/C++: auditar Mutex y RwLock para prevenir deadlocks o liberación prematura de guardias (MutexGuard) mientras hilos en segundo plano observan el estado de procesos.
3. Mutaciones asíncronas en frontend: auditar hooks de React y Zustand donde múltiples llamadas concurrentes o clics rápidos puedan desincronizar el estado del cliente.
Implementa mecanismos de bloqueo atómico, transacciones protegidas o mutex adecuados.`
  },
  {
    id: 'BUG-02',
    category: 'Bugs & Concurrencia',
    title: 'Detección de Fugas de Memoria, Sockets Huérfanos y Ciclo de Vida de Recursos',
    prompt: `Actúa como un Diagnosticador de Fugas de Memoria (Memory Leak Specialist).
Tu objetivo exclusivo es auditar la retención indebida de recursos:
1. Event listeners agregados al DOM o proceso que carezcan de su correspondiente 'removeEventListener' en funciones de cleanup de useEffect.
2. Timers e intervalos ('setInterval', 'setTimeout') que no se cancelen al desmontar componentes o detener procesos.
3. Conexiones WebSocket, sockets TCP o handles de archivos que permanezcan abiertos tras errores o cierres inesperados.
4. Descriptores de procesos hijos huérfanos sin llamada a .wait() / .try_wait().
Aplica los parches de cleanup correspondientes en cada ciclo de vida.`
  },
  {
    id: 'BUG-03',
    category: 'Bugs & Concurrencia',
    title: 'Tratamiento de Excepciones Silenciadas, Unwraps Inseguros y Resiliencia UI',
    prompt: `Actúa como un Ingeniero de Resiliencia de Software y Manejo de Errores.
Tu objetivo exclusivo es erradicar fallos no controlados:
1. Rust: busca .unwrap() o .expect() en caminos de ejecución normales donde una entrada inválida pueda provocar un 'panic!'. Reemplázalos con manejo idiomático '?' o 'match' devolviendo errores estructurados.
2. TypeScript: busca bloques 'catch (e) {}' vacíos que silencien fallos críticos sin logging ni recuperación.
3. UI: asegura que componentes propensos a fallos o renderizado dinámico estén envueltos en ErrorBoundaries funcionales para prevenir pantallas blancas de la muerte.
4. Promise Rejections: detecta promesas asíncronas sin '.catch()' o bloque try/catch en funciones 'async'.
Implementa logging contextual y recuperación elegante en cada caso.`
  },
  {
    id: 'BUG-04',
    category: 'Bugs & Concurrencia',
    title: 'Robustez de Tipado, Esquemas Zod y Deserialización Insegura',
    prompt: `Actúa como un Arquitecto de Tipado Estricto y Validación de Datos.
Tu objetivo exclusivo es auditar las fronteras de deserialización:
1. Detección y eliminación de tipos 'any' o conversiones forzadas 'as unknown as T' que oculten incompatibilidades de tipos.
2. Validación de esquemas en endpoints API: todo payload recibido debe validarse estrictamente con Zod schemas (safeParse) antes de ser consumido por la lógica de negocio.
3. Deserialización JSON / NBT: en el backend Rust o TypeScript, asegurar que deserializaciones no fallen con panic si faltan campos opcionales o vienen con tipos inesperados.
Añade esquemas robustos y tipado exhaustivo.`
  },
  {
    id: 'QUAL-01',
    category: 'Calidad & Smells',
    title: 'Refactorización de Complejidad Cognitiva (>15) y Reglas SonarQube',
    prompt: `Actúa como un Arquitecto de Calidad de Código y Estándares SonarQube / Oxlint.
Tu objetivo exclusivo es desmantelar monolitos y deuda técnica:
1. Complejidad Cognitiva > 15 (Regla SonarQube S3776): detecta funciones monolíticas y extráelas en funciones puras, Feature Hooks o lookup tables desacopladas con early returns.
2. Cero Strings Duplicados (Regla S1192): extrae cadenas repetidas >= 3 veces a constantes o enums semánticos.
3. Keys estables en listas (React S6479): elimina 'key={index}' en listas mutables y asigna identificadores únicos estables.
4. Pureza de Hooks: verificar que funciones sin estado o ciclo de vida no sean emuladas como hooks falsos y vivan como utilidades puras.
Refactoriza el código reduciendo la complejidad a <= 15 manteniendo el comportamiento 100% idéntico.`
  }
];

async function julesFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'x-goog-api-key': API_KEY,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Jules API Error (${res.status} ${res.statusText}): ${errorText}`);
  }

  return res.json();
}

async function getSources() {
  const data = await julesFetch('/sources');
  return data.sources || [];
}

async function listSessions() {
  const data = await julesFetch('/sessions');
  return data.sessions || [];
}

async function dispatchAgent(source, branch, spec, requirePlanApproval = true) {
  const payload = {
    title: `[${spec.id}] ${spec.title}`,
    prompt: spec.prompt,
    sourceContext: {
      source: source.name,
      githubRepoContext: {
        startingBranch: branch
      }
    },
    requirePlanApproval: requirePlanApproval
  };

  return await julesFetch('/sessions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isStatus = args.includes('--status');
  const isDispatch = args.includes('--dispatch');
  const noApproval = args.includes('--no-approval');
  
  const repoFilterIdx = args.indexOf('--repo');
  const repoFilter = repoFilterIdx !== -1 ? args[repoFilterIdx + 1]?.toLowerCase() : 'crystaltides-launcher-lite';

  console.log('\x1b[36m============================================================\x1b[0m');
  console.log('\x1b[1m\x1b[34m🚀 JULES SWARM — CRYSTALTIDES LAUNCHER LITE\x1b[0m');
  console.log('\x1b[36m============================================================\x1b[0m\n');

  if (isStatus) {
    console.log('Consultando estado de sesiones en Google Jules...\n');
    try {
      const sessions = await listSessions();
      if (sessions.length === 0) {
        console.log('No hay sesiones activas en este momento.');
        return;
      }
      console.log(`Encontradas ${sessions.length} sesiones:\n`);
      for (const s of sessions) {
        const stateColor = s.state === 'COMPLETED' ? '\x1b[32m' : s.state === 'FAILED' ? '\x1b[31m' : '\x1b[33m';
        console.log(`• [${stateColor}${s.state || 'UNKNOWN'}\x1b[0m] ${s.title || s.name}`);
        console.log(`  ID: ${s.id || s.name} | Creado: ${s.createTime || 'N/A'}`);
        if (s.url) console.log(`  Link: ${s.url}`);
        console.log('');
      }
    } catch (err) {
      console.error('\x1b[31mError al consultar sesiones:\x1b[0m', err.message);
    }
    return;
  }

  const allSources = await getSources();
  let targetSources = allSources;

  if (repoFilter && repoFilter !== 'all') {
    targetSources = allSources.filter(s => (s.id || s.name).toLowerCase().includes(repoFilter));
  }

  if (targetSources.length === 0) {
    console.log('\x1b[33mNo se encontraron repositorios que coincidan con el filtro.\x1b[0m');
    console.log('Repositorios disponibles:');
    allSources.forEach(s => console.log(`  - ${s.id || s.name}`));
    return;
  }

  console.log(`Repositorios objetivo identificados (${targetSources.length}):`);
  targetSources.forEach(s => {
    const branch = s.githubRepo?.defaultBranch?.displayName || 'main';
    console.log(`  📁 \x1b[1m${s.id || s.name}\x1b[0m (branch: ${branch})`);
  });
  console.log('');

  if (isDryRun) {
    console.log('\x1b[33m--- SIMULACIÓN DE DESPACHO (--dry-run) ---\x1b[0m\n');
    for (const source of targetSources) {
      const repoName = source.id || source.name;
      const branch = source.githubRepo?.defaultBranch?.displayName || 'main';
      console.log(`\x1b[1m\x1b[35m=== Repositorio: ${repoName} (Branch: ${branch}) ===\x1b[0m`);
      for (const spec of JULES_10_AGENT_SPECS) {
        console.log(`  🤖 [${spec.id}] [${spec.category}] ${spec.title}`);
      }
      console.log('');
    }
    return;
  }

  if (isDispatch) {
    console.log('\x1b[32mIniciando despacho de sesiones en Google Jules...\x1b[0m');
    console.log(`Aprobación de plan requerida: \x1b[1m${!noApproval}\x1b[0m\n`);

    for (const source of targetSources) {
      const repoName = source.id || source.name;
      const branch = source.githubRepo?.defaultBranch?.displayName || 'main';
      console.log(`\x1b[1m\x1b[34m>> Despachando 10 agentes hacia ${repoName}...\x1b[0m`);

      for (const spec of JULES_10_AGENT_SPECS) {
        process.stdout.write(`   → Despachando [${spec.id}] ${spec.title.slice(0, 45)}... `);
        try {
          const session = await dispatchAgent(source, branch, spec, !noApproval);
          console.log(`\x1b[32mOK\x1b[0m (Session: ${session.id || session.name})`);
          if (session.url) console.log(`     Link: ${session.url}`);
        } catch (err) {
          console.log(`\x1b[31mFALLÓ\x1b[0m (${err.message})`);
        }
        await new Promise(r => setTimeout(r, 1500));
      }
      console.log('');
    }

    console.log('\x1b[32m✔ Despacho finalizado. Monitorea con: node scripts/jules_orchestrator.mjs --status\x1b[0m');
  }
}

main().catch(err => {
  console.error('\x1b[31m[ERROR FATAL]:\x1b[0m', err);
  process.exit(1);
});

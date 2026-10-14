#!/usr/bin/env node
/**
 * Jules Orchestrator — CrystalTides SMP Multi-Agent Deployment
 * 
 * Despliega y coordina 10 agentes especializados de Google Jules por repositorio
 * para auditoría continua de Bugs, Código Muerto y Fallos de Seguridad.
 */

import fs from 'node:fs';

const API_BASE = 'https://jules.googleapis.com/v1alpha';

// Recuperar API Key desde entorno o fallback a mcp_config.json
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

// Las 10 Directivas Exploratorias de Caza Autónoma de Bugs
export const JULES_10_AGENT_SPECS = [
  {
    id: 'HUNT-UI-01',
    category: 'Búsqueda de Bugs',
    title: 'Exploración Autónoma de Bugs en Frontend, Estado y Ciclos de Vida',
    prompt: `Actúa como un Cazador Autónomo de Bugs e Ingeniero de Fiabilidad de Frontend.
Tu misión es explorar libremente el código de frontend (React, TypeScript, stores de estado Zustand, hooks e interfaces de usuario) en busca de fallos reales:
1. Explora el código fuente y las rutas de renderizado buscando condiciones de carrera en el estado, desincronizaciones de UI, o efectos secundarios (useEffect) con dependencias incorrectas o llamadas cíclicas.
2. Identifica listeners de eventos, sockets o timers que queden huérfanos o provoquen fugas de memoria por falta de cleanup al desmontar componentes.
3. Examina las transiciones de estado complejas (ej. login, descarga, lanzamiento del juego, carga de instancias) buscando estados de congelamiento o bloqueos visuales ("pantallas en blanco").
4. Si el entorno lo permite, ejecuta las herramientas de verificación del proyecto ('npm test', 'npm run lint' o chequeo de tipos con tsc).
5. Si descubres un fallo concreto o comportamiento anómalo, documenta claramente la evidencia, diseña la solución mínima y aplica el parche asegurando que la UI sea resiliente.`
  },
  {
    id: 'HUNT-RUST-02',
    category: 'Búsqueda de Bugs',
    title: 'Caza Autónoma de Bugs en Backend Rust, Concurrencia y Procesos',
    prompt: `Actúa como un Cazador Autónomo de Bugs e Ingeniero de Sistemas en Rust.
Tu misión es explorar libremente el backend nativo (Tauri, Rust, IPC y gestión de procesos del sistema) en busca de fallos reales:
1. Explora el código en src-tauri/ y analiza el uso de primitivas de sincronización (Mutex, RwLock, Arc, canales mpsc). Busca posibles situaciones de deadlock, contención indebida o liberación prematura de guardias (MutexGuard).
2. Analiza el ciclo de vida de procesos hijos y threads en segundo plano: verifica que no queden procesos zombis o huérfanos y que el sondeo de procesos se realice sin condiciones de carrera.
3. Busca llamadas a .unwrap() o .expect() en caminos de ejecución normales que puedan causar un panic! en caso de errores de I/O, rutas inexistentes o payloads inesperados.
4. Si el entorno lo permite, ejecuta 'cargo check' o 'cargo test' para observar advertencias del compilador o fallos de tests.
5. Si descubres un fallo o riesgo real de pánico/bloqueo, formula la solución idiomática en Rust y aplica el parche preservando la robustez del sistema.`
  },
  {
    id: 'HUNT-DEAD-03',
    category: 'Código Muerto',
    title: 'Auditoría Exploratoria de Código Muerto, Dependencias y Exports Huérfanos',
    prompt: `Actúa como un Especialista en Higiene de Código y Poda de Código Muerto.
Tu misión es explorar todo el repositorio para identificar y erradicar código zombie y redundante:
1. Explora las carpetas del proyecto buscando archivos fuente, utilidades o componentes completamente desconectados del árbol de importaciones o bundles de compilación.
2. Identifica funciones, interfaces, constantes y tipos exportados que no tengan ningún consumidor en el código base.
3. Revisa package.json y Cargo.toml buscando dependencias declaradas que nunca se importen o utilicen.
4. Detecta ramas condicionales inalcanzables (código muerto detrás de condiciones siempre falsas o retornos tempranos).
5. Poda de forma limpia y segura el código muerto garantizando que el build, los tipos y los tests sigan funcionando al 100%.`
  },
  {
    id: 'HUNT-PROFILE-04',
    category: 'Perfiles y Estado',
    title: 'Caza de Bugs en Gestión de Perfiles, Cuentas y Sincronización Local',
    prompt: `Actúa como un Cazador Autónomo de Bugs enfocado en Gestión de Perfiles y Cuentas de Usuario.
Tu misión es explorar libremente los módulos de perfil de jugador, sincronización de cuentas y persistencia de configuración:
1. Explora el código que gestiona los perfiles locales (ProfileStore, AccountManager, selección de avatares, skins y cuentas activas).
2. Analiza qué ocurre cuando un perfil se corrompe, se borra o contiene datos inconsistentes (ej. nombres inválidos, UUIDs ausentes, estados no sincronizados).
3. Revisa la sincronización entre el estado global de cuentas y los componentes de la interfaz de usuario.
4. Identifica estados donde un perfil activo no se actualice correctamente en la UI tras un cambio de configuración o cierre de sesión.
5. Si descubres un fallo o desajuste en la gestión de perfiles, formula la solución mínima y aplica el parche asegurando la consistencia del sistema.`
  },
  {
    id: 'HUNT-FAIL-05',
    category: 'Resiliencia ante Fallos',
    title: 'Caza de Excepciones Silenciadas, Fallos de Red y Recuperación ante Errores',
    prompt: `Actúa como un Ingeniero de Resiliencia de Software y Confiabilidad ante Fallos.
Tu misión es explorar cómo reacciona la aplicación ante fallos y condiciones adversas:
1. Explora el código buscando bloques 'catch' vacíos o excepciones silenciadas que oculten errores críticos y dejen la aplicación en un estado zombi o inconsistente.
2. Analiza las llamadas a APIs externas, descargas de recursos o conexiones de red: busca qué ocurre si la red se cae, devuelve códigos 5xx o datos incompletos. ¿Tiene timeouts adecuados y reintentos o mensajes claros al usuario?
3. Revisa la resiliencia en la interfaz: verifica si existen ErrorBoundaries o límites de captura que eviten el colapso total de la aplicación ante errores de renderizado.
4. Si encuentras caminos de ejecución propensos a fallos no recuperados, implementa manejo de errores estructurado con logging y recuperación elegante.`
  },
  {
    id: 'HUNT-DATA-06',
    category: 'Integridad de Datos',
    title: 'Exploración de Validación de Entradas, Esquemas y Persistencia Local',
    prompt: `Actúa como un Ingeniero de Integridad de Datos y Validación de Esquemas.
Tu misión es explorar la persistencia local y el intercambio de datos entre frontend y backend:
1. Explora el almacenamiento local (SQLite, JSON, configuraciones locales, perfiles de juego): busca posibles inconsistencias, escrituras no atómicas o lecturas que no validen la integridad del archivo.
2. Analiza las consultas a base de datos y verifica que todas las operaciones usen consultas parametrizadas o bindings tipados para evitar corrupción de datos.
3. Examina la deserialización de payloads (IPC commands, llamadas HTTP, parseo de configs): comprueba si se validan los tipos con esquemas estrictos (ej. Zod o serde) o si campos inesperados/faltantes pueden romper la aplicación.
4. Normaliza y valida rutas de archivos para evitar errores al interactuar con el sistema de archivos del sistema operativo.
5. Aplica los parches de código necesarios para blindar la integridad de los datos.`
  },
  {
    id: 'HUNT-ASYNC-07',
    category: 'Fugas y Ciclos Asíncronos',
    title: 'Caza de Fugas de Recursos, Conexiones Colgadas y Ciclos Asíncronos',
    prompt: `Actúa como un Diagnosticador de Rendimiento y Gestión de Recursos.
Tu misión es explorar el consumo y liberación de recursos en la aplicación:
1. Busca conexiones de red (WebSockets, HTTP clients, sockets TCP) o manejadores de archivos abiertos que no tengan una política explícita de timeout o no se cierren en caso de fallo.
2. Identifica promesas flotantes (floating promises) o funciones asíncronas no encadenadas que puedan emitir UnhandledPromiseRejection.
3. Detecta buffers en memoria o acumuladores de eventos que crezcan indefinidamente sin mecanismo de expulsión o límite de tamaño.
4. Revisa que las tareas en background y workers se detengan limpiamente cuando la aplicación se cierra o cambia de estado.
5. Si descubres fugas o recursos colgados, implementa los mecanismos de liberación y límites correspondientes.`
  },
  {
    id: 'HUNT-TEST-08',
    category: 'Calidad & Tests',
    title: 'Exploración de Suites de Pruebas, Casos Límite y Cobertura Crítica',
    prompt: `Actúa como un Ingeniero de Calidad de Software y Testing Automatizado.
Tu misión es auditar y robustecer las suites de pruebas del proyecto:
1. Explora los tests existentes (Vitest, Jest, Cargo tests) y ejecútalos para verificar su estado actual.
2. Identifica áreas críticas de la lógica de negocio (ej. autenticación, cálculo de rutas, gestión de versiones, IPC) que carezcan de pruebas o tengan aserciones superficiales.
3. Diseña casos de prueba para valores límite (edge cases): entradas vacías, caracteres especiales, archivos inexistentes, respuestas corruptas o desconexiones súbitas.
4. Implementa las pruebas unitarias o de integración necesarias para proteger el código contra regresiones futuras.`
  },
  {
    id: 'HUNT-CLEAN-09',
    category: 'Mantenibilidad',
    title: 'Refactorización Exploratoria de Complejidad Cognitiva y Código Duplicado',
    prompt: `Actúa como un Arquitecto de Software enfocado en Calidad, Simplicidad y Mantenibilidad.
Tu misión es explorar el repositorio buscando deuda técnica y complejidad excesiva:
1. Identifica funciones monolíticas con alta complejidad cognitiva (múltiples anidaciones, condicionales en cascada, lógica mezclada) que dificulten el mantenimiento.
2. Desacopla la lógica compleja en subfunciones puras, Feature Hooks o lookup tables bien documentadas con retornos tempranos (early returns).
3. Busca bloques de lógica duplicados entre diferentes módulos y consolídalos en utilidades reutilizables.
4. Verifica que los nombres de variables, funciones e interfaces sean descriptivos y reflejen con precisión su responsabilidad única.
5. Aplica la refactorización preservando 100% el comportamiento original y asegurando que las pruebas sigan pasando.`
  },
  {
    id: 'HUNT-BUILD-10',
    category: 'Integridad de Build',
    title: 'Auditoría de Integridad en Compilación, Empaquetado y Configuración de Tipos',
    prompt: `Actúa como un Especialista en Herramientas de Compilación, Empaquetado y Tipado.
Tu misión es auditar la infraestructura de construcción y configuración del proyecto:
1. Revisa las configuraciones de compilación (tsconfig.json, vite.config.ts, Cargo.toml, tauri.conf.json) buscando flags permisivas o inconsistencias.
2. Analiza el tipado TypeScript en busca del uso innecesario de 'any' o aserciones inseguras que oculten errores en tiempo de compilación.
3. Verifica los scripts de 'package.json' y 'Cargo.toml' asegurando que comandos como build, lint y test se ejecuten de manera determinista y sin advertencias no resueltas.
4. Si el entorno lo permite, ejecuta el build de prueba para comprobar que no existan advertencias de empaquetado o discrepancias de dependencias.
5. Aplica las mejoras de configuración y tipos necesarias para asegurar una compilación limpia y robusta.`
  }
];

// Helper para llamadas a la API de Jules
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

// Obtener las fuentes de repositorios de CrystalTides
async function getCrystalTidesSources() {
  const data = await julesFetch('/sources');
  const sources = data.sources || [];
  return sources.filter(s => {
    const name = s.id || s.name || '';
    return (
      name.toLowerCase().includes('crystaltides') ||
      name.toLowerCase().includes('crystal')
    );
  });
}

// Listar sesiones activas
async function listSessions() {
  const data = await julesFetch('/sessions');
  return data.sessions || [];
}

// Despachar un agente de Jules
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

// Función principal de la CLI
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isStatus = args.includes('--status');
  const isDispatch = args.includes('--dispatch');
  const noApproval = args.includes('--no-approval');
  
  const repoFilterIdx = args.indexOf('--repo');
  const repoFilter = repoFilterIdx !== -1 ? args[repoFilterIdx + 1]?.toLowerCase() : null;

  const branchIdx = args.indexOf('--branch');
  const customBranch = branchIdx !== -1 ? args[branchIdx + 1] : null;

  const agentFilterIdx = args.indexOf('--agent');
  const agentFilter = agentFilterIdx !== -1 ? args[agentFilterIdx + 1]?.toUpperCase() : null;

  const limitIdx = args.indexOf('--limit');
  const limitCount = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : null;

  console.log('\x1b[36m============================================================\x1b[0m');
  console.log('\x1b[1m\x1b[34m🌊 JULES ORCHESTRATOR — CRYSTALTIDES SMP MULTI-AGENT SWARM\x1b[0m');
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

  const allSources = await getCrystalTidesSources();
  let targetSources = allSources;

  if (repoFilter) {
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
    const branch = customBranch || s.githubRepo?.defaultBranch?.displayName || 'main';
    console.log(`  📁 \x1b[1m${s.id || s.name}\x1b[0m (branch: ${branch})`);
  });
  console.log('');

  let specsToRun = JULES_10_AGENT_SPECS;
  if (agentFilter) {
    specsToRun = specsToRun.filter(s => s.id === agentFilter || s.id.includes(agentFilter));
  }
  if (limitCount && !isNaN(limitCount)) {
    specsToRun = specsToRun.slice(0, limitCount);
  }

  console.log(`Matriz de agentes: \x1b[1m${specsToRun.length} Agente(s) por repositorio\x1b[0m`);
  console.log(`Total de tareas a coordinar: \x1b[1m${targetSources.length * specsToRun.length} sesiones de análisis\x1b[0m\n`);

  if (!isDispatch && !isDryRun) {
    console.log('\x1b[33m[MODO SEGURO / INFORMACIÓN]\x1b[0m');
    console.log('Para ver los prompts y la matriz sin lanzar llamadas API ejecuta:');
    console.log('  \x1b[36mpnpm jules:dry-run\x1b[0m o \x1b[36mnode scripts/jules_orchestrator.mjs --dry-run\x1b[0m\n');
    console.log('Para DESPACHAR los agentes a Google Jules ejecuta:');
    console.log('  \x1b[32mnode scripts/jules_orchestrator.mjs --dispatch\x1b[0m');
    console.log('  (Opciones: \x1b[36m--repo <nombre>\x1b[0m, \x1b[36m--agent <id>\x1b[0m, \x1b[36m--branch <nombre>\x1b[0m, \x1b[36m--limit <n>\x1b[0m)\n');
    return;
  }

  if (isDryRun) {
    console.log('\x1b[33m--- SIMULACIÓN DE DESPACHO (--dry-run) ---\x1b[0m\n');
    for (const source of targetSources) {
      const repoName = source.id || source.name;
      const branch = customBranch || source.githubRepo?.defaultBranch?.displayName || 'main';
      console.log(`\x1b[1m\x1b[35m=== Repositorio: ${repoName} (Branch: ${branch}) ===\x1b[0m`);
      for (const spec of specsToRun) {
        console.log(`  🤖 [${spec.id}] [${spec.category}] ${spec.title}`);
      }
      console.log('');
    }
    console.log('\x1b[32mSimulación completada. Los agentes están listos para ser despachados.\x1b[0m');
    return;
  }

  if (isDispatch) {
    console.log('\x1b[32mIniciando despacho de sesiones en Google Jules...\x1b[0m');
    console.log(`Aprobación de plan requerida: \x1b[1m${!noApproval}\x1b[0m\n`);

    let existingSessions = [];
    try {
      existingSessions = await listSessions();
    } catch {
      // Continuar si falla la consulta previa
    }

    for (const source of targetSources) {
      const repoName = source.id || source.name;
      const branch = customBranch || source.githubRepo?.defaultBranch?.displayName || 'main';
      console.log(`\x1b[1m\x1b[34m>> Coordinando ${specsToRun.length} agente(s) hacia ${repoName} (branch: ${branch})...\x1b[0m`);

      for (const spec of specsToRun) {
        process.stdout.write(`   → [${spec.id}] ${spec.title.slice(0, 48)}... `);

        // Verificar si este agente ya está activo investigando
        const alreadyRunning = existingSessions.find(s => 
          (s.state === 'IN_PROGRESS' || s.state === 'QUEUED') && 
          s.title?.includes(`[${spec.id}]`)
        );

        if (alreadyRunning) {
          console.log(`\x1b[33mYA EN PROGRESO\x1b[0m (Session: ${alreadyRunning.id || alreadyRunning.name})`);
          if (alreadyRunning.url) console.log(`     Link: ${alreadyRunning.url}`);
          continue;
        }

        try {
          const session = await dispatchAgent(source, branch, spec, !noApproval);
          console.log(`\x1b[32mDESPACHADO\x1b[0m (Session: ${session.id || session.name})`);
          if (session.url) console.log(`     Link: ${session.url}`);
        } catch (err) {
          console.log(`\x1b[31mFALLÓ\x1b[0m (${err.message})`);
        }
        // Pacing de 1.5s entre despachos para respetar rate limits de Google API
        await new Promise(r => setTimeout(r, 1500));
      }
      console.log('');
    }

    console.log('\x1b[32m✔ Despacho finalizado. Puedes monitorear el progreso con: node scripts/jules_orchestrator.mjs --status\x1b[0m');
  }
}

main().catch(err => {
  console.error('\x1b[31m[ERROR FATAL]:\x1b[0m', err);
  process.exit(1);
});

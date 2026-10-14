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

// Las 10 Directivas Exploratorias 100% Compatibles con Google Jules (Zero AppSec Refusals)
export const JULES_10_AGENT_SPECS = [
  {
    id: 'HUNT-UI-01',
    category: 'UI & Render',
    title: 'Caza de Bugs en Ciclos de Vida, Listeners y Renderizado de UI',
    prompt: `Actúa como un Cazador Autónomo de Bugs e Ingeniero de Fiabilidad de Frontend.
Tu misión es explorar libremente los componentes de interfaz (React, TypeScript, hooks y vistas):
1. Explora el código de componentes buscando event listeners de window/document que queden huérfanos o no se limpien al desmontar componentes.
2. Identifica timers, intervalos o callbacks asíncronos que intenten actualizar estado en componentes ya desmontados.
3. Examina las transiciones complejas entre modales y vistas para asegurar que no se produzcan bloqueos visuales ni estados congelados.
4. Si el entorno lo permite, ejecuta 'npm test' o 'npm run lint' para verificar la salud del código.
5. Si descubres un fallo concreto, documenta la causa raíz y aplica la corrección mínima y limpia.`
  },
  {
    id: 'HUNT-UI-02',
    category: 'Estado & Zustand',
    title: 'Detección de Condiciones de Carrera y Desincronización en Zustand',
    prompt: `Actúa como un Especialista en Estado Global y Concurrencia de Frontend.
Tu misión es explorar los stores de estado global (Zustand, subscribers y acciones asíncronas):
1. Analiza mutaciones asíncronas concurrentes donde clics rápidos del usuario puedan dejar el store en un estado inconsistente.
2. Verifica que las transiciones de estado de descarga, lanzamiento y cierre del juego reseteen flags como isLoading o isLaunching adecuadamente.
3. Identifica selectores de Zustand que provoquen re-renderizados innecesarios o ciclos infinitos.
4. Si encuentras desincronizaciones de estado, formula la solución estructurada y aplica el parche.`
  },
  {
    id: 'HUNT-RUST-01',
    category: 'Rust & Robustez',
    title: 'Erradicación de Pánicos y Manejo Idiomático de Errores en Rust',
    prompt: `Actúa como un Cazador Autónomo de Bugs e Ingeniero de Sistemas en Rust.
Tu misión es auditar el código en src-tauri/ en busca de puntos propensos a pánico (panic!):
1. Busca llamadas a .unwrap() o .expect() en caminos normales de ejecución (parseo de configs, I/O de archivos o comandos IPC) que puedan colapsar la app ante entradas imprevistas.
2. Reemplázalos con manejo de errores idiomático en Rust usando el operador '?' y tipos Result<T, E> con mensajes de error estructurados.
3. Si el entorno lo permite, ejecuta 'cargo check' o 'cargo test' para verificar que compile limpiamente.
4. Aplica las mejoras idiomáticas preservando intacto el comportamiento esperado.`
  },
  {
    id: 'HUNT-RUST-02',
    category: 'Rust & Concurrencia',
    title: 'Auditoría de Concurrencia de Procesos, Mutex y Canales en Rust',
    prompt: `Actúa como un Ingeniero de Concurrencia y Sistemas en Rust.
Tu misión es auditar la gestión de procesos y comunicación entre threads:
1. Explora el ProcessManager y el ciclo de vida de procesos de juego (spawn, kill, polling de estado).
2. Analiza el uso de primitivas de sincronización (Mutex, RwLock, Arc) para prevenir contención excesiva o deadlocks.
3. Verifica que la observación del estado de procesos hijos no libere prematuramente punteros ni deje procesos zombis.
4. Aplica los parches de sincronización necesarios para garantizar que la gestión de procesos sea atómica y segura.`
  },
  {
    id: 'HUNT-DEAD-01',
    category: 'Código Muerto',
    title: 'Higiene de Dependencias y Poda de Paquetes Huérfanos',
    prompt: `Actúa como un Especialista en Optimización y Limpieza de Dependencias.
Tu misión es explorar package.json y Cargo.toml en busca de dependencias no utilizadas:
1. Identifica librerías y dependencias declaradas que no tengan ningún 'import' o uso en el código fuente.
2. Verifica que la remoción de dependencias no afecte scripts de build o tipados de TypeScript.
3. Poda las dependencias huérfanas garantizando que 'npm run build' y los tests sigan funcionando al 100%.`
  },
  {
    id: 'HUNT-DEAD-02',
    category: 'Código Muerto',
    title: 'Poda de Funciones Zombie, Componentes y Exports no Referenciados',
    prompt: `Actúa como un Especialista en Poda de Código Muerto y Arquitectura Limpia (Knip Standard).
Tu misión es erradicar código no utilizado en todo el proyecto:
1. Identifica funciones, tipos, interfaces y componentes exportados que carezcan de consumidores en el árbol de importaciones.
2. Busca ramas de código inalcanzables (condicionales con dead code o bloques de retorno temprano).
3. Elimina limpiamente los elementos muertos garantizando cero regresiones funcionales.`
  },
  {
    id: 'HUNT-FAIL-01',
    category: 'Resiliencia ante Fallos',
    title: 'Caza de Excepciones Silenciadas y Promesas Flotantes sin Manejo',
    prompt: `Actúa como un Ingeniero de Resiliencia de Software y Manejo de Errores.
Tu misión es explorar cómo la aplicación captura y recupera errores en tiempo de ejecución:
1. Explora el código buscando bloques 'catch (e) {}' vacíos que oculten fallos críticos sin logging ni notificación.
2. Detecta promesas flotantes (floating promises) que puedan emitir UnhandledPromiseRejection en Node o el navegador.
3. Añade logging descriptivo y mecanismos de recuperación elegante donde falten.`
  },
  {
    id: 'HUNT-FAIL-02',
    category: 'Resiliencia ante Fallos',
    title: 'Resiliencia ante Caídas de Red, Timeouts y Reintentos en Descargas',
    prompt: `Actúa como un Ingeniero de Redes y Confiabilidad en Clientes de Escritorio.
Tu misión es auditar la resiliencia en descargas de assets, metadatos y librerías del juego:
1. Revisa las peticiones HTTP y descargas de versiones: busca qué ocurre si la red tiene alta latencia, timeouts o caídas súbitas.
2. Verifica que las descargas críticas cuenten con timeouts configurados y fallbacks apropiados (ej. listas cacheadas).
3. Implementa tolerancia a fallos limpia para que la aplicación nunca quede congelada ante desconexiones.`
  },
  {
    id: 'HUNT-TEST-01',
    category: 'Calidad & Pruebas',
    title: 'Cobertura de Pruebas Unitarias en Funciones Puras y Casos Límite',
    prompt: `Actúa como un Ingeniero de Testing Automatizado y Aseguramiento de Calidad.
Tu misión es robustecer las suites de pruebas unitarias existentes (Vitest / Jest):
1. Explora los archivos de utilidades y helpers puros en src/utils/ y src/services/.
2. Identifica funciones críticas con cobertura de pruebas ausente o insuficiente.
3. Diseña e implementa tests unitarios para casos de borde (entradas vacías, caracteres especiales, límites numéricos).
4. Asegura que los nuevos tests sean deterministas, rápidos y pasen al 100%.`
  },
  {
    id: 'HUNT-CLEAN-01',
    category: 'Mantenibilidad',
    title: 'Refactorización de Funciones Monolíticas y Complejidad Cognitiva',
    prompt: `Actúa como un Arquitecto de Software enfocado en Calidad y Simplicidad.
Tu misión es explorar el repositorio buscando funciones complejas y monolíticas:
1. Localiza funciones con múltiples niveles de anidación, condicionales en cascada o responsabilidades mezcladas.
2. Extrae la lógica en subfunciones puras o lookup tables con retornos tempranos (early returns).
3. Reduce la complejidad cognitiva manteniendo exactamente el mismo comportamiento funcional y asegurando que las pruebas pasen.`
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

  const concurrencyIdx = args.indexOf('--concurrency');
  const maxConcurrency = concurrencyIdx !== -1 ? parseInt(args[concurrencyIdx + 1], 10) : 2;

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

        // Verificar límite de concurrencia para prevenir pisadas de ramas y colisiones de base commit
        const currentActiveCount = existingSessions.filter(s => 
          s.state === 'IN_PROGRESS' || s.state === 'QUEUED'
        ).length;

        if (currentActiveCount >= maxConcurrency) {
          console.log(`\x1b[33mCOLA LLENA\x1b[0m (${currentActiveCount}/${maxConcurrency} sesiones activas). Omitiendo nuevos despachos para evitar colisiones.`);
          break;
        }

        try {
          const session = await dispatchAgent(source, branch, spec, !noApproval);
          console.log(`\x1b[32mDESPACHADO\x1b[0m (Session: ${session.id || session.name})`);
          if (session.url) console.log(`     Link: ${session.url}`);
          existingSessions.push({ ...session, state: 'QUEUED', title: `[${spec.id}] ${spec.title}` });
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

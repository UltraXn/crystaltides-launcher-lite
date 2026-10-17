# Orquestador de Jules

Jules trabaja solo sobre **tareas concretas y verificables**, con **máximo 3 activas** y bajo un
guardián que rechaza lo que se sale del alcance. Todo PR pasa por CI y code review de Claude; el
merge es siempre humano.

```
CodeQL / Dependabot ──► intake ──► issue "jules" ◄── plantilla "Tarea para Jules"
                                      │
                              dispatch (cupo 3, sin pisar archivos, solo autores confiables)
                                      ▼
                               sesión de Jules ──► PR
                                                    │
                    guardián de alcance (pull_request_target) + CI
                      │ falla                       │ pasa
                      ▼                             ▼
          1ª: se devuelve el detalle a Jules     Claude code review ──► merge humano
          2ª: se cierra el PR (issue jules:failed)
```

## Piezas

| Archivo | Qué hace |
| :--- | :--- |
| `config.json` | Cupo, faltas máximas, tamaño máximo de diff, rutas prohibidas, comandos de verificación |
| `RULES.md` | Reglas que recibe Jules en cada tarea |
| `scripts/jules/intake.mjs` | Alertas de code scanning y Dependabot → issues con especificación |
| `scripts/jules/dispatch.mjs` | Issues en cola → sesiones de Jules (`AUTO_CREATE_PR`) |
| `scripts/jules/guard.mjs` | Alcance en cada push, feedback de CI, cierre del ciclo |
| `workflows/jules-orchestrator.yml` | Cada 3 h, al etiquetar issues y a mano (con `dry_run`) |
| `workflows/jules-pr-guard.yml` | Guardián de alcance; al cerrar un PR, despacha la siguiente tarea |
| `workflows/jules-ci-feedback.yml` | CI rojo → feedback a Jules; CI verde → review de Claude |
| `workflows/codeql.yml` | Fuente de alertas de code scanning |

## Ciclo de un issue

`jules` (en cola) → `jules:in-progress` (sesión lanzada) → PR con `jules:pr`
→ `jules:ready-for-review` (CI verde) → mergeado: `jules:done` y el issue se cierra.
Si falla dos veces o el PR se cierra sin mergear: `jules:failed`. Quitar esa etiqueta lo vuelve a poner en cola.

## Secrets

| Secret | Para qué | Obligatorio |
| :--- | :--- | :--- |
| `JULES_API_KEY` | Crear sesiones y devolver el feedback del CI a Jules | Sí |
| `ANTHROPIC_API_KEY` | Code review de Claude en los PRs con CI verde | Sí, para el review |
| `JULES_ALERTS_TOKEN` | PAT fine-grained con *Dependabot alerts: read*: el `GITHUB_TOKEN` de Actions no puede leer esas alertas | No (sin él solo se usan las de CodeQL) |

## Seguridad

- El repo es público: el despachador **solo** acepta issues de `OWNER`/`MEMBER`/`COLLABORATOR` o los
  que crea el propio intake. Un issue de un desconocido con la etiqueta `jules` se ignora.
- El guardián corre con `pull_request_target`: ejecuta la versión de la rama base y no el código del
  PR, así que un PR no puede desactivarlo. `scripts/jules/**` y `.github/**` son rutas prohibidas.
- El review de Claude solo puede leer el diff y comentar (`allowedTools`).

## Probar en local (sin escribir nada)

```bash
node --test scripts/jules/lib.test.mjs
GITHUB_REPOSITORY=UltraXn/crystaltides-launcher-lite GITHUB_TOKEN=$(gh auth token) node scripts/jules/dispatch.mjs --dry-run
GITHUB_REPOSITORY=UltraXn/crystaltides-launcher-lite GITHUB_TOKEN=$(gh auth token) JULES_ALERTS_TOKEN=$(gh auth token) node scripts/jules/intake.mjs --dry-run
```

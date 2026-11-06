---
id: 2026-11-06-aislamiento-opcional
titulo: "Aislamiento opcional: nivel base sin Docker y nivel aislado, con el nivel usado visible en cada veredicto"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-06
actualizada: 2026-11-06
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [sandbox, docker, agnosticismo, evidencia]
---

# Especificación: aislamiento opcional

> **Estado (2026-11-06): borrador. Solo especificación; no hay código.** Cambia una garantía actual («el código generado nunca se ejecuta en tu equipo»), así que necesita la decisión explícita del dueño antes de implementarse. Nace de `docs/informes/COMPARATIVA-DE-MERCADO.md`, `SDLC-NATIVO-FALTANTES.md` y `MADUREZ-FORGE.md`.

## 1. Contexto y Motivación

Hoy `forge run` exige Docker: sin él sale con código 4 (`core/engine-cli.js`) y la única salida es `--motor clasico`, que ejecuta sin aislamiento ni las barreras del ciclo verificado. Los informes señalan que Docker obligatorio frena la adopción (Spec Kit y OpenSpec no lo exigen) y que, aun así, el aislamiento sin red es de lo poco que FORGE hace distinto. Se quiere que Docker sea un **refuerzo**, no un requisito, sin que nadie confunda un veredicto sin aislamiento con uno aislado.

## 2. Objetivo

Dos niveles explícitos y un registro honesto del que se usó:

- **Nivel `aislado`** (el actual): pruebas en contenedor sin red.
- **Nivel `local`**: sin Docker; el ciclo corre en el equipo con las demás barreras (guardián, criterios, cadena de evidencia), avisando en cada paso.

## 3. Criterios de aceptación

- **CA-001-01** Todo veredicto y todo informe de evidencia registra `aislamiento: "aislado" | "local"`, dentro de lo que firma la cadena.
- **CA-001-02** `forge status` y la salida de `forge run`/`forge verificar` muestran el nivel en una línea visible.
- **CA-001-03** `sandbox.requerido: true` en `sdd.config.yaml` impide degradar: sin Docker, `forge run` sale con código 4 como hoy.
- **CA-001-04** Sin Docker y sin `requerido`, `forge run` avisa («sin aislamiento: el código generado se ejecuta en tu equipo») y pide confirmación en un terminal real; sin terminal, no ejecuta.
- **CA-001-05** Un veredicto `local` nunca se presenta como `aislado`: `--comprobar-evidencia` los distingue, y la puerta de CI puede exigir `aislado` (`--exigir-aislamiento`).
- **CA-001-06** El nivel `local` sigue aplicando los guardias de rutas protegidas y el rojo obligatorio; solo cambia dónde corren las pruebas.

## 4. Decisiones abiertas (del dueño)

1. ¿Se acepta el nivel `local` en absoluto? (Alternativa: Podman como segundo runtime aislado, sin nivel `local`.)
2. ¿`requerido` por defecto en proyectos nuevos (conservador) o no?
3. ¿Qué tanto se avisa en `local`: una línea o confirmación en cada ejecución?

## 5. Riesgos

- El nivel `local` ejecuta código generado por un modelo en el equipo del usuario: es el riesgo que el ciclo aislado evitaba. Mitigación: confirmación en terminal real, aviso permanente, registro del nivel y `requerido`.
- Veredictos `local` mezclados con `aislado` en la evidencia: cubierto por CA-001-01 y CA-001-05.

## 6. Fuera de alcance

Podman u otros runtimes, validar Docker real en Linux/macOS (lo hace el CI) y cambiar el motor clásico.

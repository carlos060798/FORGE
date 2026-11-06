---
id: 2026-11-06-guardian-endurecido
titulo: "Guardián endurecido: análisis por argv, falla cerrado y registro propio protegido"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-06
actualizada: 2026-11-06
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [seguridad, guardian, hooks]
---

# Especificación: guardián endurecido

> **Estado (2026-11-06): borrador.** Se implementó por instrucción del dueño («ejecuta el plan») tras la auditoría `docs/informes/SEGURIDAD-CIBER.md`. **Ninguna aprobación del dueño consta**: no se marca como aprobada. Las pruebas se escribieron antes que el código.

## 1. Contexto y Motivación

La auditoría de ciberseguridad demostró, ejecutando el hook con eventos reales, que `claude-hooks/pre-tool-guard.js` (una lista negra de regex) se esquivaba con variantes triviales de sintaxis y que el agente podía reescribir el propio hook y `.claude/settings.json`:

- **C-01** `Write` sobre `.claude/settings.json` o sobre el hook devolvía exit 0.
- **C-02** `rm -r -f /`, `rm -fr /`, `rm -rf *`, `Remove-Item -Force -Recurse C:\`, `git push origin +main` pasaban; añadir `# git push` cortaba el resto de comprobaciones.
- **C-04** `sed -i … .env`, `node -e writeFileSync`, `echo {} > tsconfig.json`, nombres 8.3 y `NotebookEdit` esquivaban la protección; la lectura de `.env` estaba permitida.
- **C-05** el nivel del CircuitBreaker se leía de un archivo escribible por el agente, se evaluaba después de salidas tempranas y usaba `startsWith`.
- **C-06** un agente «solo lectura» escribía por Bash.
- **C-07** el hook fallaba abierto (JSON ilegible o import roto ⇒ exit 0 o 1).
- **C-13** la vía heredada de `.sdd/adrs/` permitía bloquear todas las escrituras con un ADR hostil.

## 2. Objetivo

Que el guardián razone sobre argv y rutas en vez de regex sobre texto, proteja su propio registro, falle cerrado y respete el nivel del CircuitBreaker antes que cualquier salida. **Es una red de seguridad, no un límite**: la defensa principal es `permissions.deny` gestionado y el sandbox (ver `SECURITY.md`).

## 3. Criterios de aceptación

### Análisis de comandos (`core/evidencia/guardian-reglas.js`)
- **CA-001-01** Un comando se trocea en argv respetando comillas, `;`, `&&`, `||`, `|`, `$(…)`, comillas invertidas, `bash -c '…'`, comentarios y redirecciones.
- **CA-001-02** `rm` recursivo sobre la raíz, la carpeta personal, `*`, `.`, `..` o un disco se bloquea con las banderas en cualquier forma y orden; `rm -rf node_modules` sigue permitido. Lo mismo para `Remove-Item`/`rd`, `find -delete` sin filtros y `git push` forzado, de borrado, `+ref` o `:ref` (también con `git -c`), `reset --hard`, `clean -fd`.
- **CA-001-03** Escribir (redirección, `tee`, `sed -i`, `cp`, `mv`, `dd of=`, intérpretes con `-e/-c`) sobre `.env*` (salvo `.env.example|template|sample`), configuración de calidad protegida, nombres 8.3 o las rutas críticas del guardián se bloquea; leer secretos (`.env*`, clave HMAC) también.
- **CA-001-04** `escribeAlgo(cmd)` distingue lo que escribe de lo que solo lee, para los agentes de solo lectura.

### Guardián (`claude-hooks/pre-tool-guard.js`)
- **CA-002-01** Falla cerrado: JSON ilegible, entrada vacía, evento que no es objeto, error interno o módulo compartido que no carga ⇒ exit 2. Sin Node, `pre-tool-guard.sh` bloquea.
- **CA-002-02** `Write/Edit/MultiEdit/NotebookEdit` sobre `.claude/settings*.json`, `.claude/hooks/**`, `claude-hooks/**`, `.sdd/execution-level.json` y `.git/**` se bloquean (ruta relativa, absoluta o con `..`). El dueño puede editar el guardián con `FORGE_EDITAR_GUARDIAN=1` en el entorno con el que lanza Claude Code; esa variable no desbloquea secretos.
- **CA-002-03** El nivel del CircuitBreaker se evalúa antes de cualquier salida; en `sandbox` bloquea Bash y PowerShell y la escritura fuera del proyecto (con `path.relative`, no `startsWith`).
- **CA-002-04** Los avisos (`git push`, `DROP TABLE`…) no cortan la evaluación del resto.
- **CA-002-05** Un agente de solo lectura (`revisor`, `seguridad`, `critico`…) no escribe por Bash ni PowerShell, pero sí lee. Los registros (auditoría, DLQ) no guardan secretos.

### Instalación
- **CA-003-01** `forge init` copia `core/evidencia/guardian-reglas.js` a `.claude/hooks/shared/` como fuente autónoma y el hook instalado aplica las mismas reglas.

## 4. Decisiones

- **Retirada de la vía `.sdd/adrs/` (C-13):** solo valen los ADR de `.sdd/arquitectura/` con `Estado: aceptada` y sección «Patrones prohibidos».
- **Lectura de `.env` bloqueada** (antes permitida a propósito): cambia un comportamiento documentado; el dueño puede revertirlo quitando `esSecreto` de las rutas de lectura.
- **Archivos de prueba no se bloquean** en el hook (el agente `tester` los edita); la defensa es `core/ciclo/pruebas-confiables.js`.
- **No se usa `clasificarRuta` entera** del núcleo: marcaría `.sdd/`, `.github`, etc. Se reutiliza la lógica de rutas portables y `protegidos.js`.

## 5. Fuera de alcance

Separar la clave HMAC del alcance del agente (C-03: ver spec `2026-11-06-aprobaciones-con-identidad`), sandbox y cadena de suministro (C-08 a C-12), y un parser completo de bash/PowerShell: lo que no entiende, lo deja pasar a las demás capas, por eso es red de seguridad.

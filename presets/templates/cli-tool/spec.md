---
id: template-cli-tool
titulo: "CLI Tool con subcomandos, ayuda integrada y output coloreado"
tamano: pequeno
estado: borrador
creada: TEMPLATE
actualizada: TEMPLATE
autor: forge-template
etiquetas: [cli, terminal, nodejs, npm]
---

# Especificación: CLI Tool con subcomandos

## 1. Contexto y Motivación

Necesito una herramienta de línea de comandos que automatice tareas repetitivas con una interfaz clara, profesional y bien documentada. La CLI debe seguir las convenciones estándar de terminal (--help, --version, subcomandos) para que cualquier usuario de terminal la adopte sin fricción.

## 2. Objetivo

Construir una CLI en Node.js con sistema de subcomandos, ayuda integrada en cada nivel, output coloreado con indicadores visuales claros, y configuración persistente en archivo local.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Developer / DevOps | Usuario principal de la CLI | Ejecutar tareas rápido desde terminal sin memorizar flags |
| Script automatizado | CI/CD o script de shell | Invocar la CLI y parsear su output (modo JSON) |

## 4. Historias de Usuario

### HU-001: Subcomandos y navegación

**Como** usuario de la CLI  
**Quiero** poder ejecutar `mi-cli --help` para ver todos los subcomandos disponibles  
**Para** descubrir la herramienta sin leer documentación externa

**Criterios de aceptación:**
- [ ] **CA-001-01**: `mi-cli --help` imprime lista de subcomandos con descripción de una línea cada uno (P1)
- [ ] **CA-001-02**: `mi-cli <subcomando> --help` imprime ayuda específica del subcomando con sus flags (P1)
- [ ] **CA-001-03**: `mi-cli --version` imprime la versión del package.json (P1)
- [ ] **CA-001-04**: Subcomando desconocido imprime error con sugerencia de `mi-cli --help` (P1)

### HU-002: Output coloreado y legible

**Como** usuario que ejecuta la CLI en terminal  
**Quiero** ver output con colores que distingan éxito, advertencia y error  
**Para** procesar visualmente el resultado sin leer cada línea

**Criterios de aceptación:**
- [ ] **CA-002-01**: Mensajes de éxito se imprimen en verde con prefijo `✅` (P1)
- [ ] **CA-002-02**: Mensajes de error se imprimen en rojo con prefijo `❌` y van a stderr (P1)
- [ ] **CA-002-03**: Mensajes de advertencia se imprimen en amarillo con prefijo `⚠️` (P1)
- [ ] **CA-002-04**: Con flag `--no-color`, el output es texto plano sin secuencias ANSI (P2)

### HU-003: Configuración persistente

**Como** usuario recurrente de la CLI  
**Quiero** que mis preferencias se guarden entre sesiones  
**Para** no tener que pasar los mismos flags cada vez que ejecuto la CLI

**Criterios de aceptación:**
- [ ] **CA-003-01**: `mi-cli config set clave valor` guarda la configuración en `~/.mi-cli/config.json` (P1)
- [ ] **CA-003-02**: `mi-cli config get clave` muestra el valor guardado (P1)
- [ ] **CA-003-03**: `mi-cli config list` muestra toda la configuración actual (P1)
- [ ] **CA-003-04**: Si no existe `~/.mi-cli/config.json`, la CLI lo crea automáticamente en el primer uso (P1)

## 5. Escenarios de Uso

### Escenario 1: Primer uso

**Dado** que un usuario acaba de instalar la CLI con `npm install -g mi-cli`  
**Cuando** ejecuta `mi-cli --help`  
**Entonces** ve la lista de subcomandos disponibles con una descripción de cada uno  
**Y** puede empezar a usar la CLI sin leer ningún README

### Escenario 2: Error con guía

**Dado** que un usuario escribe un subcomando incorrecto  
**Cuando** ejecuta `mi-cli inventado`  
**Entonces** ve `❌ Subcomando 'inventado' no reconocido. Ejecuta 'mi-cli --help' para ver los disponibles.`  
**Y** el proceso termina con exit code 1

### Escenario 3: Scripting con JSON

**Dado** que un script de CI necesita el output de la CLI en formato parseable  
**Cuando** ejecuta `mi-cli status --json`  
**Entonces** recibe JSON válido en stdout con los datos del estado  
**Y** puede parsearlo con `| jq '.campo'`

## 6. Requisitos Funcionales

- **RF-001**: DEBE existir un punto de entrada único en `bin/mi-cli.js` registrado en `package.json#bin`
- **RF-002**: DEBEN existir al menos 3 subcomandos: `init`, `run` y `status` (o equivalentes del caso de uso real)
- **RF-003**: DEBE existir `--help` global y por subcomando
- **RF-004**: DEBE existir `--version` que lee de `package.json`
- **RF-005**: El output de error DEBE ir a `process.stderr`, no a `process.stdout`
- **RF-006**: DEBEN existir tests para cada subcomando (al menos happy path)
- **RF-007**: La CLI DEBE funcionar con `npx` sin instalación global

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Rendimiento | Tiempo de arranque de la CLI < 200ms | Medible con `time mi-cli --version` |
| Compatibilidad | Funciona en Node 18, 20 y 22 | Tests en CI |
| Distribución | `npm pack --dry-run` lista solo los archivos necesarios | Sin `node_modules`, sin tests |

## 8. Fuera de Alcance

- ❌ Interfaz gráfica o TUI (Terminal UI interactiva con curses)
- ❌ Autocompletado de shell en v1
- ❌ Soporte de Windows PowerShell (solo bash/zsh en v1)
- ❌ Actualización automática de la CLI

## 9. Criterios de Éxito Medibles

- `mi-cli --help` muestra al menos 3 subcomandos documentados
- `mi-cli --version` retorna la versión del package.json
- El exit code es `0` en éxito y `1` en error
- Los tests pasan con `npm test`

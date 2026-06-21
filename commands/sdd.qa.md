---
description: Prueba el producto en un navegador real generando casos E2E a partir de los Criterios de Aceptación de la spec activa. Va más allá de los tests unitarios: comprueba que el usuario final puede hacer lo prometido. Usa un MCP de navegador (Playwright).
allowed-tools: Read, Write, Edit, Bash
handoffs:
  - etiqueta: "Verificar contra la spec"
    comando: sdd.verificar
  - etiqueta: "Desplegar"
    comando: sdd.desplegar
---

# /sdd.qa — QA en Navegador Real

Eres el **Ingeniero de QA**. No te conformas con que los tests unitarios pasen: compruebas que el producto funciona de verdad para una persona que lo usa. Inspirado en `/qa` de gstack (navegador real, casos generados desde los requisitos).

## Requisito — MCP de navegador

Este comando usa un servidor MCP de navegador (Playwright / Chrome DevTools) para manejar un navegador real. Si no está disponible:

```bash
command -v npx >/dev/null 2>&1 && echo "npx OK"
# El MCP de Playwright se declara en .mcp.json (mcpServers.playwright).
# Si no hay MCP de navegador, degrada a tests E2E con el runner del proyecto
# (Playwright/Cypress) en vez de control interactivo.
```

Si no hay MCP ni runner E2E, informa al usuario qué falta y ofrece generar solo los **casos de prueba** (sin ejecutarlos) para que los corra él.

## PASO 1 — Cargar spec activa y perfil

```bash
PERFIL=$(grep -o '"perfil": *"[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
SPEC_FILE=".sdd/especificaciones/${SPEC_ID}/spec.md"

# Extraer los criterios de aceptación
grep -E "CA-[0-9]" "$SPEC_FILE" 2>/dev/null
```

Cada **Criterio de Aceptación** es la fuente de un caso de prueba E2E.

## PASO 2 — Determinar la URL bajo prueba

```bash
# Local (dev server) o desplegado
URL_LOCAL="http://localhost:[puerto]"   # detecta el puerto del proyecto
URL_DEPLOY=$(grep -o 'https\?://[^"]*' .sdd/estado.json 2>/dev/null | head -1)
```

Prioriza el entorno que el usuario indique. Si va a probar local, asegúrate de que el servidor de desarrollo esté arriba (o levántalo).

## PASO 3 — Generar casos de prueba desde los CAs

Por cada CA, genera un caso E2E con pasos concretos de navegador. Ejemplo a partir de `CA-001-01: POST /tareas crea una tarea con título`:

```
Caso QA-001 (cubre CA-001-01): Crear una tarea
  1. Abrir [URL]
  2. Escribir "Comprar pan" en el campo de nueva tarea
  3. Pulsar "Agregar"
  4. Esperar que "Comprar pan" aparezca en la lista
  ✓ Resultado esperado: la tarea aparece visible en la lista
```

Cubre también los **caminos de error** que los CAs definan (ej. `CA-001-05: sin título → error`).

## PASO 4 — Ejecutar en navegador real (vía MCP)

Usa las herramientas del MCP de navegador para ejecutar cada caso: navegar, rellenar campos, hacer clic, leer el DOM/screenshot, y aseverar el resultado esperado. Registra para cada caso: PASA / FALLA + evidencia (texto encontrado o screenshot).

> Regla del proyecto: verificar revisando, no abrir el navegador manualmente. El MCP automatiza el navegador; tú lees el resultado que devuelve, no haces capturas a mano.

## PASO 5 — Reportar resultados

Escribe `.sdd/especificaciones/${SPEC_ID}/qa.md` y muestra:

```
🧪 QA en navegador real — [URL]

   CA-001-01  Crear tarea            ✅ PASA
   CA-001-02  Listar ordenadas        ✅ PASA
   CA-001-03  Marcar completa         ✅ PASA
   CA-001-05  Error sin título        ✅ PASA  (mostró el mensaje esperado)
   CA-001-06  404 si no existe        ❌ FALLA (devolvió 500)

   5/6 casos pasaron · 1 fallo
```

Si hay fallos:
- **experto**: lista el CA fallido + qué se esperaba vs qué pasó.
- **guiado**: *"Probé tu producto como lo haría una persona. Casi todo funciona; encontré un detalle que falla y lo voy a arreglar antes de seguir."* — y corrige antes de continuar.

## VALIDACIÓN DE SALIDA

```bash
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
QA_FILE=".sdd/especificaciones/${SPEC_ID}/qa.md"

# Debe existir el reporte y cubrir cada CA con un caso
grep -q "QA en navegador" "$QA_FILE" 2>/dev/null || echo "FALTA: reporte de QA"
N_CAS=$(grep -cE "CA-[0-9]" ".sdd/especificaciones/${SPEC_ID}/spec.md" 2>/dev/null || echo 0)
N_CASOS=$(grep -cE "CA-[0-9]" "$QA_FILE" 2>/dev/null || echo 0)
echo "CAs en spec: $N_CAS · CAs cubiertos por QA: $N_CASOS"
```

Cada CA debe tener al menos un caso de QA. Si falta cobertura, genera los casos restantes.

---
**HOOK:** `.sdd/hooks/despues_qa.sh`

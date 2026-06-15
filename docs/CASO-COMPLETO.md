# Caso completo: app de lista de tareas desde cero

Este documento muestra un recorrido real de FORGE para un proyecto pequeño.
Cada bloque muestra qué escribe el usuario y qué hace FORGE en respuesta.

El caso usa el flujo FORGE (idea → deploy) con perfil `guiado` para un usuario no-técnico.

---

## Fase 1 — Descubrir la idea

**Usuario:**
```
/sdd "quiero una app de lista de tareas para mí solo"
```

**FORGE** (hub `/sdd`):
1. Lee `.sdd/estado.json` — no existe, proyecto sin inicializar.
2. Detecta intención FORGE ("quiero una app").
3. Llama a `/sdd.interpretar` con el texto de la idea.

---

## Fase 2 — Interpretar (`/sdd.interpretar`)

**FORGE** ejecuta internamente:
1. Activa el agente `investigador` para leer el contexto del directorio actual.
2. Hace 3 preguntas mínimas al usuario (sí/no o una palabra):
   - ¿Web en el navegador o app de escritorio? → `web`
   - ¿Con cuenta de usuario o sin login? → `sin login`
   - ¿Solo tú o quieres compartir listas? → `solo yo`
3. Genera `.sdd/ir.json`:

```json
{
  "id": "ir-todo-app-001",
  "product": {
    "name": "Mi Lista de Tareas",
    "type": "web",
    "target_users": "usuario único sin cuenta",
    "value_proposition": "Lista de tareas personal, sin registro, datos en el navegador"
  },
  "features": {
    "core": ["agregar tarea", "marcar como hecha", "eliminar tarea"],
    "nice_to_have": ["filtrar por estado", "persistencia en localStorage"]
  },
  "constraints": {
    "tech_preference": null,
    "budget": "bajo",
    "team_size": "1"
  }
}
```

**Usuario ve:**
```
Entendido. Tu app es una lista de tareas personal para el navegador, sin login.

Características principales:
  ✓ Agregar tarea
  ✓ Marcar como hecha
  ✓ Eliminar tarea
  ✓ Persistencia en localStorage (los datos quedan aunque cierres el navegador)

¿Arrancamos con el diseño? (responde sí)
```

---

## Fase 3 — Diseñar (`/sdd.diseñar`)

**Usuario:** `sí`

**FORGE** orquesta internamente:
1. Agente `product-designer` lee `ir.json` y genera `product-design.json`:
   - Pantallas P0: lista de tareas + input de nueva tarea
   - User flow: usuario abre → ve lista → agrega → marca → cierra
   - MVPscope: solo las 3 features core, sin filtros en V1
2. Agente `architecture-designer` lee `ir.json` y propone stack:
   - Frontend: HTML + CSS vanilla + JS puro (sin frameworks — proyecto de 1 persona, bajo presupuesto)
   - Backend: ninguno (datos en localStorage)
   - Deploy: GitHub Pages o Vercel (gratis)
3. Skill `critica-diseno` revisa y aprueba: no hay over-engineering.

**Usuario ve:**
```
Diseño listo:

Stack: HTML/CSS/JS vanilla — sin framework, sin backend, datos en tu navegador.
Deploy: Vercel gratis.

Una pantalla: input + lista de tareas. Simple y directo.

¿Construimos el código? (responde sí)
```

---

## Fase 4 — Especificar y Planificar

**Usuario:** `sí`

**FORGE** ejecuta `/sdd.especificar` automáticamente desde el IR + ProductDesign:
1. Genera `.sdd/especificaciones/2026-06-14-todo-app/spec.md` con criterios de aceptación:
   - CA-001: Al cargar la página, se muestran las tareas guardadas en localStorage
   - CA-002: El usuario puede agregar una tarea escribiendo en el input y presionando Enter
   - CA-003: Al hacer click en una tarea se marca como completada (tachada)
   - CA-004: El botón "×" elimina una tarea permanentemente
   - CA-005: Los cambios persisten tras recargar la página

Luego ejecuta `/sdd.planificar`:
1. Plan técnico: 1 archivo `index.html`, 1 `style.css`, 1 `app.js`
2. Agente `critico` revisa — sin riesgos identificados para este alcance
3. Presenta plan al usuario para aprobación.

**Usuario ve:**
```
Plan aprobado. 3 archivos: index.html, style.css, app.js.
Estimado: 15 minutos de implementación.

¿Implementamos? (responde sí)
```

---

## Fase 5 — Implementar (`/sdd.implementar`)

**Usuario:** `sí`

**FORGE** ejecuta `/sdd.tareas` y luego `/sdd.implementar`:
1. Genera tareas atómicas:
   - T001: Crear `index.html` con estructura base (input + ul#tasks)
   - T002: Crear `style.css` con estilos minimalistas
   - T003: Crear `app.js` con lógica CRUD + localStorage
   - T004: Conectar los tres archivos y verificar criterios de aceptación

2. Agente `desarrollador-frontend` ejecuta cada tarea en secuencia.
3. Al terminar T004, agente `tester` genera y corre tests básicos (sin navegador — valida lógica pura de `app.js`).
4. Agente `revisor` verifica que cada CA del spec esté cubierto.

**Usuario ve:**
```
Implementación completa.

✓ T001 index.html
✓ T002 style.css
✓ T003 app.js
✓ T004 integración verificada

Tests: 5/5 pasando
Spec: CA-001 ✓  CA-002 ✓  CA-003 ✓  CA-004 ✓  CA-005 ✓

¿Desplegamos? (responde sí)
```

---

## Fase 6 — Verificar y Desplegar

**Usuario:** `sí`

**FORGE** ejecuta `/sdd.verificar` y luego `/sdd.desplegar`:

1. `/sdd.verificar` hace la verificación final:
   - Lee `spec.md` y el código generado
   - Confirma que cada criterio de aceptación tiene cobertura en el código
   - Gate pasa: 0 violaciones de constitución (no hay constitución configurada en este proyecto)

2. `/sdd.desplegar` con gate duro:
   - Tests verdes ✓
   - Spec verificada ✓
   - Sin secretos en el código ✓
   - Pide confirmación explícita: **el usuario escribe "desplegar"**

3. Agente `operaciones` ejecuta:
   ```bash
   npx vercel --prod
   ```
4. Health check post-deploy: GET a la URL devuelta por Vercel, verifica HTTP 200.
5. Registra URL en `.sdd/estado.json`.

**Usuario ve:**
```
✓ Desplegado en: https://mi-lista-tareas-abc123.vercel.app

Health check: OK (142ms)

Tu app está en línea. Puedes compartir ese enlace o abrirlo en cualquier navegador.
```

---

## Resumen del flujo

| Fase | Comando FORGE | Qué produce |
|------|--------------|-------------|
| Interpretar idea | `/sdd.interpretar` | `.sdd/ir.json` |
| Diseñar producto | `/sdd.diseñar` | `product-design.json`, stack definido |
| Especificar | `/sdd.especificar` | `spec.md` con 5 criterios de aceptación |
| Planificar | `/sdd.planificar` | `plan.md`, tareas aprobadas |
| Implementar | `/sdd.implementar` | `index.html`, `style.css`, `app.js` |
| Verificar | `/sdd.verificar` | Confirmación de CAs cubiertos |
| Desplegar | `/sdd.desplegar` | URL pública + health check |

Interacciones del usuario: 5 respuestas (`sí` / `sí` / `sí` / `sí` / `desplegar`).
Todo lo técnico lo maneja FORGE.

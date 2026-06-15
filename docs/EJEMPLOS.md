# Ejemplos prácticos de FORGE

## Flujo básico: de idea a MVP

Este documento muestra cómo usar FORGE en un proyecto real.

### Ejemplo 1: App de tareas simple

**Idea:** "Necesito una aplicación web para gestionar mis tareas pendientes"

```bash
/sdd.descubrir App para gestionar tareas
# → FORGE hace preguntas rápidas:
#   • ¿Cuántas personas usan esto? (1 → tú)
#   • ¿Dónde viven los datos? (en el navegador)
#   • ¿Cuándo necesitas esto? (semana que viene)

/sdd.especificar
# → Genera una spec automáticamente

/sdd.planificar
/sdd.tareas
/sdd.implementar
# → 2-3 horas: app funcional
```

**Resultado:** App web con React + SQLite, desplegada en Vercel.

---

### Ejemplo 2: CLI para procesar datos

**Idea:** "Script que convierta CSV a JSON, filtrando filas por criterio"

```bash
/sdd crear-app "CLI para procesar CSV a JSON"
# → Genera proyecto Node.js con TypeScript

npm run dev
# → Funciona inmediatamente
```

---

## Cómo interpretar la Spec

Una spec FORGE tiene esta estructura:

```yaml
---
id: spec-001
titulo: "Autenticación de usuarios"
---

# Criterios de aceptación

## CA-001: Login con email/password
Dado un usuario registrado
Cuando introduce email + password correctos
Entonces puede acceder a su panel

## CA-002: Mensaje de error
Dado credenciales inválidas
Cuando intenta login
Entonces ve mensaje "Email o contraseña incorrectos"
```

---

## Usar el indexador

Para mapear tu proyecto:

```bash
/sdd.mapear
# Genera .sdd/mapa/simbolos.md

# Ver símbolos de un archivo
cat .sdd/mapa/simbolos.md | grep "auth"
```

---

## Más información

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Flujo completo de FORGE
- [../commands/](../commands/) — Referencia de todos los comandos
- [../agents/](../agents/) — Roles de cada agente

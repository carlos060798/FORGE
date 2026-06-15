---
generado_por: /sdd.mapear
fecha: [FECHA]
proyecto: [NOMBRE_PROYECTO]
---

# Mapa de Dependencias

Grafo de imports entre archivos. Muestra quién depende de quién y detecta acoplamientos.

Generado automáticamente por `/sdd.mapear`.

## Convención

```
archivo-a.ts
  ↳ depende: [lista de archivos que importa]
  ↳ usado por: [lista de archivos que lo importan]
  ↳ importado por: [N] archivos

[línea en blanco]

archivo-b.ts
  ↳ depende: ...
```

## Grafo

[DEPENDENCIAS AQUÍ]

Ejemplo:

```markdown
auth/login.service.ts
  ↳ depende: users/user.repo.ts, shared/logger.ts, auth/session.repo.ts
  ↳ usado por: auth/auth.controller.ts
  ↳ importado por: 1 archivo

auth/magic-link.service.ts
  ↳ depende: users/user.repo.ts, shared/email.service.ts
  ↳ usado por: auth/auth.controller.ts
  ↳ importado por: 1 archivo

users/user.service.ts
  ↳ depende: users/user.repo.ts, shared/logger.ts
  ↳ usado por: users/user.controller.ts, auth/login.service.ts
  ↳ importado por: 2 archivos

shared/logger.ts
  ↳ depende: [ninguno — es utilidad]
  ↳ usado por: 47 archivos (alto, esperado para logger)
  ↳ importado por: 47 archivos

shared/errors.ts
  ↳ depende: [ninguno — solo tipos]
  ↳ usado por: 23 archivos
  ↳ importado por: 23 archivos
```

## Análisis

### Acoplamientos detectados

| Archivo | Usos | Criticidad | Notas |
|---------|------|-----------|-------|
| shared/logger.ts | 47 | Normal | Expected — logger global |
| shared/errors.ts | 23 | Normal | Expected — tipos de error |
| users/user.repo.ts | 8 | Medio | Revisión futura: abstraer? |

### Ciclos detectados

✅ Ninguno — grafo acíclico

(Si hay ciclos: REVISAR. Son problemas de arquitectura.)

## Cómo usarlo

### Al implementar un cambio

1. Editas `users/user.repo.ts`
2. Consultas este mapa: "¿quién usa user.repo.ts?"
3. Respuesta: 8 archivos lo importan
4. Revisas si tu cambio los rompe

### Al planificar refactor

1. Ves que auth/ depende mucho de users/
2. Consideras abstraer interfaz
3. Revisas si la abstracción mejora el grafo

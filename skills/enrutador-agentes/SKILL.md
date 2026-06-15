---
description: Decide qué agente especializado activar para cada tarea según su tipo, fase y la configuración del proyecto.
---

# Skill: Enrutador de Agentes

Decide a qué agente delegar cada tarea, leyendo la config y las características de la tarea.

## Tabla de enrutamiento por defecto

| Tipo / Fase de tarea | Agente principal | Agente secundario |
|----------------------|------------------|-------------------|
| Migración de BD | asesor-datos | — |
| Tipos / interfaces / contratos | arquitecto | disenador-api |
| Schemas de API (OpenAPI/GraphQL/proto) | disenador-api | arquitecto |
| Repositorios / acceso a datos | desarrollador-backend | asesor-datos |
| Servicios / casos de uso | desarrollador-backend | — |
| Controladores / handlers / endpoints | desarrollador-backend | disenador-api |
| Validaciones de input | desarrollador-backend | seguridad |
| Componentes UI | desarrollador-frontend | — |
| Estado del cliente | desarrollador-frontend | — |
| Estilos / accesibilidad | desarrollador-frontend | — |
| Tests unitarios | tester | el agente que escribió la lógica |
| Tests de integración | tester | — |
| Tests E2E | tester | — |
| CI/CD pipelines | operaciones | — |
| Dockerfiles / IaC | operaciones | — |
| Configuración de entorno | operaciones | seguridad |
| Documentación | documentador | — |
| Revisión cruzada final | revisor | — |
| Auditoría de seguridad | seguridad | — |

## Reglas de fallback

1. Si el agente principal está **desactivado** en config:
   - Usa el secundario si existe
   - Si no, advierte al usuario:
     > ⚠️ Esta tarea requiere `[agente]` pero está desactivado.
     > Opciones: a) activarlo solo para esta tarea, b) elegir alternativa, c) saltar tarea

2. Si la tarea toca **área sensible** (auth, datos personales, pagos), añade automáticamente `seguridad` como revisor secundario.

3. Si la tarea es **crítica** (BD producción, breaking change, infraestructura), añade `revisor` como revisor secundario.

## Detección de área sensible

```python
PALABRAS_SENSIBLES = [
    'auth', 'autentic', 'autoriz', 'login', 'session', 'sesion',
    'password', 'contraseña', 'token', 'jwt', 'oauth',
    'pago', 'payment', 'card', 'tarjeta', 'stripe', 'billing',
    'pii', 'gdpr', 'lopd', 'personal data',
    'admin', 'permission', 'permiso', 'role', 'rol',
    'upload', 'download', 'file', 'archivo',
    'crypto', 'cifrar', 'encrypt', 'hash',
    'api key', 'secret', 'credential'
]
```

Si la descripción de la tarea contiene alguna → área sensible.

## Modelo recomendado por agente

Lee de `.sdd/sdd.config.yaml` la sección `agentes.[nombre].modelo`. Esta skill respeta esa elección.

Si el modelo configurado parece inadecuado:
- `arquitecto` con `haiku` → advertir: "modelo demasiado pequeño para decisiones de arquitectura"
- `seguridad` con `haiku` o `sonnet` → advertir: "auditoría de seguridad recomienda opus"
- `tester` con `opus` → advertir: "modelo más grande de lo necesario, considera sonnet"

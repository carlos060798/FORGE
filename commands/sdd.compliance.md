---
description: Genera reporte de cumplimiento regulatorio (GDPR, SOC2, ISO 27001, HIPAA) contra el estado actual del proyecto.
allowed-tools: Read, Bash
---

# /sdd.compliance — Reporte de Cumplimiento Regulatorio

## Descripción

Genera un reporte en tiempo real que diagnostica el estado de compliance del proyecto contra regulaciones internacionales (GDPR, SOC2, ISO 27001, HIPAA). Identifica gaps, asigna un nivel de riesgo y recomienda acciones concretas.

---

## Uso

```bash
/sdd.compliance
```

Sin opciones: genera reporte completo (todas las regulaciones activas).

### Opciones

```bash
/sdd.compliance --framework=gdpr              # Solo GDPR
/sdd.compliance --framework=soc2              # Solo SOC2
/sdd.compliance --framework=iso27001          # Solo ISO 27001
/sdd.compliance --framework=hipaa             # Solo HIPAA
/sdd.compliance --output=json                 # Salida en JSON (para CI/CD)
/sdd.compliance --strict                      # Reporta warnings como errores
```

---

## PASO 1: Detectar Configuración Actual

El comando comienza leyendo la configuración de tu proyecto:

### Busca en `sdd.config.yaml`:

```yaml
preset: enterprise                    # ← lean / startup / enterprise
compliance:
  enabled: true                       # ← ¿Está habilitado compliance?
  frameworks:
    - gdpr
    - soc2
    - iso27001
security:
  agente_seguridad: true             # ← ¿Está activo agente de seguridad?
  deteccion_pii: true                # ← ¿Detecta datos personales?
  encryption: aes-256                # ← Algoritmo configurado
  autenticacion: oauth2              # ← Método de autenticación
```

**Salida**:
```
✅ Configuración detectada:
   Preset: enterprise
   Frameworks activos: GDPR, SOC2, ISO 27001
   Agente de seguridad: ACTIVADO
```

### Lee la Constitución de seguridad

El comando analiza qué restricciones están configuradas en el proyecto:

```
✅ Constitución de seguridad:
   - Encriptación AES-256 de datos en reposo
   - OAuth2 para autenticación
   - Logging obligatorio de cambios sensibles
   - Detección de PII automatizada
```

### Verifica Agentes activos

```
✅ Agentes especializados:
   ✓ security_agent (detecta vulnerabilidades)
   ✓ auditor_agent (genera logs)
   ✓ documentador_agent (escribe especificaciones)
```

---

## PASO 2: Generar Reporte de Compliance

El comando evalúa cada regulación activa contra el estado actual del proyecto.

### Formato: Tabla de Cumplimiento

```
┌─────────────────────────────────────────────────────────────────┐
│ REGULACIÓN: GDPR (EU - Protección de Datos)                     │
├────────────────────┬────────┬──────────┬──────────┬─────────────┤
│ Requerimiento      │ Estado │ Evidencia│ Riesgo   │ Acción      │
├────────────────────┼────────┼──────────┼──────────┼─────────────┤
│ 1. Especificación  │   ✅   │ spec.md  │ BAJO     │ OK          │
│    clara de datos  │        │ 2.5 KB   │          │             │
│    personales      │        │          │          │             │
├────────────────────┼────────┼──────────┼──────────┼─────────────┤
│ 2. Protección de   │   ✅   │ Agente   │ BAJO     │ OK          │
│    PII            │        │ detecta  │          │             │
│                   │        │ en-code  │          │             │
├────────────────────┼────────┼──────────┼──────────┼─────────────┤
│ 3. Auditoría de    │   ✅   │ .sdd/    │ BAJO     │ OK          │
│    acceso          │        │ cambios/ │          │             │
│                   │        │ 45 items │          │             │
├────────────────────┼────────┼──────────┼──────────┼─────────────┤
│ 4. Encriptación    │   ⚠️   │ En       │ MEDIO    │ Ejecutar    │
│    de datos en     │        │ tránsito │          │ /sdd.spec   │
│    tránsito        │        │ OK, en   │          │ y mencionar │
│                   │        │ reposo?  │          │'data at rest│
├────────────────────┼────────┼──────────┼──────────┼─────────────┤
│ 5. Data            │   ⚠️   │ Política │ MEDIO    │ Agregar     │
│    Retention       │        │ no       │          │ a spec      │
│    Policy          │        │ definida │          │ "Datos se   │
│                   │        │          │          │ retienen N  │
│                   │        │          │          │ días"       │
└────────────────────┴────────┴──────────┴──────────┴─────────────┘
```

### Leyenda de Estados

| Estado | Significado | Acción |
|--------|-------------|--------|
| ✅ | Cumplimiento verificado | Ninguna — mantén el control |
| ⚠️ | Cumplimiento parcial / Gap menor | Ejecución de comando recomendado |
| ❌ | No cumple — riesgo alto | Detener cambios, ejecutar acción inmediatamente |

### Leyenda de Riesgo

| Riesgo | Impacto | Urgencia |
|--------|---------|----------|
| **BAJO** | No hay exposición inmediata | Resolver en próximo sprint |
| **MEDIO** | Exposición si auditan ahora | Resolver esta semana |
| **ALTO** | Violación clara de regulación | Resolver hoy |

---

## PASO 3: Gaps Identificados y Acciones

Para cada gap, el comando te da:

1. **Descripción clara** del problema
2. **Comando específico** a ejecutar
3. **Tiempo estimado** para resolverlo

### Ejemplo 1: GDPR — Falta definir data retention policy

```
Gap GDPR-002: Data Retention Policy no documentada

Estado: ⚠️ Riesgo MEDIO
Regulación: GDPR Art. 5 (Principios) - Los datos debe retenerse solo
            mientras sea necesario

Problema: Tu especificación menciona que almacenas emails de usuarios
          pero no dice por cuánto tiempo.

Acción:
  1. Ejecuta: /sdd.especificar
  2. Selecciona: "Actualizar especificación existente"
  3. Agrega: "Los datos de usuario se retienen 12 meses tras
     inactividad, luego se eliminan automáticamente"
  4. El agente de seguridad validará la política

Tiempo estimado: 5 minutos
```

### Ejemplo 2: SOC2 — Logging incompleto

```
Gap SOC2-CC6.2: Audit logging insuficiente

Estado: ⚠️ Riesgo ALTO
Regulación: SOC2 Trust Service Criteria CC6.2 - Se deben registrar
            cambios con quién, qué, cuándo, dónde

Problema: Tu proyecto logguea cambios de código pero no cambios de
          permisos ni acceso a bases de datos sensibles.

Acción:
  1. Ejecuta: /sdd.especificar cambios-de-permisos
  2. Declara qué permisos son "sensibles" (admin, finance, etc)
  3. El agente de auditoría agregará logging automático
  4. Verifica: /sdd.compliance --framework=soc2

Tiempo estimado: 15 minutos
```

### Ejemplo 3: ISO 27001 — Control de acceso débil

```
Gap ISO27001-A.12.1.1: Acceso sin restricción por rol

Estado: ❌ Riesgo ALTO
Regulación: ISO 27001 A.12.1.1 - Debe haber segregación de duties

Problema: Tu config permite que un usuario apruebe y ejecute su propio
          cambio. ISO 27001 requiere "least privilege" — nadie puede
          autorizar y ejecutar.

Acción:
  1. Edita: sdd.config.yaml
  2. Agraga en [security]:
     segregation_of_duties: true
     reviewer_must_differ_from_author: true
  3. Ejecuta: /sdd.implementar
  4. Verifica: /sdd.compliance --framework=iso27001

Tiempo estimado: 20 minutos
```

### Ejemplo 4: HIPAA — MFA no obligatorio

```
Gap HIPAA-A.9.4.3: Autenticación multi-factor no obligatoria

Estado: ❌ Riesgo CRÍTICO
Regulación: HIPAA Security Rule - Acceso a PHI (Protected Health Info)
            requiere MFA obligatorio

Problema: Tu config tiene autenticación OAuth2 pero MFA es opcional.
          Para HIPAA, debe ser obligatorio.

Acción:
  1. Edita: sdd.config.yaml
  2. Cambia:
     autenticacion: oauth2
     mfa: optional
     ↓↓↓
     autenticacion: oauth2
     mfa: required
  3. Ejecuta: /sdd.implementar
  4. Verifica: /sdd.compliance --framework=hipaa --strict

Tiempo estimado: 25 minutos
```

---

## PASO 4: Recomendación Final

Al terminar, el comando te da una recomendación estratégica:

### Escenario A: Preset enterprise, sin gaps

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ CUMPLIMIENTO CERTIFICADO

Preset:     enterprise
Frameworks: GDPR ✓, SOC2 ✓, ISO 27001 ✓, HIPAA ✓
Agentes:    security ✓, auditor ✓, documentador ✓
Gaps:       0

Tu proyecto está ready para auditoría. Recomendación:

1. Ejecuta /sdd.implementar antes de cada release para verificar
   que los cambios mantienen compliance
2. Revisa /sdd.compliance mensualmente para detectar nuevos gaps
3. Si hay cambio de regulación (ej: expande a mercado EU), ejecuta
   /sdd.compliance --framework=gdpr

Next: Integra en CI/CD

  gh secret set SDD_COMPLIANCE_STRICT=true
  # En tu workflow:
  /sdd.compliance --output=json --strict > compliance.json
  # Bloquea el merge si compliance falla

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Escenario B: Preset startup, algunos gaps

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CUMPLIMIENTO PARCIAL

Preset:     startup
Frameworks: GDPR ⚠️ (2 gaps), SOC2 ❌ (4 gaps)
Gaps:       6 total
Riesgo:     MEDIO-ALTO

Tu proyecto puede lanzarse, pero si auditan hoy, encontrarán issues.

Recomendación:

Opción 1 (RÁPIDO - para MVP):
  - Resuelve los gaps ALTO (3 de 6)
  - Tiempo: 1-2 horas
  - Resultado: Reduce riesgo a MEDIO

Opción 2 (COMPLETO - antes de escalar):
  - Cambia preset: startup → enterprise en sdd.config.yaml
  - Ejecuta: /sdd.compliance
  - Resuelve todos los gaps
  - Tiempo: 4-6 horas
  - Resultado: Listo para auditoría

Te recomiendo Opción 2 si:
  - Ya tienes datos de usuarios (no importa volumen)
  - Planeas levantar inversión
  - El cliente es empresa grande (fintech, healthcare)

Primeros pasos:
  sdd.config.yaml → cambiar preset a enterprise
  /sdd.compliance → ver gaps priorizados
  /sdd.implementar → ejecutar agente de seguridad

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Escenario C: Preset lean, sin compliance

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ COMPLIANCE NO CONFIGURADO

Preset:     lean
Frameworks: ninguno habilitado
Agentes:    ninguno activo
Gaps:       N/A (compliance deshabilitado)

Tu proyecto no tiene compliance integrado. Esto es OK si:
  - Es solo para interno / demo
  - No toca datos de usuarios
  - No busca inversión ni clientes empresariales

Si en el futuro necesitas compliance, cambia a:

  sdd.config.yaml:
    preset: enterprise
    compliance:
      enabled: true

Luego ejecuta:
  /sdd.compliance

El agente te guiará automáticamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Integración en CI/CD

Para bloquear merges que violen compliance:

### GitHub Actions

```yaml
name: Compliance Check
on: [pull_request]

jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run compliance check
        run: /sdd.compliance --output=json --strict > compliance.json
      - name: Block if compliance fails
        run: |
          if grep -q '"status": "fail"' compliance.json; then
            echo "❌ Compliance check failed"
            cat compliance.json
            exit 1
          fi
      - name: Upload compliance report
        uses: actions/upload-artifact@v3
        with:
          name: compliance-report
          path: compliance.json
```

### GitLab CI

```yaml
compliance_check:
  stage: test
  script:
    - /sdd.compliance --output=json --strict > compliance.json
    - |
      if grep -q '"status": "fail"' compliance.json; then
        echo "❌ Compliance check failed"
        cat compliance.json
        exit 1
      fi
  artifacts:
    paths:
      - compliance.json
```

---

## Ejemplos de salida real

### Output por terminal (legible)

```bash
$ /sdd.compliance --framework=gdpr

┌─ GDPR: Protección de Datos (EU) ────────────────────────────────┐
│                                                                   │
│ ✅ CUMPLIMIENTO: 4/5 requisitos                                  │
│                                                                   │
│ ✅ Especificación clara                                          │
│    Encontrado: .sdd/especificaciones/datos-personales.md          │
│                                                                   │
│ ✅ Protección de PII                                             │
│    Agente de seguridad detecta datos personales en código        │
│                                                                   │
│ ✅ Auditoría de acceso                                           │
│    Historial: .sdd/cambios/ (48 entradas)                        │
│                                                                   │
│ ⚠️  Data retention policy                                        │
│    NO ENCONTRADO. Acción: /sdd.especificar                      │
│                                                                   │
│ ⚠️  Encryption en reposo                                         │
│    En tránsito: ✓ (TLS 1.3)                                      │
│    En reposo: ? (revisar config de BD)                           │
│    Acción: sdd.config.yaml → [storage] encryption: aes-256      │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

RESUMEN:
  Gaps: 2 (ambos resolvibles en <30 min)
  Riesgo: MEDIO
  Recomendación: Ejecuta las 2 acciones y listo
```

### Output JSON (para máquinas)

```json
{
  "timestamp": "2026-06-13T14:23:45Z",
  "preset": "enterprise",
  "compliance_enabled": true,
  "frameworks": [
    {
      "name": "gdpr",
      "status": "partial",
      "score": 80,
      "requirements": [
        {
          "id": "GDPR-001",
          "name": "Especificación clara",
          "status": "pass",
          "evidence": "spec.md 2.5 KB"
        },
        {
          "id": "GDPR-004",
          "name": "Data retention policy",
          "status": "fail",
          "evidence": null,
          "action": "/sdd.especificar",
          "severity": "medium"
        }
      ]
    }
  ],
  "total_gaps": 3,
  "total_severity": "medium",
  "next_action": "Execute: /sdd.especificar"
}
```

---

## Troubleshooting

### "Error: sdd.config.yaml not found"

```bash
# Verifica que estés en la raíz del proyecto
ls sdd.config.yaml

# Si no existe, inicializa SDD-ES
/sdd.init --preset=enterprise
```

### "Error: .sdd/ directory is empty"

```bash
# El directorio .sdd/ debe existir con artefactos
# Genera al menos una especificación
/sdd.especificar "Sistema procesa datos de usuarios"

# Luego intenta de nuevo
/sdd.compliance
```

### "Gap reportado es falso positivo"

```bash
# Abre docs/COMPLIANCE.md para entender qué busca el agente
# Ajusta tu especificación o sdd.config.yaml según corresponda
# Si aún así es falso, reporta:
/sdd.issue "compliance-gap-false-positive"
```

---

## Resumen rápido

| Comando | Para qué | Frecuencia |
|---------|----------|-----------|
| `/sdd.compliance` | Diagnóstico completo | Semanal o antes de release |
| `/sdd.compliance --framework=gdpr` | Solo GDPR | Cuando manejes datos EU |
| `/sdd.compliance --output=json --strict` | CI/CD integration | En cada PR |
| `/sdd.compliance --framework=hipaa` | Solo HIPAA | Si es healthcare |

**Prioridad**: Resuelve gaps ALTO primero, luego MEDIO, BAJO al final.

---
description: Verifica que el código implementado cumple los criterios de aceptación de la spec. Lee código y tests, no asume.
---

# Skill: Verificador de Implementación

Cruza el código generado contra los CAs de la spec, archivo por archivo.

## Proceso

### 1. Cargar contexto

```bash
SPEC_ID=$(spec_activa)
cat ".sdd/especificaciones/${SPEC_ID}/spec.md"
```

### 2. Extraer CAs

Lista todos los criterios de aceptación con su ID y descripción.

### 3. Por cada CA

#### 3a. Buscar implementación
```bash
# Identificar archivos/funciones que deberían implementar este CA
# Usar palabras clave del CA para búsqueda fuzzy
grep -rn "[palabras clave]" --include="*.{ext}" src/
```

#### 3b. Buscar test
```bash
# ¿Existe un test que verifique este CA específicamente?
grep -rn "[descripción del CA o CA-XXX-XX]" --include="*test*" --include="*spec*"
```

#### 3c. Verificar manualmente
Lee el código encontrado y evalúa:
- ¿Implementa el comportamiento del CA?
- ¿Maneja los casos borde?
- ¿El test que lo cubre realmente valida lo que pide el CA?

#### 3d. Clasificar
- ✅ **Implementado y testeado**: hay código + test
- ⚠️ **Implementado sin test**: hay código pero no test específico
- ⚠️ **Implementado parcialmente**: cubre algunos casos pero no todos
- ❌ **No implementado**: no se encontró código que lo cubra

### 4. Verificar exclusiones

Para cada exclusión explícita de la spec:
- ¿Se respetó? (no se implementó funcionalidad fuera de scope)

### 5. Reporte

Genera tabla en `.sdd/especificaciones/{ID}/verificacion.md`:

```markdown
| CA | Descripción | Implementado | Testeado | Archivo | Test |
|----|-------------|--------------|----------|---------|------|
| CA-001-01 | [texto] | ✅ | ✅ | src/auth.ts:45 | tests/auth.test.ts:12 |
| CA-001-02 | [texto] | ⚠️ | ❌ | src/auth.ts:78 | — |
| CA-002-01 | [texto] | ❌ | — | — | — |
```

## Output

Veredicto: 
- **APROBADA**: 100% CAs implementados + tests
- **APROBADA_CON_OBSERVACIONES**: ≥95% CAs cubiertos
- **RECHAZADA**: <95% o tests fallando

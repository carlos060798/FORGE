# ADR-29: Contrato de componente opcional

> Estado: propuesta  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-27
> Spec relacionada: 2026-11-27-contrato-de-componente
> Autor: Claude (pendiente de aceptación por el dueño)
> Evidencia: plan consolidado de modos y componentes §4.1-4.2; nota del consejo C1 §2.2-2.3. Nada está implementado.

## Contexto

Las ampliaciones de Fragua exigen editar a mano listas cerradas: `PROVEEDORES`, `MODOS` y `OPERACIONES` del puerto (`core/integraciones/puerto.js:12`, `:15`, `:18`), una `OPERACIONES` homónima distinta en `core/integraciones/aprobacion.js:44`, `OPERACIONES_AUDITADAS` (`core/integraciones/auditoria.js:37`), `AGENTES_SOLO_LECTURA` (`core/evidencia/guardian-reglas.js:22`), perfiles MCP (`core/mcp/perfiles.js:19`) y de instalación (`core/instalacion/perfiles.js:14`). `CLAVES_PUERTAS` (`core/puertas/config.js:35`) es el conjunto fijo de puertas. Todo esto se ha comprobado en el código. Un componente activable desde el repo permitiría a un repo hostil ampliar permisos.

## Decisión

1. Cada componente se declara en `componentes/<id>/componente.json` **dentro del paquete**. Campos: `id`, `version`, `contrato`, `puerto`, `amplia`, `permisos{red, modelo, tope_usd_obligatorio}`, `dependencias_externas[{bin, adr, si_falta:"not_evaluable"}]`, `modos_sugeridos`.
2. Un registro único lee **solo** los manifiestos activados por el usuario (estado de usuario o `FRAGUA_COMPONENTES`), valida el esquema, falla cerrado ante cualquier error y publica listas congeladas = núcleo ∪ ampliaciones.
3. El repo solo puede **recomendar** (en `modo:`); `doctor`/`init` lo muestran y nunca lo activan.
4. `CLAVES_PUERTAS` no es ampliable: los componentes rellenan `seguridad` o `cobertura`.
5. Una operación nueva del puerto exige su entrada en `OPERACIONES_AUDITADAS` y, si escribe, en `OPERACIONES_APROBABLES` (renombre de `aprobacion.js:44`). Las genéricas (`puerto.js:24`) siguen prohibidas.
6. El veredicto final es el más estricto entre el núcleo y los componentes (`pass` < `not_evaluable` < `fail`, ADR-30). Una prueba de invariancia lo garantiza.
7. Antes de migrar cada lista se escriben pruebas de caracterización; la migración no cambia comportamiento.

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Seguir editando listas a mano | Errores, sin trazabilidad de quién amplía qué |
| Manifiesto en el repo del usuario | Un repo hostil activaría permisos |
| Plugins descargables de terceros | Cadena de suministro sin control; contradice el Principio IV |
| Abrir `CLAVES_PUERTAS` | Puertas que el juez no conoce; superficie nueva sin necesidad |

## Consecuencias

### Positivas
- Ampliaciones declaradas, revisables y versionadas con el paquete.
- La activación queda del lado del usuario.

### Negativas
- Un módulo nuevo en el arranque; toda lista cerrada pasa a depender de él.
- La migración necesita pruebas de caracterización previas (coste).

### Neutrales
- Sin componentes activos, el comportamiento es idéntico al actual.

## Cuándo revisitar

- Si se pide admitir componentes de terceros fuera del paquete.
- Si el ADR-22 se acepta y se enmienda para revisión publicada.

## Referencias

- Plan consolidado §4.1, §4.2, §5 fase 5; C1_arquitectura.md §2.2-2.3; C3_riesgo_calidad.md.
- ADR-22 (propuesta), ADR-30, ADR-32.

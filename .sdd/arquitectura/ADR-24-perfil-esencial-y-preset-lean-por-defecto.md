# ADR-24: Perfil de instalación `esencial` y preset de agentes `lean` por defecto

> Estado: propuesta (implementada en la rama `fase-2-puerta-de-entrada` por el plan MVP, 2026-11-09; pendiente de aceptación formal del dueño)  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-09
> Spec relacionada: 2026-11-09-puerta-de-entrada-solo-dev
> Autor: Claude (pendiente de aceptación por el dueño)
> No cambia ADR-09 (activación y versión) ni ADR-19 (modelos y precios configurables).

## Contexto

`core/instalacion/perfiles.js` define dos perfiles de instalación (`esencial`, 6 comandos; `completo`, los 39) y deja escrito que pasar el valor por defecto a `esencial` «es una decisión del dueño». La configuración de ejemplo afirma «preset lean por defecto» pero activa un conjunto distinto al de `presets/lean.yaml` (arquitecto y revisor con opus, documentador con haiku), así que la documentación promete una cosa y la instalación hace otra. El MVP apunta a un desarrollador solo: 39 comandos en el menú `/` y tres agentes con opus son una barrera de entrada y de coste sin beneficio para un proyecto personal.

## Decisión

Una instalación nueva sin opciones instala el perfil `esencial` y escribe un `sdd.config.yaml` cuyo bloque `agentes:` es el de `presets/lean.yaml` (seis agentes, todos en sonnet). Todo lo demás se pide de forma explícita: `--perfil completo`, `--preset startup|enterprise`, o activar agentes a mano en el YAML. Las instalaciones existentes no cambian: `forge update` solo añade o sobreescribe los archivos del perfil efectivo y nunca borra los que ya estaban.

## Alternativas consideradas

- **A. Dejar `completo` y lean solo en la documentación**: rechazada. Mantiene la contradicción y la barrera de entrada; es lo que hay hoy.
- **B. `esencial` por defecto pero el YAML de ejemplo tal cual**: rechazada. Resuelve el menú pero no el coste ni la mentira del comentario «lean por defecto».
- **C. Aplicar `aplicarPreset('lean')` siempre que no se pase `--preset`**: rechazada. `aplicarPreset` sustituye el archivo entero y conserva solo algunos bloques; el YAML de ejemplo lleva comentarios, `motor`, `sandbox`, `presupuesto` y `rutas` que las pruebas y la guía esperan. Cambiar el bloque `agentes:` del ejemplo es más simple y deja un solo archivo que leer.
- **D. `esencial` + bloque `agentes:` del ejemplo igual a lean (elegida)**: lo instalado coincide con lo documentado, el coste por defecto baja, y el camino a «todo» es una opción explícita y reversible.

## Consecuencias

### Positivas
- El primer contacto son seis comandos y una configuración barata; la documentación deja de contradecir al instalador.
- `tests/consistencia-cifras.test.js` y `docs/agents.md` ya describían lean como el preset por defecto: ahora es cierto.

### Negativas
- Quien espere los 39 comandos al instalar tiene que pedirlos. Se documenta en el mensaje final de `init`, en `PRIMEROS-15-MINUTOS.md` y en `MIGRACION-5.0.md`.
- Con lean no hay revisor ni crítico activos: la revisión la hace la persona. Es la filosofía declarada del preset.

### Neutrales
- Los comandos `aprobar`, `verificar`, `doctor` son de la CLI, no del menú `/`: el perfil no los afecta.
- Las cifras públicas (14 agentes, 39 comandos, 31 skills) no cambian: cuentan el repositorio, no la instalación.

## Cuándo revisitar

Si los usuarios piloto (Fase 3) piden de forma recurrente comandos que no están en `esencial`, se amplía el perfil con los que pidan en vez de volver a `completo`. Si lean en sonnet produce specs o planes de peor calidad medible en el dogfooding, se sube el arquitecto a opus en el ejemplo.

## Referencias

- `.sdd/especificaciones/2026-11-09-puerta-de-entrada-solo-dev/spec.md`
- `core/instalacion/perfiles.js`, `cli/comandos/instalar.js`, `configuracion-ejemplo/sdd.config.yaml`, `presets/lean.yaml`
- `docs/informes/EVALUACION-DEL-MARCO.md` (H-05 a H-07), `docs/informes/MADUREZ-FORGE.md` (hoja de ruta, punto 11)

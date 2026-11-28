# ADR-28: Modos de dos ejes que solo suben las exigencias

> Estado: propuesta (pendiente de aceptación formal del dueño)  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-27
> Spec relacionada: 2026-11-27-modos-de-riesgo-y-persona, 2026-11-27-nivel-de-garantia-en-evidencia
> Autor: Claude (pendiente de aceptación por el dueño)
> Evidencia: plan consolidado de modos (§3.1-3.2) y notas del consejo C1, C2, C3, L2. Nada de lo de abajo está implementado.

## Contexto

Fragua tiene tres presets (`presets/lean.yaml`, `startup.yaml`, `enterprise.yaml`) que escriben claves sin lector: `comportamiento.*`, `calidad.*`, `agentes.*.activo` (ver `presets/lean.yaml:54-67`, donde la propia plantilla dice «declarativa: nada la aplica») [V-código]. Por otro lado, la seguridad real ya sigue un patrón de «solo apretar» repartido por lectores: el proyecto solo añade puertas (`core/puertas/config.js:14-19`), solo baja topes de puertas (`:168-181`), solo baja el tope de gasto (`core/ciclo/config.js:439-445`) y solo sube precios (`:383-384`) [V-código]. La instalación tiene un perfil (`core/instalacion/perfiles.js`) que solo filtra comandos [V-código].

Se necesita un concepto de modo que no pueda usarse para saltarse puertas, que un repositorio ajeno no pueda rebajar y que no mezcle «quién soy» con «qué está en juego».

## Decisión

Un modo es **configuración resuelta por el motor sobre un suelo fijo**, en dos ejes independientes, y nunca baja exigencias.

1. **Nuevo módulo `core/modos/`, puro y sin E/S:**
   - `tabla.js`: constantes congeladas `SUELO_NÚCLEO` y `MÍNIMOS[riesgo]` para `prototipo < personal < mvp < producto < plataforma`.
   - `resolver.js`: `resolverModo(configProyecto, disparadores, entornoUsuario) → ExigenciasEfectivas`.
2. **Precedencia:** `SUELO_NÚCLEO` < `mínimos(modo.riesgo ∪ disparadores)` < `valores del proyecto, que solo suben`. Por campo, `efectivo = max(suelo_modo, valor_proyecto)` en el orden propio del campo. El entorno del usuario conserva su papel actual (sube topes con techo).
3. **Eje A, riesgo:** `modo.riesgo` (y `modo.datos`) en `.sdd/sdd.config.yaml`, lector estricto con lista cerrada. Fija puertas.
4. **Eje B, persona:** en el estado del usuario, fuera del repo. Fija guía, comandos, skills y agentes instalados (ampliación de `perfiles.js`). No entra en el resolver.
5. **Los lectores actuales** (`leerConfigCiclo`, `core/ciclo/config.js:366`; `leerPuertas`, `core/puertas/config.js:199`) reciben `ExigenciasEfectivas` y aplican el máximo; no se duplica la lógica.
6. **Los presets pasan a plantillas** que escriben `modo.riesgo` (`lean`→`personal`, `startup`→`mvp`, `enterprise`→`producto`); `--preset` y `--perfil` quedan como alias una versión MENOR. Toda clave de plantilla tiene lector o lleva `# declarativa`.
7. **Bajar de modo** solo con `fragua aprobar modo` (TTY, motivo, registro firmado del usuario), nunca por debajo de los disparadores. Subir es libre.
8. **Disparadores** deterministas (declarados, selector, detectores sobre manifiestos y archivos); ningún LLM decide el riesgo (Principio VI).
9. **Propiedad comprobada:** para toda combinación, `ExigenciasEfectivas ≥ SUELO_NÚCLEO` campo a campo, y monotonía entre modos.

## Alternativas consideradas

- **A. Presets como hoy, documentando qué claves no hacen nada**: rechazada porque el usuario sigue creyendo que el modo cambia puertas y no hay propiedad que impida bajar.
- **B. Un solo eje (modo = perfil de instalación + puertas)**: rechazada porque elegir «ver menos comandos» rebajaría la protección; un no técnico, que es quien más necesita puertas, sería quien menos tendría (C2).
- **C. Modo como prompt (las skills leen el modo y actúan)**: rechazada porque en el anfitrión las puertas son texto (G0) y el modo no se aplicaría por código (riesgo «modo declarado y no aplicado», gravedad alta).
- **D. Modo elegido o propuesto por el modelo según el tamaño de la tarea**: rechazada por el Principio VI; la clasificación de tamaño queda informativa.
- **E. Dos ejes resueltos por el motor sobre un suelo, que solo suben**: aceptada porque reutiliza el patrón ya probado de los lectores («solo añaden», «solo bajan topes»), es comprobable con una prueba de propiedad y separa persona de riesgo.

## Consecuencias

### Positivas
- Un repositorio hostil no puede rebajar exigencias: lo peor que consigue es el suelo.
- La propiedad del suelo es una prueba, no una promesa.
- Las claves sin lector desaparecen o se declaran como tales.

### Negativas
- Más superficie: módulo nuevo, comando `aprobar modo`, detectores y su corpus.
- Los detectores tendrán falsos negativos; hay que publicar la tasa.
- `producto` y `plataforma` quedan aceptados pero «no soportados»: hay que decirlo en cada informe.
- Cambio de opciones de `init` con un periodo de alias.

### Neutrales
- Sin `modo:` el comportamiento es el actual (`personal`).
- Los umbrales numéricos por modo quedan [NV] hasta los pilotos.

## Cuándo revisitar

- Si la prueba de propiedad no puede expresarse porque algún campo no tiene orden total (habría que partir el campo).
- Si los pilotos muestran que los usuarios bajan de modo de forma rutinaria con aprobación (la fricción no protege).
- Al soportar `producto`/`plataforma` (spec de equipos), o si aparece una firma asimétrica que cambie dónde se registra la bajada.

## Referencias

- `reports/Plan consolidado de modos y componentes Forja.md` §3.1-3.7, §5 fase 4, §7 decisiones 8-10.
- `research_notes/Consejo plan consolidado Forja/C1_arquitectura.md`, `C2_producto_personas.md`, `C3_riesgo_calidad.md`, `L2_motor_modos.md`.
- ISO/IEC 29110 (perfiles por tamaño de organización).

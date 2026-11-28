# ADR-31: Puerto de revisión propio, formato de hallazgos y motores intercambiables

> Estado: propuesta (pendiente de aceptación formal del dueño)  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-27
> Spec relacionada: 2026-11-27-componente-revision-ia (también 2026-11-27-revision-publicada)
> Autor: Claude (pendiente de aceptación por el dueño)
> Relacionada con: ADR-22 y ADR-37 (enmienda de operaciones de revisión), ADR-29 y ADR-30 (contrato de componente y de resultados, también propuestos en el plan). No cambia ADR-12, ADR-15 ni ADR-02.
> Evidencia: `Plan consolidado de modos y componentes Forja` §4.3 y §4.6; `R3_devops_revision_pr.md` §1; `C1_arquitectura.md` §2.4. Nada de lo de abajo se implementó ni se probó. **[NV]** marca lo no verificado.

## Contexto

El plan quiere un componente opcional de revisión de cambios con IA, local y consultivo (spec `componente-revision-ia`), y más adelante publicable en GitHub y GitLab (spec `revision-publicada`). Hay tres decisiones de estructura que condicionan todo lo demás:

1. **Dónde vive la revisión.** Las operaciones de plataforma ya tienen un puerto, el de integraciones (`core/integraciones/puerto.js`), con operaciones fijas y sin ninguna genérica (`puerto.js:4-9,18,24-26`). La revisión no es una operación de plataforma: es un cálculo sobre un diff que puede hacerse sin red. Mezclarla con el puerto de plataforma haría que probar el revisor exija una plataforma, y obligaría a ampliar el puerto con cosas que no son de plataforma (`C1_arquitectura.md` §2.4) [V-plan].
2. **Qué forma tiene un hallazgo.** Cada herramienta de revisión del mercado usa su propio formato de comentario; no existe estándar de benchmark (`R3` §1.2) [V-plan]. Si Forja se acopla a la salida de una herramienta, cambiar de motor rompe todo lo que consume los hallazgos (informes, publicación, evaluaciones).
3. **Qué motores caben.** El candidato abierto más cercano a «agnóstico» es PR-Agent, pero su licencia ha oscilado entre Apache 2.0, AGPL v3 y de nuevo Apache 2.0, y las fuentes consultadas discrepan: el blog de Qodo del 2026-04-23 describe esa historia, el README leído dice MIT y un listado de ecosyste.ms aún muestra AGPL-3.0 (`R3` §1.4) [V-plan; la licencia vigente es [NV]]. AGPL sería incompatible con integrarlo como código.

La constitución añade límites: dependencias nuevas solo con ADR y opcionales y perezosas (Principio IV), decisiones de control por códigos y no por el juicio de un modelo (Principio VI), nada fijado a un proveedor (Principio III) y tope de gasto duro (Principio VIII).

## Decisión

1. **Puerto propio `core/revision/`**, separado del puerto de integraciones. **Entrada:** un *diff normalizado* (lista de archivos con sus hunks, líneas añadidas y quitadas numeradas, y metadatos opcionales: título, descripción, base y cabeza; todo el texto de plataforma ya convertido en dato con `comoDato`, `core/integraciones/confianza.js:250`) [V-código para `comoDato`]. **Salida:** una lista de hallazgos y un resumen de ejecución (motor, proveedor y nivel resueltos, gasto, repeticiones, omisiones).
2. **Formato propio de hallazgo**, estable y versionado: `{ severidad, archivo, linea, regla, confianza, mensaje }` más, opcionalmente, `lineaFin`, `sugerencia` y `motor`. `severidad` toma valores de un vocabulario cerrado [POR_DECIDIR]; `confianza` es un número entre 0 y 1 o un vocabulario cerrado [POR_DECIDIR]; `regla` es un identificador estable y no texto libre. El formato lo valida un esquema; lo que no lo cumple se descarta y se cuenta.
3. **Exportación a SARIF** como vista del mismo informe: la severidad y la regla de Forja se traducen a `level` y `ruleId` del formato estándar de intercambio de resultados de análisis estático (SARIF 2.1.0 [NV: versión y correspondencia exacta de campos sin comprobar contra el esquema oficial en este borrador; `R3` §2 solo informa de que otra herramienta emite SARIF 2.1.0]). La exportación no añade ni quita hallazgos. El formato propio manda: SARIF es una forma de salida, no el modelo interno.
4. **Motores intercambiables detrás del puerto.** Un motor es un módulo con una sola función: recibe el diff normalizado y las reglas, devuelve hallazgos. Hay tres tipos permitidos:
   - **motor propio**, que llama a un proveedor de modelos por la capa existente (`core/llm-providers/`, niveles neutrales `alto`/`medio`/`economico`, `niveles.js:12,78`) sin darle ninguna herramienta, con tope duro de gasto del libro de costos común;
   - **motor `stub`**, con respuestas guionizadas, para pruebas y para evaluar las métricas sin clave ni red;
   - **motor externo opcional**, un **proceso** que el usuario ha instalado (nunca código copiado ni empaquetado en Forja), invocado con argumentos fijos, sin red desde Forja, con su salida tratada como dato no confiable y traducida al formato propio.
5. **PR-Agent solo como motor externo opcional y solo después de leer su licencia.** Antes de escribir cualquier adaptador hay que: (a) fijar un commit exacto; (b) leer el archivo `LICENSE` en ese commit y anotar su texto, hash y fecha en el ADR del binario; (c) si no es una licencia permisiva compatible, no se adapta. Cada binario externo lleva **su propio ADR** (ADR-32 en adelante, plan §6) y es opcional y perezoso (Principio IV); si falta, el motor es `not_evaluable`, nunca un aprobado. Hasta entonces, este ADR **no autoriza** ningún adaptador de PR-Agent.
6. **El puerto no tiene red ni herramientas.** Ningún motor propio recibe herramientas de red, de archivos ni de ejecución. Las integraciones de plataforma solo aportan `leerCambio` y `publicarRevision` (ADR-37) y viven en `core/integraciones/`; el revisor se prueba con el `stub` y sin plataforma.
7. **La revisión es consultiva y no entra en el veredicto.** No es un cuarto rol del ciclo y no toca `core/state-machine.js` (`C1` §2.4) [V-plan]. Produce un informe de nivel de garantía G0 y nunca cambia un `fail` en `pass`. Cumple el contrato de componente (ADR-29) y el de resultados (ADR-30), ambos todavía por redactar.
8. **Diseño anti-ruido en el puerto, no en el motor.** La verificación de hallazgos (que el archivo y la línea existan en el diff), la deduplicación, el orden por severidad y confianza y el tope de hallazgos mostrados los aplica el puerto de forma determinista, igual para cualquier motor.
9. **Las reglas del revisor se leen de la rama base o del estado del usuario, nunca del cambio revisado**, para que un diff no pueda reescribir sus propias reglas (patrón común en `R3` §1.3).

## Alternativas consideradas

- **A. Ampliar `OPERACIONES` del puerto de integraciones con una operación «revisar»**: rechazada. Mezcla un cálculo sin red con operaciones de plataforma, obliga a que probar el revisor necesite una plataforma y hace crecer una lista cerrada que `validarProveedor` exige completa en cada proveedor (`puerto.js:100-102`), incluido Jira, que no tiene solicitudes de cambio.
- **B. Adoptar el formato de salida de una herramienta existente como formato interno (incluido el de PR-Agent)**: rechazada. Ata Forja a una herramienta cuya licencia es incierta y cuyo formato no controlamos; cambiar de motor rompería informes, publicación y evaluaciones.
- **C. Usar SARIF como formato interno**: rechazada como modelo interno, aceptada como exportación. SARIF está pensado para análisis estático y no tiene campo natural para la confianza ni para metadatos de ejecución como gasto o repeticiones [NV]; un formato propio pequeño y versionado es más fácil de validar y de probar.
- **D. Integrar PR-Agent como código dentro de Forja**: rechazada. Con licencia AGPL sería incompatible; con licencia permisiva seguiría añadiendo una dependencia pesada (Python y sus dependencias) sin ADR y rompiendo el Principio IV.
- **E. Delegar la revisión en el servicio de revisión de una plataforma o de un proveedor**: no se adopta como camino principal. Sirve a un anfitrión y a una plataforma concretos, no es local ni agnóstica de proveedor y es de solo GitHub en el caso del servicio gestionado de Claude (`R3` §1.1) [V-plan]. Nada impide usarla por fuera de Forja.
- **F. Un puerto propio con formato propio, SARIF como exportación, motores intercambiables y externos solo como proceso opcional con ADR propio**: aceptada como propuesta. Aísla la decisión de licencia, permite probar sin plataforma ni modelo y mantiene el veredicto fuera del alcance del revisor.

## Consecuencias

### Positivas
- El revisor se puede probar y evaluar con el `stub`, sin plataforma, sin clave y sin red.
- Cambiar o añadir un motor no afecta a quien consume hallazgos (informe, publicación, SARIF, evaluaciones).
- La decisión sobre la licencia de PR-Agent queda aislada y reversible, y no bloquea el motor propio.
- El mismo puerto sirve a la revisión local y a la publicada, sin dar herramientas al modelo.

### Negativas
- Un formato propio hay que mantenerlo y versionarlo; añadirle campos exige una migración.
- Hay que escribir y mantener una exportación a SARIF y, si se integra, un traductor por motor externo.
- La verificación y el anti-ruido en el puerto limitan lo que un motor externo bueno puede aportar (por ejemplo, un hallazgo que apunta fuera del diff se descarta).
- Un motor externo que corre como proceso es una superficie nueva (argumentos, salida, entorno); exige su ADR y su prueba de confinamiento.

### Neutrales
- El puerto de integraciones (ADR-22) no cambia en lo que respecta al revisor; lo que cambia en él lo trata el ADR-37.
- No se añade ninguna dependencia al paquete con este ADR.

## Riesgos que esta decisión no elimina

- **Ruido y falsa confianza.** El recall publicado por terceros va del 35 al 57 % y ningún benchmark es comparable (`R3` §1.2) [V-plan]. Mitiga la medida propia con casos sembrados y N repeticiones (spec `componente-revision-ia`, HU-007), no este ADR.
- **Una aprobación mecánica** de lo que el revisor propone (ASI09, ADR-22): la vista previa ayuda, pero una persona puede aprobar sin leer.
- **Inyección por el diff.** Se mitiga con texto como dato y sin herramientas, no con detección.
- **Licencia de un motor externo cambiante.** Se mitiga leyendo el `LICENSE` en el commit fijado y registrándolo, pero un cambio posterior en el repositorio no se detecta solo [NV].

## Cuándo revisitar

- Si el formato estándar de intercambio resulta suficiente como modelo interno (con campos para confianza y ejecución) y mantener el propio cuesta más que su valor.
- Si se acepta un motor externo y su salida obliga a campos que el formato no tiene.
- Si la licencia de PR-Agent se aclara como permisiva y estable, o se confirma incompatible.
- Si el ADR-29 o el ADR-30 cambian el contrato de componente o de resultados de forma incompatible con este puerto.
- Si aparece un estándar de benchmark comparable que permita sustituir parte de la medida propia.

## Referencias

- `reports/Plan consolidado de modos y componentes Forja.md` §4.3, §4.6, §5 (fases 6 y 7), §6.
- `research_notes/Consejo plan consolidado Forja/R3_devops_revision_pr.md` §1.1 a §1.4 y `C1_arquitectura.md` §2.4.
- `.sdd/arquitectura/ADR-22-integraciones-externas-sin-herramientas-para-el-modelo.md`, `ADR-37-enmienda-adr-22-operaciones-de-revision.md`, `ADR-19-modelos-y-precios-configurables.md`.
- `core/integraciones/puerto.js:4-9,18,24-26,100-102`, `core/integraciones/confianza.js:250`, `core/llm-providers/niveles.js:12,78`.
- Especificación de SARIF (OASIS): **no leída**; la versión 2.1.0 es la que cita `R3` §2 [NV].
- Repositorio y `LICENSE` de PR-Agent: **no leídos**; la licencia vigente es [NV] y debe leerse en el commit fijado.

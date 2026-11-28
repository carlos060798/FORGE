# ADR-34: Linter y formateador

> Estado: propuesta  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-27
> Spec relacionada: ninguna (TODO diferido de la constitución); plan consolidado de modos y componentes, §6 y §7 (decisión 23)
> Autor: Claude (pendiente de aceptación por el dueño)
> Evidencia: lectura del repositorio el 2026-11-27. No se instaló ni ejecutó ninguna herramienta de estilo. Lo que se dice de herramientas de terceros viene de conocimiento general, no de una lectura de su documentación hoy: va marcado [NV].

## Contexto

La constitución dejó como TODO diferido «Elegir linter y formateador» y dice que no se inventa uno hasta decidirlo con un ADR (`.sdd/memoria/constitucion.md`, informe de sincronización y «Estándares de Calidad»). `AGENTS.md` y `CONTRIBUTING.md:101` repiten la regla, y `REVIEW.md:4` pide omitir comentarios de estilo menor porque no hay linter ni formateador.

Estado real el 2026-11-27:

- No hay configuración de linter ni de formateador en la raíz, ni `.editorconfig` ni `.gitattributes` (comprobado con `ls -a`).
- Sí hay comprobación de tipos sobre JSDoc: `npm run typecheck` ejecuta `tsc` con `checkJs` y `strict: false` sobre `core/**/*.js` (`package.json:13`, `tsconfig.json`). `cli/`, `claude-hooks/`, `scripts/` y `tests/` quedan fuera de esa comprobación (`tsconfig.json`, `include`).
- Hay pruebas de consistencia propias para cifras, agentes, skills y enlaces (`tests/consistency.test.js`, `tests/consistencia-cifras.test.js`), y una prueba que impide identificadores de modelo en el motor (especificación `2026-11-12-proveedor-no-fijado`, HU-004). Es decir, el proyecto ya resuelve reglas concretas con pruebas propias sin dependencias, en la línea del ADR-14.
- El Principio IV exige un ADR para toda dependencia nueva, también las de desarrollo; hoy las de desarrollo son `@types/node` y `typescript` (`package.json:88-91`).
- `REVIEW.md:30` dice que el guardián protege la configuración de linter, tipos, seguridad y cobertura [NV: no se leyó el código del guardián para confirmarlo]; una configuración nueva entraría en esa protección.
- El proyecto tiene un solo mantenedor (`GOVERNANCE.md:7`) y recibe cambios de agentes: un estilo mecánico reduce el trabajo de revisión, pero cada herramienta añadida es superficie de cadena de suministro y de mantenimiento.

Lo que se quiere resolver: (1) formato coherente sin discusiones de estilo, y (2) detección de errores baratos (variables sin uso, comparaciones erróneas, módulos no importados) que hoy solo se encuentran con pruebas o al leer.

## Decisión

Se propone **la opción D, escalonada**, sin añadir ninguna dependencia en este ADR:

1. **Ahora, sin dependencia:** añadir un `.editorconfig` (codificación, fin de línea, indentación, línea final) y una prueba propia de higiene que solo lea archivos: sintaxis válida de cada `.js` y `.mjs` (`node --check`, que es parte de Node), nombres de archivo en `kebab-case.js` (convención ya escrita en la constitución), sin tabuladores mezclados con espacios y sin espacios al final de línea. Las reglas de la prueba se limitan a las que se pueden decidir sin ambigüedad; lo que sea gusto no entra.
2. **Después de las fases 2 y 3 del plan consolidado, y solo si el dueño lo pide:** evaluar una **única** herramienta de desarrollo (nunca de ejecución) que haga formato y lint, con un ADR propio que reciba esta decisión como entrada. Criterios de ese ADR: una sola dependencia de desarrollo; sin dependencias transitivas pesadas o sin necesidad de scripts de instalación (`npm ci` se ejecuta hoy sin `--ignore-scripts`, `docs/informes/SEGURIDAD-CIBER.md:161`); sin requisito de Node superior a 20 para ejecutarse en CI; configuración mínima; que no formatee de golpe los archivos de la metodología en Markdown.

El primer paso cierra el TODO en lo que se puede cerrar hoy; el segundo se decide con evidencia, no por inercia.

## Alternativas consideradas

- **A. Seguir sin nada**: rechazada como destino, aceptable solo como situación actual. La constitución ya lo marca como TODO y la revisión depende de que alguien lea cada diff.
- **B. Una herramienta única de formato y lint (por ejemplo, una de las que se distribuyen como binario único)**: no se rechaza, se aplaza al paso 2. Ventajas generales: una sola dependencia de desarrollo y una sola configuración [NV: versión, tamaño y modo de distribución actuales sin comprobar]. Inconveniente: es una dependencia nueva que hay que justificar (Principio IV) y puede reformatear muchos archivos de golpe.
- **C. Linter más formateador como dos herramientas separadas, con sus plugins**: rechazada por ahora. Es la combinación con más dependencias transitivas y más configuración [NV: cifras sin medir], desproporcionada para un paquete que presume de ser ligero.
- **D. Higiene propia mínima más `.editorconfig`, y decidir la herramienta después (elegida)**: aceptada porque no añade dependencias, es reversible y entrega valor inmediato.
- **E. Endurecer `tsc` (`strict: true` y ampliar `include` a `cli/` y `claude-hooks/`)**: complementaria, no excluyente. Detecta errores reales sin dependencias, pero el volumen de errores que destaparía no se ha medido; se hace en una especificación aparte si el dueño lo quiere.

## Consecuencias

### Positivas
- Cierra el TODO diferido de la constitución sin tocar el Principio IV.
- La revisión puede dejar de mencionar el estilo en `REVIEW.md:4` para lo que la prueba ya cubra.
- Cero dependencias nuevas; funciona en Node 20.

### Negativas
- La prueba propia cubre menos que un linter de verdad; no detecta variables sin uso ni errores de lógica.
- Una regla mal elegida en la prueba bloquea la CI: hay que mantenerla corta.
- Seguirá habiendo diferencias de formato que nadie corrige de forma automática hasta el paso 2.

### Neutrales
- Habrá que enmendar la constitución y `AGENTS.md` (las frases «no hay linter ni formateador») solo cuando exista una herramienta; con el paso 1 basta añadir la mención del `.editorconfig` y de la prueba.
- La convención de commits y la herramienta de cobertura (otros TODO diferidos) no se tratan aquí.

## Cuándo revisitar

- Si en la revisión de cambios aparecen errores que un linter habría evitado, más de tres veces en un trimestre [valor propuesto, sin medir].
- Si el proyecto recibe cambios de más de un mantenedor o de contribuidores externos con regularidad.
- Si el dueño aprueba el paso 2: se redacta el ADR de la herramienta y este queda como «reemplazada-por-ADR-XX» o se acepta con nota.

## Referencias

- `.sdd/memoria/constitucion.md` (TODO diferidos, «Estándares de Calidad», Principio IV); `AGENTS.md` (Convenciones); `CONTRIBUTING.md:101`; `REVIEW.md:4`, `:30`.
- `package.json:13`, `:88-91`; `tsconfig.json`.
- ADR-14 (precedente de resolver una necesidad con código propio); especificación `2026-11-12-proveedor-no-fijado` (prueba propia que vigila una regla).
- `reports/Plan consolidado de modos y componentes Forja.md` §6, §7 (decisión 23).

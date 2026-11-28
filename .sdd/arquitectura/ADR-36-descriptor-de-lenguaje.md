# ADR-36: Descriptor declarativo de lenguaje con batería de conformidad

> Estado: propuesta (pendiente de aceptación formal del dueño)  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-27
> Spec relacionada: 2026-11-27-descriptor-de-lenguaje
> Autor: Claude (pendiente de aceptación por el dueño)
> Evidencia: lectura del código el 2026-11-27 (citas abajo) y `C1_arquitectura.md` §3 del consejo del plan. Nada de lo de abajo está implementado ni probado; lo no verificado va marcado [NV].
> Relacionada: ADR-02 (aislamiento), ADR-03 (dependencias sin red), ADR-20 (mutación propia), ADR-30 (contrato de resultados, propuesta). No cambia ninguna de ellas.

## Contexto

Lo que Fragua sabe de cada lenguaje está escrito dentro del código, repartido en cinco módulos:

| Qué | Dónde |
|---|---|
| Detección y comandos de pruebas, instalación, lint y build | `core/stack-detector.js` (una rama por lenguaje) |
| Elección del ejecutor | `core/runners/index.js:20-31` (`switch`; el `default` devuelve el ejecutor de Node) |
| Imagen base, manifiestos y lista de soportados | `core/sandbox/preparar-imagen.js:24-40` |
| Pasos de instalación en la imagen | `core/sandbox/preparar-imagen.js:111-135` (`dockerfile`) |
| Entorno del contenedor y envoltorio de Go | `core/sandbox/sandbox-runner.js:17-36,64-72` |
| Extensiones y estrategia de mutación | `core/ciclo/mutacion.js:49-58` |

Consecuencias: añadir un lenguaje exige tocar cinco archivos sin una lista que diga cuándo está terminado; el detector reconoce lenguajes que el motor no ejecuta (`stack-detector.js:10`; Rust tiene ejecutor sin imagen); Python solo se instala desde `requirements.txt` (`preparar-imagen.js:63-65`); y quien no pueda instalar su lenguaje cae, o cayó, en el ejecutor de Node. Es el mismo problema que ya se resolvió para los proveedores de modelos, donde el criterio es «sin batería de conformidad no entra» y una prueba vigila que ningún módulo fije un proveedor. La constitución pide lo mismo para el motor: sin atarse a un caso concreto, y con decisiones por código y estado.

## Decisión

**Cada lenguaje es un archivo de datos, el descriptor, que vive en el paquete y que el motor lee y valida; añadir un lenguaje es escribir un descriptor y pasar una batería de conformidad común.** Los módulos de detección, imagen, ejecución y mutación pasan a leer el descriptor y dejan de contener nombres de lenguaje.

**Ubicación y formato.** `lenguajes/<id>.json` dentro del paquete (como propone C1 §3.2). JSON, porque Node lo lee sin dependencias y el repositorio ya valida datos con esquemas cerrados escritos a mano; un formato con comentarios (YAML) obligaría a usar el lector de YAML propio del proyecto para algo que no lo necesita [NV: no se ha comparado el coste de ambos].

**Contenido mínimo** (la especificación fija el qué; el esquema exacto lo fija la implementación):

```json
{ "id": "python",
  "detectar": ["pyproject.toml", "requirements.txt"],
  "imagen": "python:3.12-slim@sha256:…",
  "manifiestos": ["requirements.txt", "uv.lock", "poetry.lock", "Pipfile.lock"],
  "instalar": { "uv": [...], "poetry": [...], "pipenv": [...], "pip": [...] },
  "probar": ["python", "-m", "pytest", "-q"],
  "entorno": { "PYTHONDONTWRITEBYTECODE": "1" },
  "codigos_prueba": { "pasa": [0], "falla": [1], "sin_pruebas": [5] },
  "mutacion": "texto" }
```

Los valores del ejemplo son ilustrativos; los reales salen de las pruebas de caracterización, no de este texto. Los comandos son listas de argumentos, nunca texto para un shell.

**Reglas de seguridad.**
1. Los descriptores solo se leen del paquete instalado. Nada que venga del proyecto analizado puede declarar o modificar un lenguaje (repositorio hostil; ADR-22 aplica el mismo criterio a las integraciones).
2. Esquema cerrado: clave desconocida, campo ausente, operador de shell en un comando o imagen sin huella de contenido (`@sha256:`) es un error que impide cargar el descriptor, con código distinto de 0.
3. La instalación de dependencias ocurre solo en la fase de preparación de la imagen, que es la única con red (ADR-03). Las pruebas siguen sin red, con raíz de solo lectura (`--network none`, `core/sandbox/politica.js:167`).
4. Sin descriptor, error con código propio (especificación `runner-falla-cerrado`): nunca se ejecuta el comando de otro lenguaje.

**Mutación.** El descriptor declara `ast`, `texto` o `no`. Con `no`, la puerta de mutación da `not_evaluable` (ADR-30), que en `mvp` o superior bloquea y nunca cuenta como aprobada. Las herramientas externas de mutación no entran en el núcleo; serían un componente opcional con su propio ADR. JavaScript hoy usa `acorn`, que ya es dependencia del paquete (`package.json:86`; ADR-20), y TypeScript que `acorn` no entiende cae a patrones de texto: el descriptor debe poder expresar «análisis sintáctico con respaldo de texto». [NV: forma exacta del valor.]

**Python por archivo de bloqueo.** El gestor se decide por el archivo de bloqueo presente (`uv.lock`, `poetry.lock`, `Pipfile.lock`) y no por la presencia de un programa. Si hay más de uno, error que los lista. Sin ninguno y con `requirements.txt`, comportamiento de hoy. En `mvp` o superior, falta de bloqueo = fallo. [NV] Que `uv` y `poetry` instalados en la imagen ejecuten las pruebas sin red y con la raíz de solo lectura; hasta comprobarlo con Docker real, «no probado».

**Migración.** (1) Pruebas de caracterización de JavaScript/TypeScript, Python y Go sobre la planificación (detección, imagen, texto del archivo de construcción, entorno, comando dividido, estrategia de mutación), sin Docker y en verde sobre el código actual. (2) Descriptores de los tres lenguajes y lectura desde los módulos, sin cambiar un valor esperado. (3) Gestores de Python. (4) Más adelante, Java con su descriptor y su batería. No se empieza hasta que la CI de Linux esté en verde (plan, fase 3).

**Batería de conformidad.** Común a todos los lenguajes: validación del esquema, detección sobre un proyecto de ejemplo, plan de imagen solo con lo declarado, comando sin operadores de shell, interpretación de los códigos de salida y desenlace «sin aislamiento» sin Docker. Un lenguaje solo figura como soportado en el README y en `docs/limitations.md` si pasa la batería y tiene una ejecución real registrada. Un descriptor de un lenguaje inventado en las pruebas demuestra que no hace falta tocar el motor.

## Alternativas consideradas

- **A. Dejar el código como está y añadir ramas por lenguaje**: rechazada. Es lo que produce hoy cinco sitios por lenguaje, el detector que sabe más que el motor y Python limitado a un formato; un lenguaje nuevo sigue sin tener criterio de «hecho».
- **B. Una interfaz de clase por lenguaje (un `Runner` con métodos para imagen, instalación y mutación)**: rechazada como camino principal. Ya existe `Runner` (`core/runners/runner.js`) y es solo el ejecutor; ampliarlo a código por lenguaje mantendría los lenguajes dentro del motor, sin validación de esquema ni forma de vigilar con una prueba que el código no los nombra. Sigue siendo la forma de la parte «ejecutar» que lee el descriptor.
- **C. Descriptores definidos por el proyecto o el usuario**: rechazada por ahora. Un repositorio hostil podría declarar una imagen o un comando; se reconsidera cuando haya una forma de firmar o acotar descriptores.
- **D. Delegar en herramientas de terceros (devcontainers, Nix, Dockerfiles del proyecto)**: rechazada. Dependencia nueva sin ADR (Principio IV) y el proyecto controlaría la imagen y la red.
- **E. Descriptor declarativo en el paquete con batería de conformidad (elegida)**: aceptada porque es el mismo patrón que ya se aplica a los proveedores, deja los lenguajes fuera del código del motor y se puede vigilar con una prueba.

## Consecuencias

### Positivas
- Añadir un lenguaje es un descriptor y su batería; «soportado» se vuelve demostrable.
- Python con `uv`, `poetry` o `pipenv` puede usar el ciclo.
- La lista de lenguajes de la documentación puede compararse automáticamente con la de los descriptores.
- La mutación imposible se dice (`not_evaluable`) en lugar de prometerse.

### Negativas
- Una migración de riesgo medio sobre el camino que ejecuta código: si la caracterización es incompleta, un cambio de comportamiento pasa inadvertido. Por eso la caracterización es el primer paso y sus valores esperados no se tocan.
- Un esquema nuevo que mantener, y los descriptores deben actualizar las huellas de las imágenes con revisión humana.
- Los envoltorios específicos (el de Go para la caché de compilación, `sandbox-runner.js:34-36`) no son datos puros: hay que decidir si caben en el esquema o quedan como un paso nombrado que el motor conoce [NV].
- El texto de ayuda y los mensajes (`SOPORTADOS`, `preparar-imagen.js:40`) pasan a generarse desde los descriptores.

### Neutrales
- No añade dependencias.
- No cambia la política de aislamiento ni los códigos de salida.
- Java y Kotlin no llegan con este ADR; llegan por este camino.

## Cuándo revisitar

- Si un lenguaje necesita lógica que no cabe en datos (más de un paso condicional, o resolución de dependencias que requiera red durante las pruebas): reconsiderar la alternativa B para esa parte.
- Si aparece una necesidad real de descriptores del proyecto o del usuario: nuevo ADR con firma o acotación.
- Si la caracterización revela diferencias entre lo que dice el código y lo que hace en Docker real: parar la migración y registrarlas.
- Si Python con `uv` o `poetry` no puede ejecutar pruebas sin red en una imagen de solo lectura: limitar el soporte a `pip` y decirlo.

## Referencias

- `core/stack-detector.js:10`, `core/runners/index.js:20-31`, `core/sandbox/preparar-imagen.js:24-40,56-72,111-135`, `core/sandbox/sandbox-runner.js:17-36,64-72`, `core/ciclo/mutacion.js:1-14,49-58`, `package.json:86`.
- `research_notes/Consejo plan consolidado Forja/C1_arquitectura.md` §3.
- `reports/Plan consolidado de modos y componentes Forja.md` §5 (fase 8) y §6 («ADR Descriptor de lenguaje»).
- `.sdd/arquitectura/ADR-02-aislamiento-con-contenedores.md`, `ADR-03-dependencias-sin-red.md`, `ADR-20-medicion-de-pruebas-por-mutacion-propia.md`, `ADR-30-contrato-de-resultados.md`.

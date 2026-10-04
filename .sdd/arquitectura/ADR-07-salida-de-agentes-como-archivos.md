# ADR-07: Salida de agentes como bloque JSON de archivos, con escritura confinada

> Estado: propuesta  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-03
> Spec relacionada: 2026-10-03-ciclo-verificado
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

En el motor headless cada agente es una llamada de completado sin herramientas: devuelve texto y no escribe archivos (`core/agent-registry.js:128-153`). Los prompts de `agents/*.md` asumen las herramientas de Claude Code. El ciclo necesita convertir esa salida en archivos de forma segura. `safeFiles` confina con `startsWith` sin separador, así que `/proy-malo` pasa como hijo de `/proy` (`core/runners/runner.js:58-63`).

## Decisión

Cada nodo con modelo añade, mediante `extraContext` (`core/agent-registry.js:133`), un "contrato de salida headless" que pide un único bloque JSON `{ "archivos": [{ "ruta", "contenido" }] }`. No se editan los agentes. `core/ciclo/protocolo-archivos.js` valida y escribe con estas reglas:

- Confinamiento con `path.relative` respecto a `cwd`; se rechazan rutas absolutas y con `..`.
- Rutas vetadas: `.git/`, `.sdd/`, `.env*` y las demás listas fijas. Desde la tercera revisión de seguridad la CLI sí pasa la lista `protecciones.no_tocar_archivos` de la configuración (`leerRutasProtegidas`), y `core/glob.js` ya no lanza con patrones mal formados ni es exponencial con `**/` repetido.
- `qa` solo puede escribir rutas de prueba; `coder` no puede tocar los archivos de `pruebas` (rechazo por ruta y por huella).
- Un cambio en un manifiesto de dependencias no se aplica: lleva a revisión humana.
- Si la salida no se puede interpretar, un reintento y después revisión.

**Ajuste tras las revisiones independientes (2026-10-03).** La lista de rutas vetadas estaba anclada a la raíz y era una lista negra incompleta. Reproducido: un agente podía escribir `sub/.git/config` con `fsmonitor = "echo …"` y `git status` lo ejecutaba en el anfitrión. Reglas actuales (`core/ciclo/protocolo-archivos.js`):

- **Vetado a cualquier profundidad, por segmento y sin distinguir mayúsculas**: `.git` (carpeta o archivo), `.sdd`, `.claude`, `node_modules`, `.ssh`, `.aws`, `.docker`, `.kube`, `secrets`, y nombres de secretos (`.env*`, `.npmrc`, `id_rsa*`, `*.pem`, `*.tfstate*`, `*key.json`, `*credentials*`, `*secret*`…). La misma lista vale para escribir, para leer contexto y para la copia de trabajo.
- **Se resuelven los enlaces**: se rechaza escribir a través de un enlace, también roto, y las reglas se aplican a la ruta real.
- **Dependencias y configuración ejecutable exigen revisión humana** (motivo `dependencias`): manifiestos y lockfiles, cualquier ruta con un segmento que empiece por punto, `conftest.py`, `*.config.*`, `Makefile`, `Dockerfile`, `CLAUDE.md`…
- Dos rutas que solo difieren en mayúsculas en un bloque: solo se escribe la primera. Un error de escritura (ruta que es un directorio) se registra como rechazo, no aborta.
- La carpeta de pruebas solo cuenta en la raíz (o `__tests__`), para que el agente de pruebas no escriba código de producción.

Sigue siendo una lista: una configuración ejecutable que no esté en ella se escribirá. No se inspecciona el contenido de los archivos permitidos.

## Alternativas consideradas

- **A. Uso de herramientas del proveedor**: rechazada porque difiere entre proveedores y el modelo local puede no soportarlo.
- **B. Bloques de código con cabecera de ruta**: rechazada por ambigua de analizar.
- **C. Diffs**: rechazada porque los modelos los producen con errores de contexto.
- **D. Bloque JSON con escritura confinada**: aceptada porque es igual para todos los proveedores y validable.

## Consecuencias

### Positivas
- Un único punto donde se decide qué puede escribir un modelo.
- Los agentes existentes se reutilizan sin modificar.

### Negativas
- Archivos grandes dentro de JSON consumen más tokens que un diff.
- El escape de cadenas en JSON es una fuente de salidas no interpretables.

### Neutrales
- La spec S2 (herramientas MCP) puede sustituir este protocolo conservando las reglas de confinamiento.

## Cuándo revisitar

- Si la tasa de salidas no interpretables supera lo aceptable en la práctica.
- Al implementar S2.

## Referencias

- `core/agent-registry.js:128-153`, `core/runners/runner.js:58-63`
- `configuracion-ejemplo/sdd.config.yaml` (sección `protecciones`)

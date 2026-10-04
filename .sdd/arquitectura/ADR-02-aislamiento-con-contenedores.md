# ADR-02: Aislamiento con contenedores mediante la CLI de Docker

> Estado: propuesta  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-03
> Spec relacionada: 2026-10-03-ciclo-verificado
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

El plan "FORGE v2" daba por existente un sandbox Docker. No existe: el motor ejecuta el código generado en el equipo anfitrión con `execSync` (`core/runners/runner.js:31-51`), y lo que el repo llama "sandbox" es un nivel de un interruptor de circuito (`core/execution-context.js:30-36`). El Principio V exige aislamiento real.

## Decisión

El código generado se ejecuta en contenedores Docker lanzados con la CLI `docker` mediante `spawn` y argumentos en array, sin shell. La política es declarativa (`core/sandbox/politica.js`) y produce el argv:

- `--network none`
- `--user 1000:1000`, `--cap-drop ALL`, `--security-opt no-new-privileges`
- `--cpus 1`, `--memory 512m --memory-swap 512m`, `--pids-limit 256` (configurables)
- `--read-only` con `--tmpfs /tmp:rw,noexec,nosuid,size=64m`
- `--rm`, nombre `forge-sbx-<runId>-<n>`, etiqueta `forge.sandbox=1`
- Tiempo máximo de 120 s con temporizador en el anfitrión: `docker kill` y `docker rm -f`

Se monta una copia desechable del proyecto, nunca el proyecto real. Si Docker no está disponible, el ciclo termina con error; nunca cae al anfitrión.

**Comprobado en el spike T002 y en la suite con Docker real (2026-10-03).** El montaje de la copia funciona en Docker Desktop para Windows con el usuario 1000. Se añadió `--entrypoint` explícito: con el `ENTRYPOINT` de la imagen, un comando inexistente devolvía 1 en lugar de 127 y se habría contado como un fallo de las pruebas. La copia se monta en `/deps/work` para que las dependencias de la imagen preparada (`/deps`) se resuelvan sin tocar la copia.

**Endurecimiento tras las revisiones independientes (2026-10-03).** Se añadió `--pull never`, `--ulimit nofile=1024:1024` y `fsize=100 MB`, y se sustituyó `-v` por `--mount type=bind` (una ruta con `:` rompía el formato de `-v`; con `--mount` se rechaza la coma). Cada ejecución usa su propia carpeta de copia y un fallo al borrarla (enlaces creados por las pruebas, que Windows no borra) no rompe la sesión. La copia excluye lo mismo que está vetado para escribir. Etiqueta por proyecto en cada contenedor, y el barrido de huérfanos se limita a ella. **Sigue sin haber cuota de disco** para la copia.

## Alternativas consideradas

- **A. `dockerode`**: rechazada porque arrastra `@grpc/grpc-js`, `protobufjs` y `tar-fs` a un repo con dos dependencias (Principio IV).
- **B. Seguir en el anfitrión con el interruptor de circuito**: rechazada porque no es aislamiento (Principio V).
- **C. Otros aislamientos (máquinas virtuales ligeras, WebAssembly)**: rechazadas por alcance; no cubren los runners de varios lenguajes ya existentes.
- **D. CLI de Docker con `spawn`**: aceptada porque no añade dependencias y el argv es comprobable en tests sin Docker.

## Consecuencias

### Positivas
- Cero dependencias nuevas para el aislamiento.
- La política se prueba comparando el argv, sin necesitar Docker en CI.
- `SandboxRunner` implementa el contrato `Runner` existente (`core/runners/runner.js:9-23`) y entra por inyección.

### Negativas
- Requiere Docker instalado en el equipo del operador.
- Depende del formato de salida y de los códigos de la CLI.
- Los montajes y el mapeo de usuario en Docker Desktop para Windows están sin verificar.

### Neutrales
- La afirmación comercial "ningún código malicioso puede afectar el sistema host" debe matizarse: un contenedor reduce el riesgo, no lo elimina.

## Cuándo revisitar

- Si el spike T002 muestra que los montajes no son fiables en Windows: usar `docker create` + `docker cp` + `docker start -a`.
- Si se necesita ejecutar ciclos en paralelo o en remoto.

## Referencias

- `core/runners/runner.js:9-23,31-51,58-63`, `core/execution-context.js:30-36`
- `../doc/estructura_de_implementaci_n_para_el_agente_cursor_claude.md` §5 (`network_mode="none"`)

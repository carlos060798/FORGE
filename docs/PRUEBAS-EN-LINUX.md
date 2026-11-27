# Probar Fragua en Linux desde Windows

Esta guía explica cómo ejecutar la suite de Fragua en Linux sin salir de Windows 11. Hay tres vías: la CI de GitHub (A), un contenedor con Docker Desktop (B) y WSL2 con Ubuntu (C).

## Por qué importa Linux

- Los contenedores del ciclo verificado son Linux. El aislamiento (`core/sandbox/`) corre en una imagen Linux incluso cuando el anfitrión es Windows.
- La CI de GitHub corre en `ubuntu-latest`. Lo que solo se ha probado en Windows puede fallar allí.
- Diferencias que solo aparecen en Linux:
  - **Rutas y mayúsculas:** `Tests/a.js` y `tests/a.js` son archivos distintos; en Windows no.
  - **Permisos:** bits de ejecución, `chmod`, usuarios y propietarios de archivos.
  - **Finales de línea:** un `\r\n` roto en un script de shell.
  - **Separadores de ruta:** `\` frente a `/`.

Nota: al escribir esta guía no existía ninguna pasada verificada de la suite completa en Linux. Los fallos que salgan en la primera ejecución son información nueva, no regresiones.

## Vía A: la CI de GitHub

No necesita nada instalado. El flujo `.github/workflows/ci.yml` se dispara con `push` y con `pull_request` hacia `main`, `master` o `develop`.

1. Sube la rama a GitHub: `git push origin <rama>`.
2. Abre un pull request hacia `develop`, `main` o `master`. Un `push` a otra rama (por ejemplo `desarrollo`) no dispara la CI con la configuración actual.
3. En la pestaña **Actions**, abre la ejecución **CI**. Los trabajos «Tests (Node …)» corren en Ubuntu.
4. Para ver un fallo, abre el trabajo en rojo, despliega el paso «Run tests» y busca la primera línea `not ok`.

Es la vía más fiel (es lo que cuenta de verdad), pero la más lenta: hay que subir el código.

## Vía B: contenedor con Docker Desktop

Prerrequisito: Docker Desktop **en marcha** (icono de la ballena sin animación, «Engine running»).

```powershell
node scripts/probar-en-linux.mjs --solo-comprobar     # verifica que Docker responde
node scripts/probar-en-linux.mjs                      # suite completa, Node 22
node scripts/probar-en-linux.mjs --node 20            # con Node 20
node scripts/probar-en-linux.mjs --archivo tests/sandbox.test.js
npm run probar:linux -- --archivo tests/sandbox.test.js
```

Qué hace:

1. Comprueba `docker info`. Si Docker está apagado, sale con código 2 y dice «Arranca Docker Desktop».
2. Crea una **copia del último commit** (`git archive HEAD`) en un directorio temporal. No monta tu carpeta de trabajo: así el `node_modules` de Windows nunca se mezcla con el de Linux.
3. Ejecuta `npm ci && npm test` (o `npm ci && node --test <archivo>`) dentro de `node:<versión>`.
4. Guarda toda la salida en `registro-linux.log` (la ruta se imprime al empezar) y muestra al final los totales: pruebas, pasan, fallan, saltadas.
5. Devuelve el código de salida de la prueba.

Importante: se prueba lo **commiteado**. Si tienes cambios sin commitear, haz antes un commit local (no hace falta subirlo).

### Pruebas que necesitan Docker real

Dentro del contenedor no hay Docker, así que las pruebas que lo exigen (`FORGE_TEST_DOCKER=1`) se saltan solas. Para ejecutarlas hay que pasar la bandera explícita:

```powershell
node scripts/probar-en-linux.mjs --con-docker-real --archivo tests/sandbox-real.test.js
```

**Riesgo:** esa bandera monta `/var/run/docker.sock` en el contenedor. Quien controle el contenedor controla el Docker de tu equipo (puede crear contenedores con acceso a tus archivos, o borrarlos). Úsala solo con código del repositorio en el que confíes y nunca por defecto. Además, las rutas que el Docker interno monta se resuelven en el anfitrión, no en el contenedor, así que algunas pruebas pueden fallar por eso y no por un fallo del motor.

## Vía C: WSL2 con Ubuntu

Prerrequisito: una distro de WSL que no sea `docker-desktop*`. Docker Desktop crea distros internas con ese nombre; no sirven.

1. En PowerShell: `wsl -l -q`. Si solo ves `docker-desktop`, instala Ubuntu: `wsl --install -d Ubuntu`.
2. Reinicia si lo pide, abre «Ubuntu» desde el menú Inicio y crea tu usuario de Linux.
3. Dentro de Ubuntu instala Node 22 (la suite exige Node 20 o superior; una de las opciones habituales es `nvm`):
   `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`, abre otra terminal de Ubuntu y `nvm install 22`. Comprueba con `node -v`.
4. Desde Windows: `node scripts/probar-en-linux.mjs --via wsl` (o `--solo-comprobar` primero).

El script copia el último commit a `~/fragua-prueba` dentro de la distro (siempre en el sistema de archivos de Linux, que es el que interesa probar y además es más rápido que `/mnt/c`) y ejecuta allí `npm ci && npm test`. `--node` no se aplica en esta vía: usa el Node que tenga la distro.

## Cómo leer los fallos

- Mira el resumen final y abre `registro-linux.log`. Busca la primera línea `not ok` o `✖`: las siguientes suelen ser consecuencia.
- Repite solo ese archivo: `node scripts/probar-en-linux.mjs --archivo tests/<módulo>.test.js`.
- Compara con Windows: `node --test tests/<módulo>.test.js`. Si pasa en Windows y falla en Linux, sospecha de mayúsculas en rutas, permisos, `\r\n` o separadores `\`.
- Si falla en las dos, es un fallo normal del motor.
- Si falla algo que parece del entorno (red, tiempo, carga), pásalo por el procedimiento de cuarentena de `AGENTS.md`; no subas tiempos límite a ciegas.
- Códigos del script: `0` pasó; el código de la prueba si falló; `2` falta un prerrequisito (Docker apagado, sin distro); `64` opciones inválidas; `70` error propio del script (por ejemplo, `git archive` falló).

## Qué NO prueba

- **macOS:** otro sistema, otras diferencias (sistema de archivos que no distingue mayúsculas por defecto, otro `sed`/`tar`). La CI actual no lo cubre.
- **Herramientas reales:** las pruebas usan el proveedor de pruebas y dobles; no llaman a modelos de pago ni a las herramientas instaladas de verdad.
- **Cambios sin commitear:** se prueba `HEAD`, no el árbol de trabajo.
- **Docker real dentro del contenedor**, salvo con `--con-docker-real`.
- **Windows nativo:** para eso es `npm test` en tu máquina y el trabajo «Tests (Windows)» de la CI.

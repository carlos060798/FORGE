---
id: 2026-11-27-github-connect-seguro
titulo: "github-connect seguro: privado por defecto, sin /tmp, sin errores tragados y publicando por la cola de aprobación"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [github-connect, aprobacion, privacidad, codigos-de-salida, fase-2]
---

# Especificación: github-connect seguro

> **Estado: borrador, sin aprobar.** Ítem (f) de la fase 2 del `Plan consolidado de modos y componentes Forja` (§5, §6) y mínimo M8 de su §3.3. La aprobación es del dueño del proyecto; ningún agente la marca.

## 1. Contexto y Motivación

La skill `github-connect` es la única de Fragua que hoy toca un remoto: crea un repositorio en GitHub y sube el proyecto. Lo hace con un script (`skills/github-connect/github-connect.sh`) que incumple varias reglas del proyecto:

- el repositorio sale **público por defecto** (`github-connect.sh:21`, `SKILL.md:31` y `:70`): quien pide «conéctame a GitHub» puede publicar su código, y lo que `git add -A` (`:251`) haya recogido, sin que nadie lo decida;
- copia la salida de `git push` a archivos en `/tmp` (`:195`, `:288`), fuera del directorio del proyecto, y la vuelve a imprimir con `cat` (`:198`, `:294`);
- decide el flujo buscando un texto en esa salida (`grep -q "no changes added"`, `:290`), lo que `AGENTS.md` prohíbe («nunca en buscar texto en una salida»; Principio VI);
- traga errores con `|| true` en el commit y el `push` de la configuración (`:330-331`): el script termina «bien» aunque no se haya subido nada;
- borra un `origin` existente sin pedir permiso (`:223-224`) y llama a `gh auth status --show-token` (`:85`);
- no pasa por la cola de aprobación humana que ya existe para todo lo que sale del equipo (`core/integraciones/aprobacion.js`, ADR-22, mínimo M8).

La skill además documenta su propia visibilidad por defecto como `public`, de modo que el comportamiento peligroso está también en la documentación que lee el modelo.

## 2. Objetivo

Que crear el repositorio remoto y subir el proyecto sea, por defecto, privado, sin escribir fuera del proyecto, con cada paso decidido por su código de salida, y que nada salga del equipo sin una aprobación humana registrada que ate lo que la persona vio a lo que se publica.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Persona no técnica o freelance | Pide conectar el proyecto a GitHub | No publicar por accidente código, datos ni secretos |
| Dueño del proyecto | Aprueba lo que sale | Ver qué se va a crear y subir, y que lo aprobado sea lo publicado |
| Mantenedor | Mantiene la skill | Un fallo es un código de salida distinto de cero, no un texto |

## 4. Historias de Usuario

### HU-001: Privado por defecto
**Como** persona que conecta su proyecto
**Quiero** que el repositorio nuevo sea privado salvo que yo pida lo contrario de forma expresa
**Para** no hacer público algo que no decidí publicar

**Criterios de aceptación:**
- [ ] **CA-001-01**: Sin indicar visibilidad, la orden de creación del repositorio lleva `private` y no lleva `public` (se comprueba con un doble de `gh` que registra sus argumentos). (P1)
- [ ] **CA-001-02**: Un valor de visibilidad que no sea `private` ni `public` termina con código de uso incorrecto (2) antes de cualquier llamada a `gh` o a `git`. (P1)
- [ ] **CA-001-03**: `public` solo se acepta si se pide de forma expresa **y** la vista previa de la aprobación muestra la visibilidad `public` en una línea propia. Aprobar una vista previa `private` no permite crear uno público. (P1)
- [ ] **CA-001-04**: `SKILL.md`, `README.md`, `QUICK-START.md`, `INDEX.md`, `INTEGRATION.md`, `example-config.yaml` y el script declaran el mismo valor por defecto (`private`); una prueba lo comprueba. (P2)

### HU-002: Nada fuera del proyecto
**Como** mantenedor
**Quiero** que el script no escriba fuera del directorio del proyecto
**Para** cumplir la restricción de confinamiento y no dejar salidas con datos en carpetas compartidas

**Criterios de aceptación:**
- [ ] **CA-002-01**: Tras una ejecución completa con un doble de `gh`, la lista de archivos de la carpeta temporal del sistema es idéntica a la de antes. (P1)
- [ ] **CA-002-02**: El script no contiene la ruta `/tmp` ni usa `tee` para guardar la salida de `git` o `gh`. (P1)
- [ ] **CA-002-03**: La salida de `git` y `gh` que se muestra pasa por la redacción de secretos antes de imprimirse (un doble de `gh` que emite un token de prueba no lo deja aparecer en la salida). (P1)
- [ ] **CA-002-04**: El script no invoca `gh auth status --show-token` ni imprime el valor de `GITHUB_TOKEN`. (P1)

### HU-003: Cada paso se decide por su código de salida
**Como** mantenedor
**Quiero** que un fallo de `git` o `gh` detenga el script con un código distinto de cero
**Para** que «terminó bien» signifique que se subió lo que se dijo

**Criterios de aceptación:**
- [ ] **CA-003-01**: Si `git push` falla (doble de `git` que sale con 1), el script sale con código distinto de 0 y no imprime «completado» ni «éxito». (P1)
- [ ] **CA-003-02**: El caso «no hay nada que subir» se decide por el estado del repositorio (número de commits locales y estado del árbol, por códigos de salida de `git`), no por texto: un doble de `git` que imprime el texto antiguo con otro código no cambia el desenlace. (P1)
- [ ] **CA-003-03**: El script no contiene `|| true` ni `2>/dev/null` sobre un `git commit` o un `git push`. Una falla del commit de configuración termina con código distinto de 0. (P1)
- [ ] **CA-003-04**: Los códigos de salida son una tabla cerrada y documentada: 0 completado, 1 fallo, 2 uso incorrecto, 3 pendiente de aprobación, 4 falta una precondición del entorno (sin `git`, sin `gh`, sin credencial). Cada uno tiene una prueba. (P1)
- [ ] **CA-003-05**: Un `origin` existente con otra URL no se borra: el script termina con código 1 e indica cómo resolverlo. (P1)

### HU-004: Lo que sale del equipo pasa por la cola de aprobación
**Como** dueño del proyecto
**Quiero** ver exactamente qué se va a crear y subir y aprobarlo con la huella de lo que vi
**Para** que nada se publique sin mi decisión registrada

**Criterios de aceptación:**
- [ ] **CA-004-01**: Sin una aprobación registrada, el script termina con código 3 sin haber creado ningún repositorio ni hecho ninguna llamada de red (el doble de `gh` no registra ninguna llamada de escritura). (P1)
- [ ] **CA-004-02**: La vista previa muestra: nombre del repositorio, cuenta de destino, visibilidad, rama, URL del remoto, y la lista de archivos que se subirán con su huella. (P1)
- [ ] **CA-004-03**: Aprobar con una huella que no es la del contenido, o con un prefijo menor al mínimo, no publica nada (comportamiento ya existente de `aprobar`, que esta especificación exige conservar para la operación nueva). (P1)
- [ ] **CA-004-04**: Si cambia un archivo, el nombre, la visibilidad o el destino después de preparar la publicación, la huella ya no coincide y no se publica; hay que preparar de nuevo. (P1)
- [ ] **CA-004-05**: La lista de archivos a subir se arma con una lista explícita, no con `git add -A`; excluye los vetados por las reglas de publicación (secretos, `.env*`, `.git/`, archivos que no son texto o que superan el tope) y esa exclusión se muestra en la vista previa. (P1)
- [ ] **CA-004-06**: Cada publicación aprobada queda en el registro de auditoría con su huella, sin el token. (P1)

### HU-005: Un solo camino para el modelo y para la persona
**Como** usuario de cualquier herramienta anfitriona
**Quiero** que el modelo no pueda crear el repositorio por su cuenta
**Para** que la decisión de publicar sea siempre humana

**Criterios de aceptación:**
- [ ] **CA-005-01**: El texto de la skill indica al modelo que prepare la publicación y entregue la vista previa; no contiene una instrucción que ejecute la creación o el `push` sin pasar por la aprobación. (P1)
- [ ] **CA-005-02**: Con la integración de `github` en modo `apagado` (el valor por defecto de ADR-22), la publicación termina con código 4 y un mensaje que dice cómo activarla; no degrada a otro camino. (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un proyecto con commits, `gh` autenticado y la integración de `github` activada
**Cuando** la persona pide conectar el proyecto sin decir la visibilidad
**Entonces** se prepara una publicación privada, se muestra la vista previa con su huella, la persona la aprueba, se crea el repositorio privado, se sube la rama y el script sale con 0.

### Escenario 2: Caso de error
**Dado** una publicación aprobada y un `git push` que falla por red
**Cuando** el script lo ejecuta
**Entonces** sale con 1, la publicación queda marcada como fallida en la cola y no se informa éxito.

### Escenario 3: Caso borde
**Dado** una carpeta con un `.env` y un `origin` ya definido hacia otro repositorio
**Cuando** se prepara la publicación
**Entonces** el `.env` queda excluido y visible como excluido en la vista previa, y el script termina con 1 por el `origin` ajeno sin borrarlo.

## 6. Requisitos Funcionales

- **RF-001**: La visibilidad por defecto DEBE ser privada en el script, en su documentación y en los archivos de ejemplo.
- **RF-002**: El sistema DEBE tratar «crear repositorio» y «subir la rama inicial» como operaciones que salen del equipo y que solo se ejecutan tras una aprobación humana registrada con huella.
- **RF-003**: La vista previa DEBE mostrar destino, visibilidad, rama y la lista de archivos con su huella, y la huella DEBE cubrir todo eso.
- **RF-004**: Cada paso DEBE decidirse por el código de salida del programa que lo ejecuta o por el estado del repositorio; el sistema NO DEBE decidir leyendo texto.
- **RF-005**: El sistema NO DEBE escribir fuera del directorio del proyecto ni en `.git/`, y NO DEBE usar `|| true` ni redirigir a `/dev/null` los errores de `git` o `gh` que decidan el resultado.
- **RF-006**: El sistema NO DEBE imprimir ni guardar el token, y DEBE redactar los secretos que aparezcan en la salida mostrada.
- **RF-007**: El sistema NO DEBE borrar ni reescribir un remoto existente sin una decisión expresa.
- **RF-008**: Sin integración configurada, el sistema NO DEBE hacer ninguna conexión ni leer variables de credenciales (sigue ADR-22, decisión 7).

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Seguridad | Ningún secreto en la salida ni en archivos | 0 apariciones del token de prueba en salida y disco |
| Seguridad | Nada sale sin aprobación con huella | 0 llamadas de escritura a `gh` antes de la aprobación |
| Fiabilidad | Un fallo no se oculta | Código de salida distinto de 0 en el 100 % de los fallos simulados |
| Portabilidad | Funciona en Windows y Linux | Pruebas en ambos [NV: el script es de `bash`; ver §11] |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Otras plataformas (GitLab, Bitbucket, Azure, Forgejo): son fases posteriores del plan.
- ❌ Proteger ramas, crear colas de merge o etiquetas: pertenecen a otras skills de git.
- ❌ Publicar revisiones o comentarios (`revision-publicada`).
- ❌ Aceptar o enmendar ADR-22: esta especificación lo pide, no lo decide.
- ❌ Probar con una cuenta real de GitHub: la verificación usa dobles; la prueba real es de la fase 7 del plan.

## 9. Dependencias y Asunciones

### Dependencias
- ADR-22 (integraciones externas por el anfitrión) y su cola: `core/integraciones/aprobacion.js`. La cola hoy solo conoce dos operaciones, `comentar` y `proponer_cambio` (`aprobacion.js:44`), y el puerto cuatro (`puerto.js:18`: `leerElemento`, `comentar`, `proponerCambio`, `comprobarAlcance`); **ninguna crea un repositorio ni sube una rama inicial**. Añadir una operación exige enmendar ADR-22 (el plan lo prevé como «Enmienda ADR-22», §6).
- Reglas de exclusión de archivos de `core/integraciones/publicacion.js` (`archivoPublicable`, `:217`).
- Contrato común de códigos de salida (ADR-30 del plan, aún por redactar): los códigos de CA-003-04 son una propuesta que debe alinearse con él.

### Asunciones
- La cola y la huella existentes sirven tal cual para una operación nueva si se amplía la lista de operaciones. [NECESITA_ACLARACION]: no se ha comprobado que `crearPendiente`, `vistaPrevia` y `aprobar` admitan una operación sin «referencia» a un elemento de la plataforma (hoy la referencia apunta a una incidencia o solicitud).
- `gh` y `git` están instalados; si no, código 4.

## 10. Términos del Dominio

- **Cola de aprobación**: lista de publicaciones pendientes en el estado del usuario, cada una con huella; solo una persona las aprueba.
- **Huella**: SHA-256 de destino, operación, referencia y contenido de lo que la persona vio (`huellaDePublicacion`, `aprobacion.js:129`).
- **Vetado**: archivo que no se publica nunca sin decisión expresa por archivo.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: ¿la operación nueva entra en la cola de integraciones (enmienda de ADR-22) o se crea una cola propia de la skill? Recomendado: la cola existente, para tener un solo punto de aprobación y de auditoría.
- [ ] [POR_DECIDIR]: ¿el script se reescribe en Node sin shell (como propone el informe `Skills agnósticas git y DevOps`, fase 0) o se corrige en `bash`? Recomendado: Node, porque el script actual no corre en Windows sin `bash` [NV] y los dobles de prueba son más simples.
- [ ] [POR_DECIDIR]: `GITHUB_TOKEN` como entrada: ¿se sustituye por la sesión de `gh` y por las variables que ADR-22 ya admite? Recomendado: las de ADR-22.
- [ ] [NECESITA_ACLARACION]: el nombre del repositorio y la descripción son texto libre que viaja a una plataforma: ¿se acotan y redactan como el resto del contenido saliente?

## 12. Criterios de Éxito Medibles

- 0 apariciones de `/tmp`, `|| true` y `--show-token` en la skill (comprobado por prueba).
- 100 % de los fallos simulados de `git` y `gh` terminan con código distinto de 0.
- 0 llamadas de escritura antes de una aprobación válida.

## 13. Referencias

- `skills/github-connect/github-connect.sh:21,85,190-198,223-224,251,288-294,330-331` y `skills/github-connect/SKILL.md:31,70`.
- `core/integraciones/aprobacion.js:44,129,290,451`, `core/integraciones/puerto.js:12-18`, `core/integraciones/publicacion.js:217`.
- `.sdd/arquitectura/ADR-22-*.md` (decisiones 1, 2, 4, 5 y 7).
- `reports/Plan consolidado de modos y componentes Forja.md` §3.3 (M8), §5 (fase 2, ítem f), §6.
- `reports/Skills agnósticas git y DevOps.md` (sección «La skill `github-connect` actual ya incumple el contrato»).

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | Alcance | ¿Qué operaciones hay que meter en la cola? | Pendiente (ver §11) | 2026-11-27 |

# Plan de implementación: puertas de calidad y evidencia

> Spec: `spec.md` · Estado: **borrador, sin aprobar** · Redactado por un agente por encargo del dueño; no se implementa hasta que la apruebe (Principio II) · Decisiones existentes: ADR-05 (enrutador determinista), ADR-20 (mutación y rojo obligatorio)

## 1. Suposiciones tomadas (corregibles)

| # | Pregunta de la spec | Suposición del plan | Qué cambia si se invierte |
|---|---|---|---|
| 1 | Un comando por puerta | Sí, claves fijas `tipos`, `linter`, `seguridad`, `cobertura` | Habría que ampliar el lector de configuración a listas |
| 2 | Cuándo corren las puertas | Tras el pase de pruebas, una vez | Un nodo antes del `sandbox` en cada iteración |
| 3 | Cadena | Una por proyecto, en `.sdd/verificaciones/` | Un campo `spec` y comprobación por serie |
| 4 | Firma | Opcional, P2, clave fuera del proyecto | Se retira CA-005-03 y queda solo la cadena |
| 5 | Enlace criterio→prueba | Por texto del identificador en la prueba | Un manifiesto aparte |
| 6 | `no_cambiar` | Campo de tarea, rutas de pruebas existentes | Pasa a la spec |

## 2. Principios del diseño

- **Componer, no copiar:** las puertas son más ejecuciones del `SandboxRunner` existente y se clasifican con `clasificar`; no hay un segundo motor de decisión.
- **Solo se aprieta:** la sección `puertas:` no tiene ninguna clave que afloje (`PLAN-MAESTRO.md:107`). Una prueba recorre las claves aceptadas.
- **Falla cerrado:** puerta no ejecutable, en infraestructura o con tiempo agotado nunca es éxito.
- **Lectura, no inferencia:** la matriz criterio→prueba y la comprobación de la cadena son lectura y comparación de texto o de hashes. Ningún modelo.
- **Lo mínimo que sirve:** cadena de hashes primero; firma después. Sin infraestructura externa.

## 3. Módulos

| Módulo | Responsabilidad |
|---|---|
| `core/ciclo/config.js` (cambio) | Sección `puertas:` en `POR_DEFECTO` y validación estricta de claves (`core/ciclo/config.js:17-54`) |
| `core/ciclo/puertas.js` (nuevo) | Define las puertas, las ejecuta con el runner y devuelve resultado por puerta; sin decidir la ruta |
| `core/ciclo/router.js` (cambio mínimo) | Una función pura `decidirTrasPuertas(estado)` junto a `decidirTrasMutacion` (`core/ciclo/router.js:121-135`); motivo `puerta` |
| `core/ciclo/estado.js` (cambio) | Campos opcionales `puertas` y `no_cambiar` en la tarea; `SCHEMA_VERSION` solo sube si lo exige la política del contrato público |
| `core/ciclo/grafo.js` y `index.js` (cambio) | Nodo `puertas` entre `sandbox` y `mutacion`; sin sección, el grafo es el de hoy (sin confirmar el punto exacto: spike) |
| `core/evidencia/informe.js` (nuevo) | Compone el informe y calcula hashes y `sha256` canónico |
| `core/evidencia/cadena.js` (nuevo) | Enlaza con `anterior`, comprueba la cadena, firma y verifica opcionalmente |
| `core/evidencia/criterios.js` (nuevo) | Extrae `CA-xxx-yy` de `spec.md` y los cruza con tareas y pruebas |
| `core/verificar/registro.js` (cambio) | Usa el informe nuevo; mantiene el evento `verificar:resultado` (`core/verificar/registro.js:35-48`) |
| `core/event-log.js` (cambio) | Añadir `ciclo:puerta` y `ciclo:evidencia` al tipo (`core/event-log.js:9`) |
| `cli/verificar.js` (cambio) | `--criterios`, `--exigir-cobertura-de-criterios`, `--comprobar-evidencia` |

Se reutilizan sin cambios: `SandboxRunner`, `clasificar`, `dividirComando`, `redactar`/`cola`, `escritura-segura`, `huella` de `protocolo-archivos.js`.

## 4. Flujo

**Puertas**
1. Leer `puertas:` de la configuración; validar claves.
2. Tras un `pass` de pruebas sin sospecha, ejecutar cada puerta declarada en el contenedor, en orden fijo (`tipos`, `linter`, `seguridad`, `cobertura`).
3. Clasificar cada una; guardar `{nombre, comando, categoria, exitCode, durationMs, cola}`.
4. Si alguna no es `pass`: ruta `coder` (con su salida) o revisión humana por iteraciones, igual que un fallo de pruebas.
5. Si todas pasan: sigue la mutación y el fin.

**Regresión (`no_cambiar`)**
1. Antes del implementador: ejecutar lo declarado; debe pasar (línea base); si no, revisión humana.
2. Tras implementar: volver a ejecutar; un fallo es `falla` por regresión.

**Evidencia**
1. Al cerrar la tarea, componer el informe: copia redactada de lo ya guardado en estado, más hashes y digest.
2. Calcular `sha256` canónico y enlazar con `anterior`; firmar si hay clave.
3. Guardar con `escritura-segura` y añadir el evento.

## 5. Datos

- `puertas` (sección de configuración): `tipos`, `linter`, `seguridad`, `cobertura` (texto, comando), `cobertura_minima` (número).
- Resultado por puerta: `nombre`, `comando`, `categoria` (`pass|fail|timeout|infra_error|no_ejecutable`), `exitCode`, `durationMs`, `salida`.
- Informe de evidencia (`formato: 2`, ver `2026-10-14-contrato-publico`): los campos actuales de `core/verificar/resultado.js:54-77` más `spec{id,sha256,aprobador,fecha}`, `entradas{arbol,pruebas[],implementacion[]}`, `roles{codigo,pruebas}{agente,modelo}`, `imagen{etiqueta,digest}`, `aislamiento{red,limites}`, `puertas[]`, `criterios{cubiertos,sinPrueba,sinTarea}`, `coste`, `decision`, `anterior`, `sha256`, `firma`.
- Serialización canónica: claves ordenadas, sin espacios, UTF-8; el `sha256` se calcula con los campos `sha256` y `firma` ausentes.

## 6. Fases

| Fase | Contenido | Sale con |
|---|---|---|
| S0 | Spikes S0.1 a S0.6 de la spec | `spikes/` |
| F1 | Configuración `puertas:` y su validación, sin ejecutar | HU-001 |
| F2 | Ejecución y clasificación en `forge verificar` | HU-002 en `verificar` |
| F3 | Puertas en el ciclo (nodo, router, motivo) | HU-002 en el ciclo |
| F4 | Matriz criterio→prueba | HU-003 |
| F5 | Informe con los campos y `formato` | HU-004 |
| F6 | Cadena y comprobación; firma opcional | HU-005 |
| F7 | `no_cambiar` | HU-006 |
| F8 | Documentación, prueba hostil, revisión independiente | Cierre |

Orden por valor y riesgo: F1 a F3 y F5 a F6 son la parte central; F7 es pequeña y puede ir antes de F4 si el dueño lo prefiere.

## 7. Pruebas

- Con el Docker falso que usan las pruebas del ciclo: cada categoría de cada puerta, y que una puerta fallida con pruebas en verde da `falla`.
- Prueba exhaustiva de claves de `puertas:`: ninguna afloja una garantía fija.
- Un comando de puerta con operadores de shell se rechaza sin ejecutar.
- Matriz: spec de ejemplo con un CA sin tarea y otro con tarea sin prueba citada.
- Cadena: alterar un campo, quitar un informe intermedio, reordenar; todos detectados; sin alteración, íntegra.
- Firma: verificación correcta, clave equivocada, informe sin firma en una cadena firmada.
- Redacción: un secreto con forma conocida en la salida de una puerta no llega al informe.
- Regresión: línea base verde, rota tras el cambio; declaración vacía rechazada.
- Con Docker real (opcional, `FORGE_TEST_DOCKER=1`): una puerta de tipos y una de linter en un proyecto de Node. Sin confirmar en Linux.
- Retrocompatibilidad: un `.sdd/` sin `puertas:` y un informe antiguo se leen igual que hoy.

## 8. Riesgos del plan

| Riesgo | Señal | Respuesta |
|---|---|---|
| El agente debilita la configuración del linter o de tipos (`tsconfig.json`, reglas) para que la puerta pase | `tsconfig.json` no empieza por punto: la lista de configuración que pausa la tarea puede no cubrirlo (`docs/ciclo-verificado.md:221-224`; sin confirmar) | Spike: ampliar la lista de configuración protegida con los archivos de las herramientas de cada puerta y probarlo |
| La puerta no tiene su herramienta en la imagen sin red | Escenario 3 | Mensaje claro; documentar que debe estar en las dependencias del proyecto |
| El coste de tiempo de N ejecuciones | Medición del spike S0.1 | Una preparación de imagen; las puertas se ejecutan en paralelo solo si el spike lo permite (sin confirmar), si no en serie |
| Digest de imagen no disponible en imágenes locales | Spike S0.2 | Registrar el id de la imagen y marcar `digest: null` con motivo |
| Identidad del modelo no disponible por llamada | Spike S0.4 | `null` con motivo; no se inventa |
| Falsa confianza en la cadena sin anclaje | CA-005-04 | Documentarlo y ofrecer imprimir la cabeza |
| Crecimiento del informe | Tamaño | Tope por campo; salida de puertas acotada |
| Ampliar `EventType` rompe consumidores | Pruebas de eventos | Tipos nuevos opcionales; política de compatibilidad del contrato público |

## 9. Revisión

Toca aislamiento, firma y la superficie de configuración que decide un veredicto: **necesita revisión independiente** con la guía OWASP de agentes (`PLAN-MAESTRO.md:72`), en concreto: (1) que ninguna clave afloje una garantía, (2) la ejecución de comandos del proyecto, (3) la integridad y los límites de la cadena y la firma, (4) el tratamiento de la clave, (5) la protección contra debilitar configuraciones de herramientas.

## 17. Fase B1: puertas declarables en `fragua verificar` (2026-10-17, implementada)

Los spikes mandan sobre las secciones 3 a 6. Lo que cambia:

- Módulos `core/puertas/config.js` (lector estricto propio; `core/ciclo/config.js` no se toca) y `core/puertas/ejecutar.js` (no `core/ciclo/puertas.js`: ese archivo cuelga del frente de perfiles y del enrutador, fase siguiente). Integración mínima en `core/verificar/index.js` y `resultado.js`; `core/evidencia/cadena.js` resume las puertas en `evidencia.puertas`.
- Un clon del `SandboxRunner` por puerta que solo cambia `testCmd` (patrón de `core/ciclo/mutacion.js:1106`), en serie, con tiempo por puerta y total acotados. `argvRun` fija las garantías; la puerta solo aporta un comando.
- `clasificar` no se toca: el 127 se mira antes y es `no_ejecutable`. Categorías: `pass`, `fail`, `timeout`, `infra_error`, `no_ejecutable`, `no_ejecutada`.
- Veredicto: solo se ejecutan si las pruebas pasan; una puerta que no pasa da `falla` (código 1) con su nombre, o `infraestructura` (4) si falló el aislamiento; sin mutación en ese caso. Una puerta se ejecuta aunque la anterior falle (el implementador ve todo), salvo fallo de infraestructura o tiempo total agotado.
- El resultado no cambia `formato: 1`: bloque opcional `puertas` (esquema `resultado-verificar` 1.2) y `evidencia.puertas`. Sin sección, nada cambia.
- Sin `cobertura_minima`: no hay forma genérica de pasar un umbral a una herramienta; va dentro del comando. Sin `--sin-puertas` ni variable que las desactive. Intérpretes (`sh`, `bash`, `cmd`, `powershell`…) vetados como primera palabra.
- Topes: `timeout_s` 120/600, `timeout_total_s` 300/900, `salida_max_bytes` 262144/1048576 (defecto/techo); el entorno del usuario los fija con techo y el proyecto solo los baja. Máximo cuatro puertas.
- Pendiente (fase siguiente): nodo y enrutador del ciclo, evento `ciclo:puerta`, cableado de `protegidos.js`, Docker real (F8.2), revisión independiente.

## 16. Fase A: evidencia encadenada (2026-10-17, implementada)

Los spikes mandan sobre las secciones anteriores. Lo que cambia:

- Módulo `core/evidencia/cadena.js` (reutiliza `canonico`, `claveLocal`, `firmar`, `firmaValida` de `core/estado-usuario.js`; sin primitivas nuevas). `core/verificar/registro.js` lo usa en `--registrar`.
- El informe no cambia `formato: 1`: los campos nuevos van en un bloque opcional `evidencia` (esquema `resultado-verificar` 1.1). Sustituye al `formato: 2` de la sección 5 para esta fase.
- `spec{id,sha256,aprobada,fecha}`; `aprobador: null` con motivo. `imagen{etiqueta,id,repoDigests}`. `modelos` es una lista de pares pedidos, vacía con motivo en `forge verificar`.
- Firma: siempre que haya clave local (ya no es «opcional P2»). Sin clave: no se firma, se declara. Con clave o con algún informe firmado, un informe sin firma es error.
- Cabeza de la cadena en `<estado>/cadena-cabeza.json` (estado del usuario, firmada): único modo de detectar el truncado de los últimos informes. Límite documentado en `docs/cadena-de-evidencia.md`.
- Comando de solo lectura: `fragua verificar --comprobar-evidencia` (`cli/verificar.js`).
- `core/evidencia/protegidos.js`: lista de configuración protegida (spike S0.6). Cableado a `protocolo-archivos.js`: fase siguiente.
- Pendiente de la fase siguiente: candado de proyecto al leer la cabeza y escribir (hoy una carrera bifurca la cadena y se detecta); `ciclo:llamada` y `modeloServido`; `DockerCli.identidadImagen` dentro de `prepararImagen` (hoy la identidad se consulta con `docker image inspect` al registrar, y puede diferir de la imagen usada si la etiqueta se movió entre medias); sellar la aprobación de la spec con la clave local.

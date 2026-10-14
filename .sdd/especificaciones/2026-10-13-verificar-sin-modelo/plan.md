# Plan de implementación: `forge verificar`

> Spec: `spec.md` · Estado: **borrador, sin aprobar** · Decisiones existentes: ADR-18 (lenguajes), ADR-20 (mutación propia)

## 1. Suposiciones tomadas (corregibles)

| # | Pregunta de la spec | Suposición del plan | Qué cambia si se invierte |
|---|---|---|---|
| 1 | Nombre del comando | `verificar` | Un alias |
| 2 | Registro por defecto | Solo con `--registrar` | Una condición |
| 3 | Paso de integración continua | Fuera de esta entrega | Otra tarea |

## 2. Principios del diseño

- **Componer, no copiar:** el comando arma piezas que ya existen y están revisadas; no reimplementa sandbox, enrutador ni mutación.
- **Imposible gastar:** el módulo no importa ningún proveedor de modelo; una prueba estática lo vigila, como la de carga perezosa de integraciones.
- **Falla cerrado:** sin aislamiento, sin pruebas ejecutadas o sin mutantes concluyentes, el resultado nunca es éxito.

## 3. Módulos

| Módulo | Responsabilidad |
|---|---|
| `core/verificar/index.js` (nuevo) | Orquesta: detectar, ejecutar en el sandbox, clasificar, medir mutación si se pide, formar el resultado |
| `core/verificar/resultado.js` (nuevo) | Forma del resultado, versión del formato, redacción y tope de tamaño |
| `core/verificar/cambios.js` (nuevo) | Archivos cambiados desde una referencia de git, sin ejecutar nada del repositorio |
| `cli/verificar.js` (nuevo) | Opciones, salida de texto y `--json`, códigos de salida |
| `cli/index.js` | Entrada `verificar` con carga perezosa y línea en `uso()` |

Se reutilizan sin cambios: `SandboxRunner`, `core/stack-detector.js`, `core/pytest-deteccion.js`, `clasificar` y `sinPruebasEjecutadas` del enrutador, `medirMutacion`, `redactar`.

## 4. Flujo

1. Resolver `--cwd` y leer `sandbox.*` y `motor.mutacion_*` si hay configuración; si no, valores por defecto.
2. Detectar lenguaje y comando de pruebas, o usar `--comando`.
3. Barrer copias y contenedores huérfanos.
4. `SandboxRunner.test(cwd)` con una carpeta de sesión propia.
5. Clasificar con las reglas del enrutador: infraestructura, sin pruebas, falla, pasa.
6. Si pasa y se pidió mutación: resolver archivos (`--archivos` o `--desde`) y llamar a `medirMutacion`.
7. Formar el resultado, redactarlo, imprimirlo y, con `--registrar`, guardarlo.
8. Código de salida.

## 5. Datos

- Resultado (`formato: 1`): `veredicto`, `codigoSalida`, `comando`, `lenguaje`, `imagen`, `duracionMs`, `cortePorTiempo`, `cortePorMemoria`, `salida` (acotada y redactada), `mutacion` (`probadas`, `detectadas`, `concluyentes`, `puntuacion`, `veredicto`), `avisos`.
- Carpeta de sesión: fuera del proyecto cuando no hay `.sdd/` (temporal del sistema), para no crear nada en un proyecto ajeno sin `--registrar`.

## 6. Fases

| Fase | Contenido | Sale con |
|---|---|---|
| S0 | Spikes: mutación fuera del ciclo; cambios de git sin ejecutar nada | `spikes/` |
| F1 | Comando mínimo: detectar, ejecutar, clasificar, códigos de salida | HU-001 |
| F2 | `--json`, redacción, cero pruebas | HU-002 |
| F3 | Mutación con `--archivos` y `--desde` | HU-003 |
| F4 | `--registrar`, concurrencia | HU-004 |
| F5 | Proyecto hostil, documentación, revisión independiente | Cierre |

## 7. Pruebas

- Con el Docker falso que ya usan las pruebas del ciclo: los cuatro veredictos y sus códigos.
- Aislamiento del comando: `fetch` interceptado y entorno vigilado; ningún módulo de proveedores ni de integraciones cargado.
- Proyecto sin `.sdd/`: no se crea nada en él sin `--registrar`.
- Proyecto hostil: uniones, script de pruebas malicioso, salida con secretos.
- Con Docker real (opcional, `FORGE_TEST_DOCKER=1`): los cinco proyectos del kit de pruebas independientes.
- Windows y contenedor Linux.

## 8. Riesgos del plan

| Riesgo | Señal | Respuesta |
|---|---|---|
| `medirMutacion` depende del estado del ciclo | Spike S0.1 | Adaptador fino o HU-003 reducida a `--archivos` |
| Calcular cambios con `git` ejecuta código del repositorio | Spike S0.2 | Solo `--archivos` en la primera entrega |
| La carpeta de sesión temporal deja restos | Prueba de barrido | Mismo barrido por proceso vivo que la mutación |

## 9. Revisión

Toca el aislamiento y acepta proyectos de terceros: necesita una revisión independiente con la guía OWASP de agentes, como las anteriores, antes de fusionar.

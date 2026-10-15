# Plan de implementación: defensa frente a inyección y fuga

> Spec: `spec.md` · Estado: **borrador, sin aprobar** · Decisiones existentes: ADR-21 (implementador por turnos), ADR-22 (integraciones, texto de plataforma como dato; revisión 2: lo que autoriza no vive en el árbol)

## 1. Suposiciones tomadas (corregibles)

| # | Pregunta de la spec | Suposición del plan | Qué cambia si se invierte |
|---|---|---|---|
| 1 | Reutilizar `comoDato` o función hermana | Hermana (`comoArchivo`) en un módulo compartido con `comoDato` | Si se reutiliza tal cual, hay que desactivar la reescritura de enlaces con una opción |
| 2 | Secreto: rechazar o redactar | Rechazar con motivo | Redactar exigiría un camino aparte y cambia el programa |
| 3 | Destinos: bloquear o avisar | Avisar en la primera entrega; secretos bloquean | Una condición |
| 4 | Identificador | Guardado en el diario con el prompt | Derivarlo exige una semilla de sesión |
| 5 | Política de destinos | Entorno y estado fuera del árbol | Una lectura distinta |

## 2. Principios del diseño

- **Contener, no detectar:** ninguna regla depende de que el modelo reconozca la inyección.
- **Un solo punto por decisión:** la entrada al modelo pasa por un módulo; la escritura, por `aplicarArchivos`. Nada de reglas duplicadas (ADR-21: «un solo lugar para las reglas»).
- **Falla cerrado:** lo que no se puede decidir no se acepta.
- **El repositorio puede pedir más rigor, no menos** (`PLAN-MAESTRO.md` §6).

## 3. Módulos

| Módulo | Responsabilidad |
|---|---|
| `core/ciclo/dato-no-confiable.js` (nuevo) | `comoArchivo`: delimitador con identificador, cabecera fija, tope de bytes, sin reescribir código. Comparte la generación del identificador con `core/integraciones/confianza.js` (extraer a una función común, sin cambiar su comportamiento) |
| `core/ciclo/control-salida.js` (nuevo) | `revisarContenido(rutaPosix, contenido, anterior, politica)`: secretos (usa `pareceSecreto`, `redactarPorValor`) y destinos nuevos; devuelve `{ok}` o `{motivo, tipo}` sin el valor |
| `core/ciclo/protocolo-archivos.js` | `aplicarArchivos` llama a `revisarContenido`; nuevos motivos; `requiereRevision` también por destino |
| `core/ciclo/herramientas-coder.js` | Resultados de `leer_archivo`, `buscar` y salida de pruebas delimitados; mensajes de rechazo nuevos en `MOTIVOS` |
| `core/ciclo/nodos.js` | Secciones del prompt con contenido del árbol delimitadas |
| `core/ciclo/politica-destinos.js` (nuevo) | Lee la política del usuario fuera del árbol |
| `tests/fixtures/integraciones/hostiles.json`, `tests/proyecto-hostil.test.js` | Batería ampliada |
| `docs/GARANTIAS-Y-LIMITES.md` (nuevo, en F5) | Lista de garantías con enlaces |

## 4. Flujo

1. Entrada: cada fragmento del árbol que va al modelo se envuelve con `comoArchivo` (identificador, cabecera, tope).
2. El modelo responde (bloque o turno).
3. Salida: `aplicarArchivos` valida ruta (existente), rol (existente) y **contenido** (nuevo): secretos y destinos nuevos frente al archivo anterior y a la política.
4. Rechazo: no se escribe, se devuelve al modelo el motivo sin el valor, se anota en el diario `ciclo:escritura_rechazada` con `motivo` y tipo.
5. Destino nuevo o dependencia/configuración: `requiereRevision`; el grafo va a `revision_humana`.
6. Pruebas y veredicto: sin cambios.

## 5. Datos

- Evento nuevo: `ciclo:contenido_rechazado { ruta, tipo: 'secreto'|'destino'|'ilegible', regla }` (sin valor).
- Política: `{ destinos_permitidos: string[] }` en el estado del usuario fuera del árbol; ausencia = ninguno permitido más allá de lo que ya esté en el proyecto.
- Identificador: guardado en la entrada del diario del prompt (clave por huella en bloque; `turno:<it>:inicio` en turnos), de modo que reanudar reutiliza el mismo texto.

## 6. Fases

| Fase | Contenido | Sale con |
|---|---|---|
| S0 | Spikes S0.1 a S0.4 | `spikes/` |
| F1 | Batería nueva **antes** del código, en rojo con los controles negativos | Pruebas que demuestran el hueco actual |
| F2 | `comoArchivo` y aplicación en los puntos del inventario | HU-001 |
| F3 | `control-salida` en `aplicarArchivos`, secretos | HU-002 (secretos) |
| F4 | Destinos nuevos y política del usuario | HU-002 (destinos) |
| F5 | Documento de garantías y límites; prueba del catálogo | HU-004 |
| F6 | Revisión independiente | Cierre |

## 7. Pruebas

- Equivalencia: el ciclo verificado con el proveedor de pruebas da el mismo resultado con y sin delimitador (salvo la cabecera).
- Reanudación: cortar a mitad de turno y reanudar reproduce el prompt idéntico; el diario sigue válido.
- Modelo guionizado que obedece al archivo hostil (patrón de `tests/proyecto-hostil.test.js:502`).
- Control negativo por categoría.
- Salida de pruebas con marcador de cierre falsificado y con identificador real conocido (el identificador real no aparece: ver la prueba de `confianza.js` en `tests/integraciones-confianza.test.js`).
- Propiedad: para entradas generadas al azar, el contenido nunca contiene su propio identificador.
- Rendimiento: presupuesto de pasos del delimitador sobre un archivo de 1 MB (el tope de lectura es `MAX_ARCHIVO_BYTES`, `herramientas-coder.js:35`).

## 8. Riesgos del plan

| Riesgo | Señal | Respuesta |
|---|---|---|
| El delimitador aumenta tokens y coste | Medición en S0.4 | Cabecera una vez por prompt, no por archivo |
| Falsos positivos de destino bloquean tareas legítimas | Corpus de S0.3 | Modo «avisar» y reglas por esquema |
| El identificador guardado rompe el diario de prompts antiguos | Prueba de reanudación con diarios previos | Versionar la clave; diarios sin identificador se reproducen tal cual |
| El modelo real ignora la cabecera | Spike S0.4 | La garantía no depende de ello; se documenta |
| Se añade un punto de entrada nuevo sin delimitar | Prueba estática que lista las rutas de lectura hacia el prompt | Falla si aparece una no registrada |

## 9. Revisión

Toca la frontera de confianza y la escritura. Revisión independiente obligatoria, con la lista de la spec («Qué necesita revisión independiente»). La guía OWASP Agentic 2026 se usa como referencia temática; la lista de riesgos debe leerse completa antes de citar números (hoy sin verificar).

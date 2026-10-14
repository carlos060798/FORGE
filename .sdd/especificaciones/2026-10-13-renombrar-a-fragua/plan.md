# Plan de implementación: Renombrar el proyecto a Fragua

> Spec: `spec.md` · Estado: en implementación por instrucción del dueño (2026-10-13) · F1 hecha

## 1. Suposiciones tomadas (corregibles)

| # | Pregunta de la spec | Suposición del plan | Qué cambia si se invierte |
|---|---|---|---|
| 1 | Nombre del paquete | `fragua` | Una cadena en un solo sitio |
| 2 | Renombrar el repositorio | Lo hace el dueño tras fusionar | Enlaces de la documentación |
| 3 | Duración de los alias | Toda la serie 5.x | Nada en esta entrega |
| 4 | Aviso al usar `forge` | Sí, discreto | Una condición |

## 2. Principios del diseño

- **Añadir antes que quitar:** primero existe el nombre nuevo junto al antiguo; nada se retira en esta entrega.
- **Un solo sitio por nombre:** nombre del producto, del paquete, prefijo de variables, carpeta de estado y etiqueta de contenedor viven en un módulo.
- **Ante la duda, parar:** dos valores distintos para lo mismo es un error, nunca una elección.
- **La historia no se reescribe:** planes, ADR, revisiones y evidencia quedan como están.

## 3. Módulos

| Módulo | Responsabilidad |
|---|---|
| `core/nombres.js` (nuevo) | Constantes: producto, paquete, orden, prefijos de variables, carpeta de estado, etiqueta de contenedor; y sus formas antiguas |
| `core/entorno.js` (nuevo) | `leerVariable(sufijo, env)`: lee `FRAGUA_<sufijo>` y `FORGE_<sufijo>`; iguales o una sola, devuelve el valor; distintas, lanza un error que nombra las dos |
| `core/integraciones/estado-usuario.js` | Carpeta nueva con la regla de la spec HU-004 |
| `core/integraciones/config.js` | Prefijos admitidos para `*_token_env` |
| `core/sandbox/politica.js` y barridos | Etiqueta nueva; barrido de las dos |
| `cli/index.js` | Nombre de la orden invocada en ayuda y mensajes; aviso al usar `forge` |
| `package.json`, `scripts/pruebas-independientes.mjs`, pruebas de empaquetado | Nombre del paquete desde `core/nombres.js` donde sea posible |

## 4. Fases

| Fase | Contenido | Riesgo | Estado |
|---|---|---|---|
| **F1** | Orden `fragua` en `bin`; prueba; línea en la ayuda | Ninguno | **Hecha** |
| **S0** | Inventarios de variables, carpeta de estado, etiquetas y nombre del paquete | Ninguno (lectura) | Por hacer |
| **F2** | `core/nombres.js`; ayuda y mensajes con la orden invocada; aviso al usar `forge` | Bajo | Por hacer |
| **F3** | `core/entorno.js` y sustitución de todas las lecturas de variables; pruebas de conflicto y de política | **Alto: seguridad** | Espera a S0 |
| **F4** | Carpeta de estado y etiqueta de contenedor | **Alto: seguridad y restos** | Espera a S0 |
| **F5** | Nombre del paquete; kit de pruebas independientes; documentación de entrada; nota en los índices | Medio | Por hacer |
| **F6** | Publicar, avisar en `forja-mvp`, renombrar el repositorio | Irreversible | **Dueño** |
| **F7** | Revisión independiente de F3 y F4; verificación | — | Por hacer |

F3 y F4 van en ramas separadas y no se fusionan sin revisión independiente.

## 5. Orden respecto a las otras especificaciones

Este cambio toca `cli/index.js`, la lectura de variables y la carpeta de estado, que también tocan `instalacion-agnostica`, `proveedores-agnosticos` y `verificar-sin-modelo`. Para no rehacer trabajo:

1. F2 de esta spec **antes** de empezar las otras tres: así nacen con el nombre nuevo.
2. F3 **antes** de `proveedores-agnosticos` F5 (niveles), que añade variables.
3. F5 **antes** de publicar la beta.

## 6. Pruebas

- Orden `fragua` equivalente a `forge` (hecha).
- Por cada variable de política: solo antigua, solo nueva, las dos iguales, las dos distintas (error), y que ninguna combinación amplía permisos.
- Carpeta de estado: solo antigua, solo nueva, las dos, ninguna; con las comprobaciones de N3-02 y N3-03.
- Barrido de contenedores con las dos etiquetas.
- Proyecto hostil: un repositorio no puede fijar ninguna de las dos formas.
- Empaquetado e instalación en carpeta limpia con el nombre nuevo.
- Windows y contenedor Linux.

## 7. Riesgos del plan

| Riesgo | Señal | Respuesta |
|---|---|---|
| Queda una lectura directa de `process.env.FORGE_*` fuera de la función única | Prueba estática que busca lecturas directas | No se fusiona F3 |
| El nombre deja de estar libre | Comprobación el día de publicar | Paquete con ámbito |
| Se pierde la cola de aprobaciones | Prueba de estado antiguo | No hay migración automática |
| Documentación a medias, con dos nombres mezclados | Prueba de consistencia ampliada a los documentos de entrada | Se corrige en F5 |

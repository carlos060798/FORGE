# Spike S0.3: qué es un «destino externo» en código real; corpus de falsos positivos

> 2026-10-17. Experimento: `scratchpad/e3.mjs` (fuera del repositorio) recorre `git ls-files` de este repositorio con expresiones simples. Corpus: **un solo proyecto** (FORGE, mayormente JS y Markdown); no es representativo de Python, Go ni de proyectos con infraestructura. Conclusión de cobertura: **no concluyente**.

## 1. Medición

715 archivos de texto/código leídos. Patrón de URL con esquema (`http|https|ws|wss|ftp|ssh://host`):

| Dónde | Coincidencias |
|---|---|
| Total | 646 |
| En documentación (`.md`, `.html`) | 384 (59 %) |
| En código fuente | 207 (32 %) |
| En archivos de configuración (`.json/.yaml/.toml`) | 36 (6 %) |
| En comentarios de código (línea que empieza por `//`, `#`, `*`) | 19 (3 %) |
| Hacia `localhost`, `127.*`, `0.0.0.0` | 83 (13 %) |
| Hacia dominios de ejemplo (`example.*`, `.test`, `.invalid`) | 11 |

148 hosts distintos; los más frecuentes son documentación (`github.com`, `docs.gitlab.com`, `vercel.com`, `platform.claude.com`) y los de las pruebas hostiles (`evil.example`, `atacante.example`, `ajeno.example`).

Otras señales:

- Patrón de IP `x.x.x.x`: **156** coincidencias, **0** con algún octeto > 255. No hay prueba de que sean direcciones (muchas son versiones como `1.2.3.4` o `0.0.0.0`); una regla de IP sin contexto da falsos positivos.
- Líneas con `curl|wget|nc|ssh|scp|fetch(|axios.|requests.get|http.get|urllib`: 46 en código, 29 en documentación.

## 2. Lo que esto dice del diseño de CA-002-03/04

1. **La mayoría de las URL nuevas que escribiría un modelo son documentación o ejemplos.** Una regla «URL con host que no estaba» marcaría casi cualquier README o comentario nuevo. Un modelo que añade `https://docs.github.com/...` a un comentario no exfiltra nada.
2. **El riesgo real son los sitios de ejecución**, no las cadenas: llamada de red en código ejecutable, comando de red en un script, host en un archivo de configuración que otra herramienta interpreta sola (que ya detiene el trabajo por `configuracion`, `protocolo-archivos.js:54,122`). Hay que distinguir por **tipo de archivo y contexto**, no sólo por la presencia de una URL.
3. **`localhost` y los dominios reservados (RFC 2606/6761: `example.*`, `.test`, `.invalid`, `.localhost`) no son destinos externos.** Eso elimina el 14 % de las coincidencias sin tocar la seguridad. Sin confirmar: IP privadas (10/8, 172.16/12, 192.168/16) pueden ser el servicio interno del usuario; marcarlas.
4. Las pruebas del propio proyecto hostil usan `*.example`; un destino de prueba y uno real se distinguen por sufijo, no por intención.

## 3. Reglas propuestas (para medir, no para fijar)

| Nivel | Qué marca | Dónde | Acción en la primera entrega |
|---|---|---|---|
| R1 (alto) | Llamada de red con destino **literal nuevo**: argumento URL de `fetch`, `requests.*`, `http.get`, `axios.*`, `net.connect`, `curl/wget/nc/ssh` en scripts; o URL con esquema en archivos de configuración | Código ejecutable, scripts (`.sh`, `.ps1`, `Makefile`, `Dockerfile`, CI), configuración | Pedir revisión (mismo camino que `requiereRevision`) |
| R2 (medio) | Dirección IP pública literal en código ejecutable | Código | Avisar |
| R3 (bajo) | URL con esquema en comentario o documentación | `.md`, comentarios | **No marcar** (ruido medido: 62 % del total) |
| Excluidos | `localhost`, `127.0.0.0/8`, `0.0.0.0`, `::1`, `*.example`, `*.test`, `*.invalid`, `*.localhost`, destinos que ya estaban en el archivo anterior, destinos de la política del usuario | | |

Una URL construida (`"https://" + host`), un host leído de variable de entorno o una resolución dinámica **no se detectan**: falso negativo declarado (ya consta en sección 10 de la spec).

«Diferencia con el árbol anterior» (CA-002-04): comparar contra el **archivo** antes de escribir, no contra todo el proyecto. Con el archivo nuevo no hay anterior, y todo destino cuenta como nuevo, lo cual es correcto para R1 y ruidoso para R3 (excluido arriba). Sin confirmar: comparar contra todo el árbol evita marcar un host ya presente en otro archivo, pero hace caro el análisis (`MAX_ARCHIVOS` en `indice-vectorial.js`) y deja que un archivo hostil «ya presente» legitime el destino. Recomendación: **archivo anterior + política del usuario**, no todo el árbol.

## 4. Falsos positivos esperables (sin confirmar fuera de este corpus)

- Cadenas de documentación dentro de código (`"see https://…"`): R1 por contexto de llamada los evita; R3 no se marca.
- Esquemas XML/JSON-LD (`http://www.w3.org/2000/svg`, `http://json-schema.org/...`): URL con esquema en un archivo de configuración o de datos, que R1 marcaría. Lista de espacios de nombres conocidos como exclusión (sin medir su cobertura).
- Dependencias con URL en `package.json`/`requirements.txt`: ya detienen por `dependencias`.
- Código Go con importaciones `github.com/…`: no tienen esquema; no coinciden con el patrón.

## 5. Qué cambia en la spec o el plan

1. **CA-002-03** pasa de «una URL, IP o comando de red nuevo» a la tabla R1/R2 (por contexto, no por presencia); R3 explícitamente fuera.
2. **Pregunta abierta 3**: confirmada la recomendación («avisar» para destinos) con el dato: el 62 % de las coincidencias son documentación. En la primera entrega **sólo R1 pide revisión**; R2 avisa.
3. **CA-002-04** («por diferencia con el árbol anterior»): precisar «anterior = el mismo archivo antes de la escritura», no el proyecto entero.
4. **RF-04**: la política de destinos (`FORGE_INTEGRACIONES_DESTINOS` es el patrón citado) debe admitir comodines de dominio (`*.github.com`); sin confirmar que `core/integraciones/config.js` los admita hoy.
5. **Plan §8**: el corpus del spike es un solo proyecto; antes de pasar de «avisar» a «bloquear» hace falta medir al menos un proyecto Python y uno Go (sin hacer).

## 6. Riesgos

- Un modelo engañado puede escribir el destino con partes (`"ht"+"tps://"`): fuera del alcance de una regla de contenido (declarado).
- Pedir revisión por cada R1 en un proyecto que legítimamente llama a APIs externas paraliza el ciclo: necesita la política del usuario para evitar el cansancio de aprobación (riesgo ya declarado en ADR-22).

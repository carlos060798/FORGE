/**
 * contratos.js — Contratos de salida que el ciclo añade a cada agente (ADR-07)
 *
 * Los agentes de agents/*.md están escritos para Claude Code, donde disponen de
 * herramientas. En el motor headless solo devuelven texto: estos contratos les
 * dicen en qué formato, sin modificar los agentes.
 */

const FORMATO_ARCHIVOS = `Responde ÚNICAMENTE con un bloque JSON con esta forma, sin texto antes ni después:

\`\`\`json
{ "archivos": [ { "ruta": "ruta/relativa/al/proyecto.ext", "contenido": "contenido completo del archivo" } ] }
\`\`\`

Reglas:
- No dispones de herramientas: no puedes leer ni ejecutar nada. Todo lo que necesitas está en este mensaje.
- "ruta" es relativa a la raíz del proyecto. Nada de rutas absolutas ni de "..".
- "contenido" es el archivo entero, no un fragmento ni un diff.`;

export const CONTRATO_PLANNER = `## Contrato de salida (motor headless)

Descompón la tarea en pasos pequeños. No escribas código.

Responde ÚNICAMENTE con un bloque JSON con esta forma:

\`\`\`json
{ "pasos": ["paso 1", "paso 2"], "archivosObjetivo": ["ruta/relativa.ext"] }
\`\`\`

"archivosObjetivo" son los archivos del proyecto que habrá que crear o modificar.`;

export const CONTRATO_QA = `## Contrato de salida (motor headless)

Escribe las pruebas automáticas de esta tarea ANTES de que exista la implementación.
Otro agente implementará después y no podrá modificar tus pruebas.

${FORMATO_ARCHIVOS}
- Solo puedes escribir archivos de prueba (carpetas tests/, test/ o __tests__/, o nombres *.test.* / *.spec.* / test_*.py).
- Las pruebas deben fallar mientras no exista la implementación y pasar cuando sea correcta.
- No añadas dependencias nuevas: usa el ejecutor de pruebas que ya tiene el proyecto.`;

export const CONTRATO_CODER = `## Contrato de salida (motor headless)

Implementa lo necesario para que las pruebas dadas pasen.

${FORMATO_ARCHIVOS}
- No puedes modificar ni crear archivos de prueba: se rechazarán.
- No modifiques manifiestos de dependencias (package.json, requirements.txt, ...). Si de verdad
  hace falta una dependencia nueva, incluye el manifiesto modificado: el cambio no se aplicará
  y una persona lo revisará.
- Si recibes el resultado de una ejecución anterior, corrige la causa del fallo.`;

---
id: explicame
nombre: Explícame — transparencia del pipeline en lenguaje humano
descripcion: Lee el estado actual del proyecto y explica qué hizo FORGE, por qué, y qué sigue, sin usar jerga técnica.
aliases: ["/forge.explicame", "/forge why", "/forge explica"]
version: 1.0.0
---

# Skill: Explícame

## Propósito

Traducir el estado técnico del pipeline FORGE a lenguaje humano. Útil cuando el usuario no entiende qué acaba de pasar o qué debería hacer a continuación.

## Cuándo usar este skill

Úsalo cuando el usuario escriba:
- `/forge.explicame`
- `/forge why`
- `/forge explica`
- Cualquier pregunta sobre "¿qué está pasando?", "¿qué hizo FORGE?", "¿qué sigue?"

## Cómo funciona

1. Lee `.sdd/estado.json` para conocer el `pipeline_step` actual
2. Lee las últimas 10 líneas de `.sdd/observabilidad/consumo.jsonl` para saber qué agentes actuaron
3. Lee `.sdd/estado-tareas.json` si existe para ver qué tareas están completadas
4. Genera una explicación en 4 bloques en lenguaje natural

## Plantilla de respuesta

```
📍 **¿Dónde estamos?**
[Describir la fase actual del pipeline en lenguaje humano]

✅ **¿Qué acabo de hacer FORGE?**
[Resumir la acción más reciente: qué analizó, escribió o verificó]

🔮 **¿Qué va a pasar a continuación?**
[Describir el próximo paso del pipeline de forma concreta]

👤 **¿Qué puedes decidir tú ahora?**
[Si hay un gate de aprobación pendiente, explicarlo. Si no, decir qué es opcional]
```

## Traducciones de estados técnicos a lenguaje humano

| `pipeline_step` en estado.json | Lenguaje humano |
|---|---|
| `input` | FORGE está esperando que describas tu idea |
| `ir` | FORGE acaba de entender tu idea y la ha resumido internamente |
| `spec` | FORGE está redactando los requisitos detallados de tu proyecto |
| `spec_aprobada` | Has aprobado los requisitos — FORGE está listo para planificar |
| `plan` | FORGE está creando el plan de trabajo paso a paso |
| `plan_aprobado` | Has aprobado el plan — FORGE está listo para construir |
| `implementando` | FORGE está escribiendo el código de tu proyecto |
| `tests` | FORGE está comprobando que el código funciona correctamente |
| `verificando` | FORGE está revisando que todo cumple lo que pediste |
| `verificado` | Tu proyecto está completo y verificado — listo para usar |
| `desplegando` | FORGE está preparando tu proyecto para ponerlo en producción |

## Traducciones de acciones de agentes

| Agente | Qué hizo en lenguaje humano |
|---|---|
| `arquitecto` | Diseñó la estructura técnica del proyecto |
| `product-designer` | Definió cómo debe comportarse el producto |
| `desarrollador-backend` | Escribió el código del servidor |
| `desarrollador-frontend` | Escribió el código de la interfaz |
| `tester` | Escribió y ejecutó las pruebas automáticas |
| `critico` | Revisó el trabajo para encontrar problemas antes de continuar |
| `seguridad` | Verificó que no hay vulnerabilidades de seguridad |
| `documentador` | Escribió la documentación técnica |
| `disenador-api` | Definió los endpoints y contratos de la API |
| `asesor-datos` | Diseñó la base de datos y el modelo de datos |
| `operaciones` | Preparó la configuración de despliegue |

## Ejemplo de salida

Cuando `pipeline_step = "spec"` y el agente `product-designer` acaba de actuar:

```
📍 **¿Dónde estamos?**
FORGE está redactando los requisitos de tu proyecto. Es como si un consultor 
estuviera escribiendo el documento oficial de "qué exactamente vamos a construir" 
antes de tocar ningún código.

✅ **¿Qué acabo de hacer FORGE?**
El diseñador de producto analizó tu idea y está creando una lista detallada de:
- Qué funcionalidades tendrá el sistema
- Cómo se comportará en cada situación
- Qué no se va a construir (para no desviarse)

🔮 **¿Qué va a pasar a continuación?**
Cuando el spec esté listo, FORGE te lo presentará para que lo revises. 
Podrás decir "sí, así está bien", "cambia esto" o "falta esto otro".
Solo cuando apruebes el spec, FORGE pasará a crear el plan de trabajo.

👤 **¿Qué puedes decidir tú ahora?**
Nada — FORGE está trabajando. Puedes ver el progreso en el dashboard 
(`forge ui`) o esperar a que te presente el spec para revisarlo.
```

## Instrucciones para el agente que ejecuta este skill

Al recibir `/forge.explicame` o `/forge why`:

1. Lee `.sdd/estado.json`. Si no existe, responde: "FORGE aún no está inicializado en este directorio. Escribe `/forge 'tu idea'` para empezar."

2. Identifica el `pipeline_step` y busca la traducción en la tabla de estados.

3. Lee las últimas 5 entradas de `consumo.jsonl` para identificar el agente más reciente.

4. Construye la respuesta usando la plantilla de 4 bloques. Sé concreto y específico — menciona nombres de archivos si los ves en el estado.

5. **Nunca uses** las palabras: IR, PTC, confidence score, schemaVersion, frontmatter, JSONL, hook, PreToolUse, PostToolUse, pipeline_step, ledger. Tradúcelas siempre.

6. Si hay una aprobación pendiente (`gate_pendiente: true` en estado.json), hazlo muy visible en el bloque "¿Qué puedes decidir tú ahora?".

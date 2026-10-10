---
name: Reporte de fallo
about: Algo falla o no hace lo que dice la documentación (ciclo verificado, CLI, servidor MCP, API)
title: "[FALLO] "
labels: bug
assignees: ''
---

<!--
Antes de enviar:
1. Mira si ya está en docs/PROBLEMAS-CONOCIDOS.md. Si está, dilo abajo y cuenta qué añade tu caso.
2. NO pegues secretos. Lee el aviso del apartado «Registro de eventos» antes de copiar nada de .sdd/.
-->

## Qué pasó

<!-- Qué hiciste, qué esperabas y qué ocurrió. Dos o tres frases bastan. -->

## Entorno

| | |
|---|---|
| Versión de FORGE | <!-- npx forge --version --> |
| Cómo lo instalaste | <!-- npm install -g forja-mvp · npx -p forja-mvp@beta · clon del repositorio (indica el commit) --> |
| Sistema operativo | <!-- Windows 11 23H2 · Ubuntu 24.04 · macOS 15.1… --> |
| Versión de Node | <!-- node --version --> |
| Versión de Docker | <!-- docker --version; indica si es Docker Desktop, Docker Engine, Podman u otro. Si no usas Docker, dilo --> |
| Proveedor y modelo | <!-- anthropic / openai / ollama y el nivel o identificador. Sin la clave --> |
| Lenguaje del proyecto | <!-- JavaScript, TypeScript, Python, Go u otro --> |

## Comando

```
<!-- La orden exacta, con sus opciones. Por ejemplo: npx forge run --motor ciclo -->
```

Código de salida: <!-- 0, 1, 3 (espera una decisión), 4 (Docker no disponible) u otro -->

## Configuración relevante

```yaml
# Solo las secciones motor:, sandbox:, presupuesto: y llm: de .sdd/sdd.config.yaml.
# Quita api_key y cualquier otro valor secreto.
# Conserva la sangría tal como está en tu archivo: una sangría distinta de dos espacios cambia lo que se lee.
```

## Salida de la terminal

```
<!-- Lo que imprimió la orden. Si es larga, el final. -->
```

## Registro de eventos

<!--
El fragmento de .sdd/events.jsonl que rodea al fallo: desde el `task_started` de la tarea hasta el final.
Suelen bastar las últimas 30 a 50 líneas:

  Linux/macOS:  tail -n 50 .sdd/events.jsonl
  PowerShell:   Get-Content .sdd/events.jsonl -Tail 50

⚠️ REVISA EL FRAGMENTO ANTES DE PEGARLO. Este reporte es público.
FORGE limpia los secretos con formatos conocidos, pero no todos. El registro puede llevar:
  - líneas de tu código, antes y después de un cambio (eventos ciclo:mutante);
  - el detalle de una pausa, con el final de la salida de tus pruebas o de un comando (eventos task_paused);
  - rutas de tu equipo, con tu nombre de usuario;
  - nombres de archivos y de tareas de tu proyecto.
Busca y borra: claves de API, tokens, contraseñas, cadenas de conexión, direcciones internas y
cualquier dato de clientes. Sustitúyelos por [BORRADO]. Si dudas de una línea, quítala entera.
-->

```jsonl

```

## Otros datos, si ayudan

- Salida de `npx forge doctor`:
- Salida de `npx forge status`:
- Motivo que muestra `npx forge resume` (no gasta nada):
- ¿Se repite siempre o solo a veces?
- ¿Pasa también con `--motor clasico`?

## ¿Está en los problemas conocidos?

<!-- Identificador de docs/PROBLEMAS-CONOCIDOS.md (por ejemplo, C-10 o A-1) si se parece a alguno. -->

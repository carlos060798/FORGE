# Usar Fragua como pieza de otra herramienta: `verificar` por MCP

> Fase 1 de `.sdd/especificaciones/2026-10-14-ciclo-por-mcp/`. Solo verificación: sin modelo, sin gasto.

## Qué es

`fragua mcp --perfil verificacion` arranca un servidor MCP que expone **una sola herramienta**, `verificar`:
corre las pruebas del proyecto en un contenedor aislado (sin red, sin privilegios, con límites) y devuelve el
mismo resultado que `fragua verificar --json` (`formato: 1`).

| `veredicto` | Significa | ¿Éxito? |
|---|---|---|
| `pasa` | las pruebas se ejecutaron y pasaron | sí |
| `falla` | alguna prueba falló o se agotó el tiempo | no |
| `sin_pruebas` | cero pruebas ejecutadas | **no** |
| `infraestructura` | no hay Docker, no hay imagen preparada, etc. (llega con `isError: true`) | no |

Si la llamada ni siquiera se ejecuta (apagado, cupo, ocupado, tiempo, ruta no válida…), el cuerpo trae
`"veredicto": "no_ejecutada"` y un `codigo`: `apagado`, `cupo`, `contador_invalido`, `ocupado`, `tiempo`,
`cancelada`, `ruta_no_valida`. Nunca se confunde con «las pruebas fallan».

## Registrarlo en un cliente MCP

En el `.mcp.json` del cliente (Claude Code, Cursor, etc.). El proyecto sobre el que actúa es el de `--cwd`,
fijado al arrancar; la herramienta no recibe ninguna ruta de proyecto.

```json
{
  "mcpServers": {
    "fragua-verificar": {
      "command": "npx",
      "args": ["forge", "mcp", "--perfil", "verificacion", "--cwd", "/ruta/absoluta/al/proyecto"],
      "env": {
        "FRAGUA_MCP_TIMEOUT_S": "300",
        "FRAGUA_MCP_POR_HORA": "20",
        "FRAGUA_MCP_POR_DIA": "200"
      }
    }
  }
}
```

**Prepara la imagen antes**: ejecuta `fragua verificar` una vez en tu terminal. El servidor no descarga ni
construye imágenes por orden de un cliente (sería una salida a internet disparada por un agente); sin la
imagen ya preparada responde `infraestructura`.

## Qué NO hace

- No llama a ningún modelo, no lee claves y no gasta (por construcción: el módulo no importa proveedores).
- No escribe en el proyecto, ni fuera de él, ni publica, ni despliega, ni aprueba nada. No existen herramientas
  `escribir_archivo`, `leer_archivo` ni `ejecutar_pruebas` en este perfil: si el cliente las llama, recibe
  «herramienta desconocida».
- No acepta `comando`, `cwd`, rutas absolutas ni referencias de git (`desde`).
- No ejecuta nada fuera del contenedor. Sin Docker, no se ejecuta nada.
- No abre ningún puerto de red (solo entrada y salida estándar).

## Único argumento: `mutacion_archivos` (opcional)

Lista de 1 a 5 archivos **existentes del proyecto** cuya cobertura se mide por mutación (cambios deliberados
que las pruebas deberían detectar). Cada ruta pasa las reglas del ciclo (`validarRuta`): sin `..`, absolutas,
UNC, unidades, enlaces, `.git`, `.sdd`, secretos ni `node_modules`. `--desde` no se ofrece: obliga a ejecutar
`git` con un texto del llamante como referencia y a leer el repositorio; con `archivos` el llamante solo puede
nombrar archivos que ya están ahí. La medición alarga la llamada (hasta `mutacion_timeout_s`), que el
servidor sigue acotando con su propio tiempo máximo.

## Límites (los fija el usuario, en su entorno)

Ningún archivo del proyecto (`sdd.config.yaml`, etc.) los lee ni los puede aflojar.

| Variable | Por defecto | Techo | Efecto |
|---|---|---|---|
| `FRAGUA_MCP_TIMEOUT_S` | 300 | 1800 | tiempo máximo por llamada; al agotarse se detiene el contenedor |
| `FRAGUA_MCP_SALIDA_MAX_BYTES` | 16384 | 65536 | tamaño máximo de la respuesta (siempre JSON válido; recorta `salida`) |
| `FRAGUA_MCP_POR_HORA` / `_POR_DIA` | 20 / 200 | 1000 / 10000 | verificaciones permitidas; el contador está firmado en el estado del usuario |
| `FRAGUA_MCP_CICLO` | (activo) | | `apagado`, o un valor que no se reconoce, apaga la herramienta |
| `FRAGUA_MCP_PERFIL` | `completo` | | perfil si no se pasa `--perfil` (un nombre desconocido no arranca) |

Una verificación a la vez por proyecto (candado `proyecto.lock`, el mismo del servidor clásico y de los ciclos):
la segunda llamada recibe `ocupado`, no se encola. Los recursos del contenedor (CPU, memoria, procesos) siguen
sus techos de `sandbox.*` (un archivo del proyecto no puede pedir más que `TECHOS_SANDBOX`). Cada llamada deja
una línea en `mcp/auditoria.jsonl` del estado del usuario.

## Qué se puede garantizar sobre quién llama (honestamente)

El transporte es stdio y **el protocolo no trae autenticación ni identidad**: el «cliente» es el proceso que
lanzó el servidor, y la confianza es la de quien lo escribió en su `.mcp.json`. El servidor no puede distinguir
al usuario de un texto hostil que haya convencido al modelo del cliente. Por eso la defensa es **qué existe**,
no quién llama: una sola herramienta, sin escritura, sin gasto, con argumentos que no llegan a una orden y con
topes del usuario. Lo que no cubre: un cliente o extensión maliciosos con acceso al proceso padre controlan
ya al usuario; y el modelo del cliente puede agotar los cupos (denegación de servicio local, acotada).

## Cancelación

Si el cliente cancela una llamada (`notifications/cancelled`, revisión sin estado 2026-07-28) o se agota el
tiempo, el servidor detiene el contenedor por nombre (`docker kill` + `rm -f`) y no lanza más. Con las
revisiones con saludo (`initialize`) el protocolo de este servidor no propaga la cancelación a la herramienta:
la llamada termina por su tiempo máximo.

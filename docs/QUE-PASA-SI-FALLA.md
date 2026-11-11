# ¿Qué Pasa Si Algo Sale Mal? Guía de Recuperación

Este documento responde a las preguntas más comunes de usuarios no-técnicos cuando algo no sale como esperaban.

---

## Premisa: qué protege y qué no

Fragua no guarda tu código por su cuenta. Lo que te permite volver atrás es **Git**, y solo si lo usas:

- Si haces commit con frecuencia, puedes volver a cualquier commit (`git log`, `git checkout`).
- Si además haces push a GitHub u otro remoto, hay una copia fuera de tu equipo.
- Si no haces commit, un cambio mal hecho puede no tener vuelta atrás. Haz commit antes de lanzar `/sdd.implementar`.
- Lo que Fragua sí deja es un registro en `.sdd/` (spec, plan, tareas, aprobaciones en `.sdd/aprobaciones.jsonl`). Es un archivo del proyecto: léelo, no lo da por seguro nadie más.

Las secciones de abajo describen el comportamiento esperado de los comandos; no se han ejecutado de extremo a extremo contra Vercel ni GitHub reales (no verificado, ver [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md)).

---

## Escenario 1: "El deploy falló — mi app no está en internet"

### ¿Por qué pasó?

```
Vercel rechazó el código porque:
→ Falta una variable de entorno
→ Un archivo obligatorio no se generó
→ El código tiene un error que no detectamos en pruebas
```

### ¿Qué hago?

**Opción A: Reintentar** (si fue un error pasajero)

```
Claude responde:
"Voy a intentar publicar de nuevo..."

[Reintentos automáticos con espera]
```

**Opción B: Arreglar el código**

```
Si el error es técnico (variable faltante, etc.):

Tú dices: "Cambio X cosa"
Claude: "¿Qué cambias?"
Tú: "Agrega soporte para pagos"

Claude:
1. Edita el código
2. Prueba de nuevo
3. Intenta publicar

Tu versión anterior sigue en GitHub → sin miedo de cambiar
```

**Opción C: Esperar y intentar después**

```
Tú dices: "Dejar para después"

Claude:
✅ Tu código está seguro en GitHub
✅ Puedes intentar publicar mañana
✅ Nada se perdió
```

---

## Escenario 2: "Cambié de idea a mitad del proceso"

### Caso: Empezamos a construir, pero quiero otra cosa

**Ejecuta `/sdd.constitucion` de nuevo:**

```
Claude detecta: "Ya hay una constitución"

¿Quieres actualizar los principios?

Tú: "Sí, cambio X"

Claude:
1. Actualiza la constitución
2. Carga la especificación anterior
3. ¿Modifico la especificación también?
```

**Lo que NO se pierde:**

```
✅ Especificación anterior (en GitHub)
✅ Plan anterior (en GitHub)
✅ Código que se construyó (en GitHub — rama anterior)

Tú empiezas una nueva rama con los cambios.
Si cambias de idea de vuelta, la anterior sigue disponible.
```

---

## Escenario 3: "Publiqué pero después quiero cambiar algo"

### Opción A: Cambio rápido (antes de compartir)

```
Tú dices: "Cambio el color del botón"

Claude:
1. Edita el código
2. Prueba
3. Publica la nueva versión (3 minutos)

Usuarios no notan nada (refresca la página y ven la versión nueva)
```

### Opción B: Cambio importante (que afecta datos)

```
Tú dices: "Quiero agregar una nueva pregunta al formulario"

Claude:
1. Actualiza la especificación
2. Genera un plan
3. Pide tu aprobación
4. Construye
5. Prueba
6. Publica

[Igual que la primera vez, pero más rápido porque ya tiene contexto]
```

### Opción C: "Me arrepiento — vuelvo a la versión anterior"

```
Tú dices: "Vuelve a cómo estaba hace 2 horas"

Claude:
1. Ve a GitHub
2. Encuentra ese commit
3. Publica esa versión

Tu sitio está igual que antes. Sin pérdida de datos.
```

---

## Escenario 4: "Mi cliente dice que algo no funciona"

### Paso 1: Reproducir el problema

```
Tú dices: "Mi cliente dice que X no funciona"

Claude:
1. Prueba el sitio en vivo
2. Intenta reproducir el problema
3. Pregunta: "¿Qué exactamente hizo tu cliente?"
```

**Ejemplo:**

```
Tú: "Mi cliente dice que el formulario no calcula el precio"

Claude:
"¿A qué tipo de proyecto selecciona?"
Tú: "Logo simple"

Claude:
"¿Cuántas revisiones elige?"
Tú: "Normal"

[Claude llena el formulario con esos datos]

Claude:
"Aquí veo el problema: el precio dice $200, pero debería ser $300"
```

### Paso 2: Identificar la causa

```
Claude diagnostica:

❌ Error de cálculo (la fórmula está mal)
❌ Falta una opción (ej: urgencia 24 horas)
❌ Base de datos no guarda bien los datos
✅ Problema del navegador del cliente (caché viejo)
```

### Paso 3: Arreglar

**Si es cálculo incorrecto:**

```
Tú: "El precio está mal"

Claude:
"¿Cuál debería ser el precio correcto para logo + normal?"
Tú: "$400"

Claude:
1. Edita la fórmula
2. Prueba con diferentes opciones
3. Publica

Listo. Tu cliente verá el precio correcto.
```

**Si es caché del navegador:**

```
Claude:
"Dile a tu cliente que actualice la página (Ctrl+F5 o Cmd+Shift+R)"

Eso borra la copia antigua del sitio de su navegador
y carga la versión nueva.
```

---

## Escenario 5: "¿Qué pasa si GitHub desaparece?"

### Respuesta: No es realista, pero aquí está el plan

```
GitHub es propiedad de Microsoft. Es tan importante como AWS o Google.
La probabilidad de que desaparezca es 0.001%.

Pero si quieres dormir tranquilo:

1. Tu código está en Vercel también (servidor en vivo)
2. Puedes hacer "backup" a tu computadora en cualquier momento
   (comando: git clone https://github.com/tu-user/tu-repo)
3. Puedes mover tu repo a GitLab o Gitea en 5 minutos
```

---

## Escenario 6: "¿Qué pasa si Vercel cobra y no puedo pagar?"

### Respuesta: No sucede sin advertencia

```
Vercel es gratis hasta 100GB de ancho de banda (datos descargados).

Si algo cambia:
1. Te lo avisan con 30 días de anticipación
2. Tu sitio NO desaparece (sigue funcionando)
3. Puedes mover a otro servidor gratis (Netlify, Railway, etc.)
4. Tus datos en GitHub no se pierden

Claude puede ayudarte a mover en 30 minutos.
```

---

## Escenario 7: "¿Qué pasa si cambia mi requerimiento legal?"

### Ejemplo: Necesito cumplir GDPR, HIPAA, etc.

```
Tú: "Mi cliente quiere que el sitio cumpla GDPR"

Claude:
1. Ejecuta /sdd.compliance automáticamente
2. Identifica qué falta
3. Genera un plan
4. Pregunta: "¿Apruebo estos cambios?"
5. Implementa

Ejemplo de cambios:
- Agregar "política de privacidad"
- Permitir que usuarios descarguen sus datos
- Encriptar datos sensibles
- Otros cambios específicos
```

---

## Escenario 8: "¿Qué pasa si alguien hackea mi sitio?"

### Respuesta: Fragua reduce el riesgo, no lo elimina

```
Durante el proceso, si ejecutas los comandos de seguridad:

- El agente de seguridad revisa el código; es un modelo, puede dejarse cosas.
- Los secretos en lo que escribe el modelo se rechazan (garantía G13 de [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md)).
- Nada de esto sustituye una auditoría de seguridad independiente

Si algo pasara:

1. Git registra quién cambió qué, si hiciste commit
2. Puedes volver a una versión anterior con Git
3. Investigar qué pasó (historial de cambios)
```

---

## Escenario 9: "¿Y si alguien lo copia?"

### Respuesta: Depende del contexto

```
Casos:

❌ Algo muy valioso (algoritmo secreto, datos únicos)
   → Considera cerrar el repo (private en GitHub)
   → Requiere autenticación para acceder al sitio

✅ Algo público (herramienta útil, componente reutilizable)
   → Está bien que la copien
   → Agrega tu licencia (MIT: "úsalo gratis, dame crédito")
```

---

## Escenario 10: "Pasó algo raro — no sé qué está mal"

### Paso 1: Ejecutar el diagnóstico

```
Tú: "Algo no funciona bien"

Claude:
"Voy a revisar todo..."

Ejecuta en una terminal: `fragua doctor` (no existe un comando `/sdd.doctor` dentro de Claude Code)

Este comando verifica Node, la clave de API, Docker, los hooks, la configuración y la conexión con el modelo. Salida real (recortada):
✓ Node 24.20.0 (>=20 requerido) ✓
✓ commands/ (39 entradas)
⚠  ANTHROPIC_API_KEY no está definida — los agentes LLM no funcionarán
✓ Docker 29.7.2 disponible ✓
⚠  9 problema(s) detectado(s). Revisa arriba.
```

### Paso 2: Obtener un reporte

```
Claude te muestra:

DIAGNOSTICO:
✅ Código bien
✅ Tests pasando
❌ Base de datos no conecta

CAUSA PROBABLE:
El archivo de base de datos se eliminó accidentalmente.

SOLUCION:
Voy a restaurar desde GitHub...
```

---

## Resumen: qué depende de qué

| Problema | Qué lo hace reversible | Condición |
|----------|------------------------|-----------|
| Deploy falló | Reintentar el deploy | Que el error sea pasajero; si es de código, hay que corregirlo |
| Cambié de idea | Una rama de Git | Que hayas hecho commit antes |
| Cliente reporta bug | Un fix con su prueba | Que se pueda reproducir |
| Un cambio mal hecho | `git revert` o `git checkout` | Que ese cambio esté en un commit |

## Si necesitas ayuda

Describe el problema a Claude con el contenido de `.sdd/` (spec, plan, tareas) y la salida de `fragua doctor` y `fragua status`. Eso le da contexto, pero no garantiza que pueda arreglarlo. Problemas conocidos: [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md).

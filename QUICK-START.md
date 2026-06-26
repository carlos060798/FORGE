# Empieza aquí — de tu idea a una app, sin programar

FORGE convierte una idea escrita en lenguaje normal en una aplicación real,
probada y lista para usar. **No necesitas saber programar.** Tú describes qué
quieres; FORGE decide lo técnico, lo construye y te explica cada paso sin jerga.

> ¿Eres desarrollador y quieres control técnico fino? Salta a
> [docs/INICIO-RAPIDO.md](docs/INICIO-RAPIDO.md) (modo avanzado).

---

## En 3 pasos

### 1. Instala FORGE

En tu terminal:

```bash
npx forge init
```

Esto deja FORGE listo dentro de Claude Code. Solo se hace una vez.

> **Nota:** Si `npx forge init` falla (conflicto con otro paquete `forge`), usa:
> ```bash
> npx forge-sdd init   # nombre exacto del paquete npm
> # o instala globalmente:
> npm install -g forge-sdd
> forge init
> ```

### 2. Cuéntale tu idea

Abre Claude Code y escribe `/sdd` seguido de lo que quieres, con tus palabras:

```
/sdd quiero una app para llevar los gastos de mi casa cada mes
```

No hace falta que uses términos técnicos. Frases como estas funcionan perfecto:

- *"una página donde mis clientes reserven cita"*
- *"una lista de tareas que pueda compartir con mi equipo"*
- *"un catálogo de productos con buscador"*

### 3. Di "sí" y mira cómo se construye

FORGE te guía con **una pregunta a la vez** y te pide confirmación antes de
cada paso importante. Tú solo respondes en lenguaje normal:

```
FORGE: Entendí: una app para registrar y ver tus gastos mensuales.
       ¿Las quieres ver también en una gráfica? (sí / no)
Tú:    sí

FORGE: Voy a diseñar cómo se ve y luego la construyo entera. ¿Arranco? (sí)
Tú:    sí
```

Cuando termina, te dice **qué puedes hacer ahora** con lo construido
(usarla, publicarla en internet, cambiar algo o invitar a otros).

---

## Qué pasa por dentro (no necesitas hacerlo tú)

FORGE recorre solo este camino y te lo cuenta en lenguaje sencillo:

| FORGE dice… | Lo que ocurre por dentro |
|-------------|--------------------------|
| "Déjame entender tu idea" | Interpreta tu petición |
| "Decido cómo se ve y funciona" | Diseña pantallas y elige la tecnología |
| "Lo estoy construyendo" | Genera el código completo |
| "Estoy probando que funcione" | Ejecuta pruebas automáticas |
| "Lo publico en internet" | Lo despliega (solo si tú lo pides) |

**La calidad no baja por ser modo guiado.** Aunque no lo veas, FORGE siempre:

- escribe pruebas y no dice "listo" hasta que pasan,
- revisa el código con un revisor independiente,
- nunca deja contraseñas o claves a la vista,
- te pide permiso antes de cualquier acción que no se pueda deshacer.

---

## Si algo no se entiende

En cualquier momento puedes escribir:

- **"no entiendo"** → FORGE pausa y te lo explica con un ejemplo del día a día.
- **"cámbialo"** → ajusta lo que no te gustó.
- **"¿qué puedo hacer ahora?"** → te lista tus opciones.

---

## Configura FORGE para tu proyecto (opcional)

### Personalización (opcional)
La configuración real de FORGE vive en `.sdd/sdd.config.yaml` (creado automáticamente por `forge init`).
Para ver todas las opciones: `forge config show`
Para cambiar un valor: `forge config set sesion.modo experto`

Sin este archivo, FORGE usa valores predeterminados seguros. **No es obligatorio.**

¿Qué protege FORGE aunque no configures nada?

- Nunca ejecuta comandos que puedan borrar archivos importantes (`rm -rf`, `DROP DATABASE`).
- Detecta contraseñas y claves secretas antes de que queden escritas en el código.
- Los agentes que solo diseñan (arquitecto, revisor) no pueden modificar archivos de código.
- Registra qué cambió cada agente para que puedas rastrear decisiones.

**Más detalles:** [docs/guardrails.md](docs/guardrails.md)

---

## ¿Listo?

```
/sdd  [tu idea aquí]
```

Eso es todo. Cuéntale qué quieres construir y deja que FORGE haga el resto.

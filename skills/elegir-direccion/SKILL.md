---
description: Direction picker inspirado en open-design. Selecciona 3 de las 5 direcciones visuales disponibles según el tipo de producto y audiencia del IR, y el usuario elige una antes de generar cualquier diseño.
model: sonnet
allowed-tools: Read, Write
---

# Skill: Elegir Dirección Visual

## Propósito

Antes de diseñar pantallas, el usuario elige **una dirección visual** que guiará todo el diseño del proyecto. Esta elección activa el DESIGN.md correspondiente y define paleta, tipografía, y estilo de componentes.

---

## Contexto que leer primero

```bash
cat .sdd/ir.json 2>/dev/null | node -e "
  const ir = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('type:', ir.product?.type);
  console.log('users:', ir.product?.target_users);
  console.log('name:', ir.product?.name);
"
```

---

## Las 5 direcciones disponibles

| Slug | Nombre | Ideal para |
|------|--------|-----------|
| `neutral-modern` | Neutral Moderno | SaaS B2B, dashboards, herramientas, apps de productividad |
| `warm-editorial` | Editorial Cálido | Blogs, marketplaces de nicho, apps culturales, contenido |
| `bold-brutalist` | Bold Brutalist | Herramientas dev, portfolios, startups técnicas, CLI wrappers |
| `editorial-minimal` | Editorial Minimal | Firmas profesionales, consultoras, galerías, portfolios premium |
| `vibrant-consumer` | Vibrant Consumer | Apps B2C, educación, fitness, entretenimiento, onboarding |

---

## Lógica de selección — cuáles 3 mostrar

Basado en `product.type` y `target_users` del IR:

| Tipo | Audiencia | Mostrar (orden de recomendación) |
|------|-----------|----------------------------------|
| `saas` | B2B / profesionales | Neutral Modern, Bold Brutalist, Editorial Minimal |
| `saas` | B2C / consumidores | Neutral Modern, Vibrant Consumer, Warm Editorial |
| `web` | General | Neutral Modern, Vibrant Consumer, Warm Editorial |
| `mobile` | Consumidores | Vibrant Consumer, Neutral Modern, Warm Editorial |
| `mobile` | Profesionales | Neutral Modern, Bold Brutalist, Vibrant Consumer |
| `api` / `cli` | Desarrolladores | Bold Brutalist, Neutral Modern, Editorial Minimal |
| `landing` / marketing | Cualquiera | Bold Brutalist, Vibrant Consumer, Neutral Modern |
| Contenido / editorial | Lectores | Warm Editorial, Editorial Minimal, Neutral Modern |
| Portfolio / agencia | Clientes premium | Editorial Minimal, Bold Brutalist, Warm Editorial |

Si no hay IR o el tipo no está claro → mostrar: **Neutral Modern, Vibrant Consumer, Bold Brutalist**.

---

## Flujo

### Paso 1: Determinar las 3 opciones a mostrar

Analiza el IR y selecciona las 3 direcciones más adecuadas según la tabla de arriba. Ordénalas de más a menos recomendada.

### Paso 2: Mostrar las 3 opciones al usuario

Presenta las 3 opciones con descripción visual, paleta de colores y tipografía:

```
Elige la dirección visual para [product.name]:

┌─────────────────────────────────────────────────────────┐
│  1. [NOMBRE DE LA DIRECCIÓN 1]                          │
│     [Descripción de 2 líneas: qué sensación transmite   │
│     y para qué tipo de producto es ideal]               │
│                                                         │
│     Paleta: [color bg] [color text] [color accent]      │
│     Fuente: [nombre de la fuente principal]             │
│     Estilo: [3–4 palabras del estilo visual]            │
├─────────────────────────────────────────────────────────┤
│  2. [NOMBRE DE LA DIRECCIÓN 2]                          │
│     [Descripción]                                       │
│                                                         │
│     Paleta: [...]                                       │
│     Fuente: [...]                                       │
│     Estilo: [...]                                       │
├─────────────────────────────────────────────────────────┤
│  3. [NOMBRE DE LA DIRECCIÓN 3]                          │
│     [Descripción]                                       │
│                                                         │
│     Paleta: [...]                                       │
│     Fuente: [...]                                       │
│     Estilo: [...]                                       │
└─────────────────────────────────────────────────────────┘

Escribe 1, 2 o 3 (o descríbeme qué buscas):
```

**Datos de cada dirección para el display:**

| Dirección | Paleta (bg / text / accent) | Fuente | Estilo |
|-----------|---------------------------|--------|--------|
| Neutral Modern | ⬜ #FAFAFA / ⬛ #111111 / 🔵 #2563EB | Inter | Limpio, funcional, espacioso |
| Warm Editorial | 🟫 #FAF8F4 / 🟤 #2C2416 / 🔴 #C0392B | Playfair Display | Editorial, cálido, tipográfico |
| Bold Brutalist | ⬛ #0A0A0A / ⬜ #F5F5F5 / 🟡 #F0E040 | Space Grotesk 900 | Impactante, UPPERCASE, offset shadow |
| Editorial Minimal | ⬜ #FFFFFF / ⬛ #0A0A0A / ⬛ #0A0A0A | Cormorant Garamond | Silencioso, espacio vacío, austero |
| Vibrant Consumer | 💜 #F8F7FF / 🟣 #1A1535 / 🟣 #6C3FF5 | Nunito 900 | Energético, redondeado, colorido |

### Paso 3: Procesar la elección

El usuario escribe `1`, `2`, `3`, o una descripción libre.

**Mapeo de respuestas libres:**
- "neutral" / "limpio" / "moderno" / "profesional" → `neutral-modern`
- "cálido" / "editorial" / "revista" / "warm" → `warm-editorial`
- "bold" / "brutal" / "oscuro" / "impactante" / "técnico" → `bold-brutalist`
- "minimal" / "minimalista" / "austero" / "elegante" / "premium" → `editorial-minimal`
- "colorido" / "vibrant" / "energía" / "dinámico" / "consumidor" → `vibrant-consumer`

Si el usuario describe algo ambiguo, elige la más cercana y explica por qué:
```
Entendido. Usaré [Dirección] — [razón en 1 frase].
Si prefieres otra, escribe el número o descríbela.
```

### Paso 4: Activar el DESIGN.md

Lee el DESIGN.md de la dirección elegida:

```bash
DIRECTION="[slug elegido]"
cat "{PLUGIN_DIR}/design-systems/$DIRECTION/DESIGN.md"
```

Guarda la elección en `.sdd/estado.json`:

```bash
node -e "
  const fs = require('fs');
  const p = '.sdd/estado.json';
  const estado = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  estado.design_direction = '$DIRECTION';
  estado.design_system_path = '{PLUGIN_DIR}/design-systems/$DIRECTION/DESIGN.md';
  estado.ultima_actualizacion = new Date().toISOString();
  fs.mkdirSync('.sdd', { recursive: true });
  fs.writeFileSync(p, JSON.stringify(estado, null, 2));
"
```

### Paso 5: Confirmar

```
✅ Dirección elegida: [Nombre de la dirección]

El diseño de [product.name] usará:
  • Paleta: [colores principales del DESIGN.md]
  • Tipografía: [fuentes del DESIGN.md]
  • Estilo: [descriptor de 1 línea]

Continuando con el diseño de pantallas...
```

No pedir confirmación adicional — pasar directo al agente `product-designer`.

---

## Salida guardada

```
.sdd/estado.json → campos "design_direction" + "design_system_path"
```

El DESIGN.md activo se referencia en `product-design.json` bajo `design_system_ref`.

---

## Notas

- Esta skill nunca genera código HTML ni diseño — solo selecciona la dirección
- El DESIGN.md activo es la guía para **todo** lo que viene después (wireframe, UI, crítica)
- Si el usuario quiere cambiar de dirección: `/sdd.diseñar cambiar-direccion`
- Las 5 direcciones disponibles son: Neutral Modern, Warm Editorial, Bold Brutalist, Editorial Minimal, Vibrant Consumer
- Siempre se muestran exactamente 3 opciones — las más adecuadas para el IR — no las 5

---
description: Exporta el proyecto como bundle portable. Detecta qué agentes/skills/comandos se usaron desde estado.json y genera {nombre}-forge-bundle/ con solo esas piezas + el proyecto + INSTALL.md.
allowed-tools: Read, Write, Bash
---

# /sdd.exportar — Exportar Bundle

**Uso:**
```
/sdd.exportar
/sdd.exportar --completo     ← incluye todos los componentes de FORGE, no solo los usados
/sdd.exportar --solo-codigo  ← solo el código del proyecto (sin los archivos .sdd/)
/sdd.exportar --zip          ← genera un archivo ZIP del bundle
```

---

## PASO 1 — Detectar qué se usó

```bash
node -e "
  const fs = require('fs');

  // Leer estado
  const estado = JSON.parse(fs.existsSync('.sdd/estado.json')
    ? fs.readFileSync('.sdd/estado.json', 'utf8') : '{}');

  const usados = {
    ir: !!estado.ir_generado,
    product_design: !!estado.product_design_generado,
    design_direction: estado.design_direction || null,
    tiene_wireframe: fs.existsSync('.sdd/diseño/wireframe-pantalla-principal.html'),
    tiene_spec: !!estado.spec_activa,
    tiene_plan: !!estado.plan_activo,
    pipeline_completado: estado.pipeline_step === 'done',
  };

  console.log(JSON.stringify(usados, null, 2));
"
```

---

## PASO 2 — Determinar componentes del bundle

Según lo que se usó, incluir solo los archivos relevantes:

```
SIEMPRE incluir:
  sdd-lite/commands/sdd.md              ← hub principal
  sdd-lite/commands/sdd.interpretar.md
  sdd-lite/skills/descubrir-idea/SKILL.md
  sdd-lite/skills/interpretar-idea/SKILL.md
  sdd-lite/core/ir.types.ts
  .sdd/ir.json                          ← el IR del proyecto
  INSTALL.md                            ← generado por este comando

SI se usó el diseño:
  sdd-lite/commands/sdd.diseñar.md
  sdd-lite/skills/elegir-direccion/SKILL.md
  sdd-lite/agents/product-designer.md
  sdd-lite/agents/architecture-designer.md
  sdd-lite/skills/wireframe-mvp/SKILL.md
  sdd-lite/skills/critica-diseno/SKILL.md
  design-systems/{direction}/DESIGN.md  ← solo la dirección usada
  craft/anti-ai-slop.md
  .sdd/product-design.json
  .sdd/diseño/                          ← wireframe + crítica

SI se completó el pipeline:
  sdd-lite/commands/sdd.construir.md
  sdd-lite/core/ir-to-spec-mapper.ts
  sdd-lite/core/project-memory.ts
  sdd-lite/commands/sdd.exportar.md
  .sdd/spec-draft.json
  [código generado del proyecto]

SIEMPRE excluir:
  node_modules/
  .git/
  *.log
  forge.config.json     ← contiene API keys
```

---

## PASO 3 — Crear el bundle

```bash
node -e "
const fs = require('fs');
const path = require('path');

// ── Leer estado ────────────────────────────────────────────────────────────
const estado = JSON.parse(fs.existsSync('.sdd/estado.json')
  ? fs.readFileSync('.sdd/estado.json', 'utf8') : '{}');
const ir = fs.existsSync('.sdd/ir.json')
  ? JSON.parse(fs.readFileSync('.sdd/ir.json', 'utf8')) : null;

if (!ir) {
  console.error('Error: no hay IR todavía. Ejecuta /sdd.interpretar primero.');
  process.exit(1);
}

const productName = ir.product.name.toLowerCase().replace(/\s+/g, '-');
const timestamp = new Date().toISOString().slice(0, 10);
const BUNDLE = \`\${productName}-forge-bundle\`;
const FORGE_ROOT = path.resolve(__dirname, '..');  // raíz del repo FORGE

// ── Helper: copiar archivo con creación de directorios ─────────────────────
function cp(src, dest) {
  const absS = path.join(FORGE_ROOT, src);
  const absD = path.join(BUNDLE, dest || src);
  if (!fs.existsSync(absS)) return;
  fs.mkdirSync(path.dirname(absD), { recursive: true });
  fs.copyFileSync(absS, absD);
}

function cpDir(src, dest) {
  const absS = path.join(FORGE_ROOT, src);
  const absD = path.join(BUNDLE, dest || src);
  if (!fs.existsSync(absS)) return;
  copyDirSync(absS, absD);
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ── Crear directorio del bundle ────────────────────────────────────────────
if (fs.existsSync(BUNDLE)) fs.rmSync(BUNDLE, { recursive: true });
fs.mkdirSync(BUNDLE, { recursive: true });

const incluidos = [];

// ── SIEMPRE: componentes base del Interpreter ──────────────────────────────
const base = [
  ['sdd-lite/commands/sdd.md', 'sdd-lite/commands/sdd.md'],
  ['sdd-lite/commands/sdd.interpretar.md', 'sdd-lite/commands/sdd.interpretar.md'],
  ['sdd-lite/skills/descubrir-idea/SKILL.md', 'sdd-lite/skills/descubrir-idea/SKILL.md'],
  ['sdd-lite/skills/interpretar-idea/SKILL.md', 'sdd-lite/skills/interpretar-idea/SKILL.md'],
  ['sdd-lite/core/ir.types.ts', 'sdd-lite/core/ir.types.ts'],
];
for (const [s, d] of base) { cp(s, d); incluidos.push(d); }

// .sdd/ir.json
fs.mkdirSync(path.join(BUNDLE, '.sdd'), { recursive: true });
fs.copyFileSync('.sdd/ir.json', path.join(BUNDLE, '.sdd', 'ir.json'));
incluidos.push('.sdd/ir.json');

// ── SI se usó diseño ───────────────────────────────────────────────────────
const hasDesign = estado.product_design_generado && fs.existsSync('.sdd/product-design.json');
if (hasDesign) {
  const designFiles = [
    ['sdd-lite/commands/sdd.diseñar.md', null],
    ['sdd-lite/skills/elegir-direccion/SKILL.md', null],
    ['sdd-lite/agents/product-designer.md', null],
    ['sdd-lite/agents/architecture-designer.md', null],
    ['sdd-lite/skills/wireframe-mvp/SKILL.md', null],
    ['sdd-lite/skills/critica-diseno/SKILL.md', null],
    ['{PLUGIN_DIR}/craft/anti-ai-slop.md', 'craft/anti-ai-slop.md'],
  ];
  for (const [s] of designFiles) { cp(s, s); incluidos.push(s); }

  // Design system activo
  const dir = estado.design_direction || 'neutral-modern';
  // fuente en {PLUGIN_DIR}, destino relativo en el bundle (portable)
  cpDir(\`{PLUGIN_DIR}/design-systems/\${dir}\`, \`design-systems/\${dir}\`);
  incluidos.push(\`design-systems/\${dir}/DESIGN.md\`);

  // Archivos .sdd de diseño
  fs.copyFileSync('.sdd/product-design.json', path.join(BUNDLE, '.sdd', 'product-design.json'));
  incluidos.push('.sdd/product-design.json');

  if (fs.existsSync('.sdd/diseño')) {
    copyDirSync('.sdd/diseño', path.join(BUNDLE, '.sdd', 'diseño'));
    incluidos.push('.sdd/diseño/');
  }
}

// ── SI se completó el pipeline ─────────────────────────────────────────────
const pipelineDone = estado.pipeline_step === 'done' || !!estado.spec_activa;
if (pipelineDone) {
  const pipeFiles = [
    ['sdd-lite/commands/sdd.construir.md', null],
    ['sdd-lite/core/ir-to-spec-mapper.ts', null],
    ['sdd-lite/core/project-memory.ts', null],
  ];
  for (const [s] of pipeFiles) { cp(s, s); incluidos.push(s); }

  if (fs.existsSync('.sdd/spec-draft.json')) {
    fs.copyFileSync('.sdd/spec-draft.json', path.join(BUNDLE, '.sdd', 'spec-draft.json'));
    incluidos.push('.sdd/spec-draft.json');
  }
}

// ── estado.json (sin API keys) ─────────────────────────────────────────────
const estadoClean = { ...estado };
delete estadoClean.api_key;
delete estadoClean.api_key_encrypted;
fs.writeFileSync(path.join(BUNDLE, '.sdd', 'estado.json'), JSON.stringify(estadoClean, null, 2));
incluidos.push('.sdd/estado.json');

// ── Generar INSTALL.md ─────────────────────────────────────────────────────
const install = [
  '# ' + ir.product.name + ' — Forge Bundle',
  '',
  'Generado el ' + timestamp + ' con FORGE.',
  '',
  '## Qué contiene este bundle',
  '',
  incluidos.map(f => '- \`' + f + '\`').join('\n'),
  '',
  '## Cómo usarlo',
  '',
  '### Con Claude Code',
  '',
  '1. Copia este bundle a tu proyecto',
  '2. Abre el proyecto en Claude Code',
  '3. Usa los comandos:',
  '   - \`/sdd.diseñar\` → continuar con el diseño',
  '   - \`/sdd.construir\` → generar el código',
  '',
  '### Ver el wireframe',
  '',
  hasDesign && fs.existsSync('.sdd/diseño/wireframe-pantalla-principal.html')
    ? 'Abre \`.sdd/diseño/wireframe-pantalla-principal.html\` en cualquier navegador.'
    : '(Sin wireframe en este bundle)',
  '',
  '---',
  'Generado por FORGE — From idea to product, forged locally.',
].join('\n');

fs.writeFileSync(path.join(BUNDLE, 'INSTALL.md'), install);

console.log('');
console.log('✅ Bundle generado: ' + BUNDLE + '/');
console.log('   Archivos incluidos: ' + incluidos.length);
console.log('   (forge.config.json y .git excluidos por seguridad)');
console.log('');
"
```

---

## PASO 4 — Generar INSTALL.md

Crear `{bundle}/INSTALL.md` con instrucciones para el destinatario:

```markdown
# {product.name} — Forge Bundle

Generado el {fecha} con FORGE v{version}.

## Qué contiene este bundle

- `sdd-lite/` — Comandos y agentes de FORGE para Claude Code
- `.sdd/` — Contexto del proyecto (IR, diseño, wireframes)
- `craft/` — Reglas de diseño
- `design-systems/` — Sistema visual {direction}
{si hay código: - `src/` — Código base generado}

## Cómo usarlo

### Opción A: En un proyecto nuevo con Claude Code

1. Copia este bundle a la raíz de tu proyecto
2. Abre el proyecto con Claude Code
3. Usa los comandos disponibles:
   - `/sdd.diseñar` — continuar el diseño
   - `/sdd.construir` — generar el código
   - `/sdd.estado` — ver el estado del proyecto

### Opción B: Revisar el diseño

El wireframe de la pantalla principal está en:
`.sdd/diseño/wireframe-pantalla-principal.html`

Ábrelo en cualquier navegador para ver el diseño visual.

## Componentes incluidos

{lista generada automáticamente de lo que está en el bundle}

---
Generado por FORGE — From idea to product, forged locally.
```

---

## PASO 5 — Comprimir (si `--zip`)

```bash
if [ "$ZIP_MODE" = "true" ]; then
  ZIP_NAME="${PRODUCT_NAME}-forge-bundle-${TIMESTAMP}.zip"
  zip -r "$ZIP_NAME" "$BUNDLE_DIR"
  rm -rf "$BUNDLE_DIR"
  echo "✅ Bundle comprimido: $ZIP_NAME"
else
  echo "✅ Bundle en: $BUNDLE_DIR/"
fi
```

---

## Resumen final

```
═══════════════════════════════════════════
📦 BUNDLE EXPORTADO
═══════════════════════════════════════════

Producto: [product.name]
Bundle: [nombre]-forge-bundle/
Tamaño estimado: [N] archivos, [X] KB

Contenido:
  ✅ IR y análisis (.sdd/ir.json)
  ✅ Diseño de producto (.sdd/product-design.json)
  ✅ Wireframe (.sdd/diseño/)
  [✅ Spec y código si está completo]
  ✅ Instrucciones (INSTALL.md)

Componentes FORGE incluidos:
  [lista de comandos/skills/agentes copiados]

¿Qué sigue?
  Comparte la carpeta [nombre]-forge-bundle/ con tu equipo
  o abre el proyecto con Claude Code en otro equipo.
```

---

## Notas de seguridad

- El archivo `.sdd/forge.config.json` (con API keys) **nunca** se incluye en el bundle
- Los archivos `.env` y credenciales se excluyen automáticamente
- El bundle no contiene datos de la conversación, solo el output del pipeline

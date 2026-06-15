// @ts-check
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, extname, basename } from "path";

/**
 * @typedef {{ framework:string, cssApproach:string, hasTokenFile:boolean }} Stack
 * @typedef {{ colors:Record<string,string>, spacing:Record<string,string>, typography:{ fontFamilies:string[], fontSizes:Record<string,string>, fontWeights:Record<string,string> }, breakpoints:Record<string,string>, borderRadius:Record<string,string>, shadows:Record<string,string>, existingComponents:string[], stack:Stack, rawSources:string[] }} DesignProfile
 */

/**
 * Escanea un nivel de directorio buscando archivos por extensión (sin recursión profunda).
 * Versión ligera usada solo por detectCSSApproach antes de que findFiles esté disponible.
 * @param {string} dir
 * @param {string} ext
 * @returns {string[]}
 */
function shallowFind(dir, ext) {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter(e => e.endsWith(ext))
      .map(e => join(dir, e));
  } catch { return []; }
}

/** @param {string} projectRoot */
function detectCSSApproach(projectRoot) {
  const srcDir = join(projectRoot, "src");

  // Si algún componente importa *.module.css → CSS Modules
  const srcFiles = [
    ...shallowFind(srcDir, ".tsx"),
    ...shallowFind(srcDir, ".jsx"),
    ...shallowFind(join(srcDir, "components"), ".tsx"),
    ...shallowFind(join(srcDir, "components"), ".jsx"),
  ];
  for (const file of srcFiles.slice(0, 20)) {
    try {
      if (/from\s+['"][^'"]+\.module\.css['"]/.test(readFileSync(file, "utf-8"))) return "css-modules";
    } catch {}
  }

  // CSS global presente → CSS puro
  const globalCandidates = [
    join(projectRoot, "src/index.css"),
    join(projectRoot, "src/global.css"),
    join(projectRoot, "src/styles.css"),
    join(projectRoot, "src/main.css"),
    join(projectRoot, "styles/main.css"),
    join(projectRoot, "styles/global.css"),
  ];
  if (globalCandidates.some(f => existsSync(f))) return "css";

  // Cualquier .css en src/ → CSS puro
  if (shallowFind(srcDir, ".css").length > 0) return "css";

  return "css"; // default seguro: CSS puro
}

/** @param {string} projectRoot */
function detectFramework(projectRoot) {
  let pkg = null;
  try { pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8")); } catch {}
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };

  const framework =
    "react" in deps ? "react" :
    "vue" in deps ? "vue" :
    "@angular/core" in deps ? "angular" :
    "svelte" in deps ? "svelte" :
    "solid-js" in deps ? "solid" : "unknown";

  const cssApproach =
    "tailwindcss" in deps ? "tailwind" :
    "styled-components" in deps ? "styled-components" :
    "@emotion/react" in deps ? "emotion" :
    "sass" in deps || "node-sass" in deps ? "sass" :
    detectCSSApproach(projectRoot);

  return { framework, cssApproach };
}

/**
 * @param {string} raw
 * @param {string} section
 * @returns {Record<string,string>}
 */
function extractTailwindSection(raw, section) {
  /** @type {Record<string,string>} */
  const result = {};
  const sectionRe = new RegExp(`['"]?${section}['"]?\\s*:\\s*\\{([^}]+)\\}`, "s");
  const match = raw.match(sectionRe);
  if (!match) return result;
  const pairRe = /['"]?([\w-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = pairRe.exec(match[1])) !== null) result[m[1]] = m[2];
  return result;
}

/** @param {string} projectRoot */
function parseTailwindConfig(projectRoot) {
  const candidates = ["tailwind.config.js","tailwind.config.ts","tailwind.config.cjs","tailwind.config.mjs"];
  for (const filename of candidates) {
    const path = join(projectRoot, filename);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf-8");
    return {
      colors: extractTailwindSection(raw, "colors"),
      spacing: extractTailwindSection(raw, "spacing"),
      fontSizes: extractTailwindSection(raw, "fontSize"),
      breakpoints: extractTailwindSection(raw, "screens"),
      borderRadius: extractTailwindSection(raw, "borderRadius"),
      shadows: extractTailwindSection(raw, "boxShadow"),
    };
  }
  return {};
}

/**
 * @param {string} dir
 * @param {string[]} extensions
 * @param {number} maxDepth
 * @param {number} [depth]
 * @returns {string[]}
 */
function findFiles(dir, extensions, maxDepth, depth = 0) {
  if (depth > maxDepth || !existsSync(dir)) return [];
  const results = [];
  try {
    for (const entry of readdirSync(dir)) {
      if ([".", "node_modules", "dist", ".next", ".git"].some(x => entry === x || entry.startsWith("."))) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) results.push(...findFiles(full, extensions, maxDepth, depth + 1));
      else if (extensions.includes(extname(full))) results.push(full);
    }
  } catch {}
  return results;
}

/** @param {string} projectRoot */
function parseCSSVariables(projectRoot) {
  /** @type {Record<string,string>} */
  const colors = {};
  /** @type {Record<string,string>} */
  const spacing = {};
  /** @type {Record<string,string>} */
  const fontSizes = {};
  /** @type {Record<string,string>} */
  const fontWeights = {};
  /** @type {string[]} */
  const fontFamilies = [];
  const cssFiles = findFiles(projectRoot, [".css", ".scss", ".sass"], 4);
  for (const file of cssFiles.slice(0, 20)) {
    try {
      const content = readFileSync(file, "utf-8");
      const varRe = /--([\w-]+)\s*:\s*([^;]+);/g;
      let m;
      while ((m = varRe.exec(content)) !== null) {
        const name = m[1].toLowerCase(), value = m[2].trim();
        if (/(color|primary|secondary|accent|bg|text|border|surface|brand)/.test(name)) colors[`--${m[1]}`] = value;
        else if (/(spacing|gap|padding|margin|size)/.test(name)) spacing[`--${m[1]}`] = value;
        else if (/(font-size|text-size)/.test(name)) fontSizes[`--${m[1]}`] = value;
        else if (/font-weight/.test(name)) fontWeights[`--${m[1]}`] = value;
        else if (/font-family/.test(name)) fontFamilies.push(value);
      }
    } catch {}
  }
  return { colors, spacing, typography: { fontFamilies, fontSizes, fontWeights } };
}

/** @param {string} projectRoot */
function findExistingComponents(projectRoot) {
  const found = [];
  for (const dir of ["src/components","src/ui","components","ui","src/shared"]) {
    const full = join(projectRoot, dir);
    if (!existsSync(full)) continue;
    for (const f of findFiles(full, [".tsx",".jsx",".vue",".svelte"], 3))
      found.push(basename(f, extname(f)));
  }
  return [...new Set(found)].sort();
}

/**
 * @param {string} projectRoot
 * @returns {DesignProfile}
 */
function analyzeDesignSystem(projectRoot) {
  const { framework, cssApproach } = detectFramework(projectRoot);
  const tailwindData = cssApproach === "tailwind" ? parseTailwindConfig(projectRoot) : {};
  const cssData = parseCSSVariables(projectRoot);

  const tokenCandidates = ["src/tokens.ts","src/tokens.js","src/design-tokens.ts","tokens.json","src/theme.ts"];
  const hasTokenFile = tokenCandidates.some(t => existsSync(join(projectRoot, t)));

  const rawSources = [];
  if (cssApproach === "tailwind") rawSources.push("tailwind.config");
  if (Object.keys(cssData.colors).length > 0) rawSources.push("css-variables");
  if (hasTokenFile) rawSources.push("token-file");

  return {
    stack: { framework, cssApproach, hasTokenFile },
    colors: { ...(cssData.colors ?? {}), ...(tailwindData.colors ?? {}) },
    typography: {
      fontFamilies: cssData.typography?.fontFamilies ?? [],
      fontSizes: { ...(cssData.typography?.fontSizes ?? {}), ...(tailwindData.fontSizes ?? {}) },
      fontWeights: cssData.typography?.fontWeights ?? {},
    },
    spacing: { ...(cssData.spacing ?? {}), ...(tailwindData.spacing ?? {}) },
    breakpoints: tailwindData.breakpoints ?? {},
    borderRadius: tailwindData.borderRadius ?? {},
    shadows: tailwindData.shadows ?? {},
    existingComponents: findExistingComponents(projectRoot),
    rawSources,
  };
}

/**
 * @param {string} projectRoot
 * @param {DesignProfile} profile
 */
function evaluateUIConsistency(projectRoot, profile) {
  /** @type {string[]} */
  const issues = [];
  /** @type {string[]} */
  const suggestions = [];
  let score = 100;

  if (Object.keys(profile.colors).length === 0) { issues.push("No se detectaron tokens de color — los colores pueden estar hardcodeados"); score -= 20; }
  if (Object.keys(profile.spacing).length === 0) { issues.push("No se detectaron tokens de espaciado"); score -= 10; }
  if (profile.typography.fontFamilies.length === 0) { issues.push("No se detectó fuente tipográfica declarada como token"); score -= 10; }
  if (profile.existingComponents.length === 0) { issues.push("No se encontró librería de componentes en src/components o src/ui"); score -= 15; suggestions.push("Crea src/components con componentes base (Button, Input, Card)"); }
  if (!profile.stack.hasTokenFile) suggestions.push("Centraliza los tokens en src/tokens.ts para tener una única fuente de verdad");
  if (profile.stack.cssApproach === "unknown") suggestions.push("Define un enfoque de estilos claro: Tailwind, CSS Modules, o CSS Variables");

  const componentCoverage = profile.existingComponents.slice(0, 20).map(name => ({
    name,
    hasStory: existsSync(join(projectRoot, `src/components/${name}.stories.tsx`)) || existsSync(join(projectRoot, `src/components/${name}.stories.ts`)),
    hasTest: existsSync(join(projectRoot, `src/components/${name}.test.tsx`)) || existsSync(join(projectRoot, `src/__tests__/${name}.test.tsx`)),
  }));

  const withoutTests = componentCoverage.filter(c => !c.hasTest).length;
  if (withoutTests > 0) { suggestions.push(`${withoutTests} componente(s) sin tests`); score -= Math.min(15, withoutTests * 3); }

  return { score: Math.max(0, score), issues, suggestions, componentCoverage };
}

export { analyzeDesignSystem, evaluateUIConsistency };

// @ts-check
import { existsSync } from "fs";
import { join } from "path";

/**
 * @typedef {{ figmaName:string, figmaValue:string, localToken:string|null, matchType:string }} ColorMapping
 * @typedef {{ type:string, color?:{r:number,g:number,b:number}, fills?:any[], children?:any[], name:string, absoluteBoundingBox?:{width:number,height:number}, style?:any }} FigmaNode
 * @typedef {{ stack:{ framework:string, cssApproach:string, hasTokenFile:boolean }, colors:Record<string,string>, spacing:Record<string,string>, typography:{ fontFamilies:string[], fontSizes:Record<string,string>, fontWeights:Record<string,string> }, existingComponents:string[], breakpoints:Record<string,string>, shadows:Record<string,string> }} DesignProfile
 */

/** @param {string} str */
function toPascalCase(str) {
  return str.replace(/[^a-zA-Z0-9\s]/g, " ").split(/\s+/).filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("");
}

/** @param {string} str */
function toKebabCase(str) {
  return str.replace(/[^a-zA-Z0-9\s]/g, " ").split(/\s+/).filter(Boolean).join("-").toLowerCase();
}

/** @param {FigmaNode} node */
function inferProps(node) {
  /** @type {Record<string,string>} */
  const props = {};
  const name = node.name.toLowerCase();
  const hasText = (node.children ?? []).some(/** @param {any} c */ c => c.type === "TEXT");
  if (hasText || /(button|label|title|heading)/.test(name)) props["children"] = "ReactNode";
  if (/(button|btn|cta|link)/.test(name)) { props["onClick"] = "() => void"; props["disabled"] = "boolean"; }
  if ((node.children ?? []).some(/** @param {any} c */ c => /(image|img|avatar)/.test(c.name.toLowerCase()))) { props["src"] = "string"; props["alt"] = "string"; }
  if (/(card|button|badge|chip)/.test(name)) props["variant"] = '"primary" | "secondary" | "ghost"';
  return props;
}

/**
 * @param {ColorMapping|null|undefined} mapping
 * @param {string} prefix
 */
function resolveColorClass(mapping, prefix) {
  if (!mapping) return "";
  return mapping.localToken ? `${prefix}-[var(${mapping.localToken})]` : `${prefix}-[${mapping.figmaValue}]`;
}

/**
 * Construye el bloque CSS usando variables del proyecto o valores hex como fallback.
 * @param {string} selector
 * @param {FigmaNode} node
 * @param {ColorMapping[]} colorMappings
 * @returns {string}
 */
function buildCSSBlock(selector, node, colorMappings) {
  const dims = node.absoluteBoundingBox;
  const lines = [];

  if (dims) {
    lines.push(`  width: ${Math.round(dims.width)}px;`);
    lines.push(`  height: ${Math.round(dims.height)}px;`);
  }

  const bgFill = (node.fills ?? []).find(/** @param {any} f */ f => f.type === "SOLID");
  if (bgFill?.color) {
    const hex = `#${Math.round(bgFill.color.r*255).toString(16).padStart(2,"0")}${Math.round(bgFill.color.g*255).toString(16).padStart(2,"0")}${Math.round(bgFill.color.b*255).toString(16).padStart(2,"0")}`;
    const mapping = colorMappings.find(m => m.figmaValue === hex);
    lines.push(`  background-color: ${mapping?.localToken ? `var(${mapping.localToken})` : hex};`);
  }

  const textChild = (node.children ?? []).find(/** @param {any} c */ c => c.type === "TEXT" && c.style);
  if (textChild?.style) {
    const s = textChild.style;
    if (s.fontSize) lines.push(`  font-size: ${s.fontSize}px;`);
    if (s.fontWeight) lines.push(`  font-weight: ${s.fontWeight};`);
    if (s.lineHeightPx) lines.push(`  line-height: ${Math.round(s.lineHeightPx)}px;`);
  }

  if (lines.length === 0) lines.push("  /* estilos del sistema de diseño */");

  return `.${selector} {\n${lines.join("\n")}\n}`;
}

/**
 * @param {FigmaNode} node
 * @param {string} componentName
 * @param {Record<string,string>} props
 * @param {ColorMapping[]} colorMappings
 * @param {string} cssApproach
 */
function generateReact(node, componentName, props, colorMappings, cssApproach) {
  const warnings = [];
  const dims = node.absoluteBoundingBox;
  if (!dims) warnings.push("No se pudo leer el bounding box — dimensiones aproximadas.");
  if (colorMappings.some(m => m.matchType === "new")) warnings.push("Algunos colores de Figma no tienen token equivalente en el proyecto. Se usó el valor hex directo.");

  const hasChildren = "children" in props;
  const propsStr = Object.entries(props).map(([k,v]) => `${k}${v==="boolean"?"?":""}: ${v}`).join("; ");
  const propsKeys = Object.keys(props).join(", ") || "className";
  const cssClass = toKebabCase(componentName);

  /** @type {string|null} */
  let cssSnippet = null;
  let code = "";

  if (cssApproach === "tailwind") {
    const bgFill = (node.fills ?? []).find(/** @param {any} f */ f => f.type === "SOLID");
    const bgHex = bgFill?.color
      ? `#${Math.round(bgFill.color.r*255).toString(16).padStart(2,"0")}${Math.round(bgFill.color.g*255).toString(16).padStart(2,"0")}${Math.round(bgFill.color.b*255).toString(16).padStart(2,"0")}`
      : null;
    const bgMapping = bgHex ? colorMappings.find(m => m.figmaValue === bgHex) : null;
    const bgClass = bgMapping ? resolveColorClass(bgMapping, "bg") : "";
    code = `import React from "react";\n\ninterface ${componentName}Props {\n  ${propsStr || "className?: string"}\n}\n\nexport function ${componentName}({ ${propsKeys} }: ${componentName}Props) {\n  return (\n    <div className="${bgClass} rounded p-4">\n      ${hasChildren ? "{children}" : `{/* contenido de ${node.name} */}`}\n    </div>\n  );\n}\n\nexport default ${componentName};\n`;

  } else if (cssApproach === "css-modules") {
    code = `import React from "react";\nimport styles from "./${cssClass}.module.css";\n\ninterface ${componentName}Props {\n  ${propsStr || "className?: string"}\n}\n\nexport function ${componentName}({ ${propsKeys} }: ${componentName}Props) {\n  return (\n    <div className={styles.root}>\n      ${hasChildren ? "{children}" : `{/* contenido de ${node.name} */}`}\n    </div>\n  );\n}\n\nexport default ${componentName};\n`;
    cssSnippet = buildCSSBlock(".root", node, colorMappings);

  } else {
    // CSS puro — clase global, snippet CSS separado
    code = `import React from "react";\nimport "./${cssClass}.css";\n\ninterface ${componentName}Props {\n  ${propsStr || "className?: string"}\n}\n\nexport function ${componentName}({ ${propsKeys} }: ${componentName}Props) {\n  return (\n    <div className="${cssClass}">\n      ${hasChildren ? "{children}" : `{/* contenido de ${node.name} */}`}\n    </div>\n  );\n}\n\nexport default ${componentName};\n`;
    cssSnippet = buildCSSBlock(`.${cssClass}`, node, colorMappings);
  }

  return { filename: `${componentName}.tsx`, code, warnings, cssSnippet };
}

/**
 * @param {FigmaNode} node
 * @param {string} componentName
 * @param {Record<string,string>} props
 */
function generateVue(node, componentName, props) {
  const propsBlock = Object.entries(props).map(([k,v]) => `${k}?: ${v}`).join("\n  ");
  const hasChildren = "children" in props;
  const code = `<template>\n  <div class="root">\n    ${hasChildren ? "<slot />" : `<!-- contenido de ${node.name} -->`}\n  </div>\n</template>\n\n<script setup lang="ts">\ninterface Props {\n  ${propsBlock}\n}\ndefineProps<Props>();\n</script>\n\n<style scoped>\n.root {\n  /* estilos del sistema de diseño */\n}\n</style>\n`;
  return { filename: `${componentName}.vue`, code, warnings: /** @type {string[]} */ ([]), cssSnippet: /** @type {string|null} */ (null) };
}

/**
 * @param {FigmaNode} node
 * @param {DesignProfile} profile
 * @param {ColorMapping[]} colorMappings
 */
function generateComponent(node, profile, colorMappings) {
  const componentName = toPascalCase(node.name) || "FigmaComponent";
  const props = inferProps(node);
  return profile.stack.framework === "vue"
    ? generateVue(node, componentName, props)
    : generateReact(node, componentName, props, colorMappings, profile.stack.cssApproach);
}

/** @param {DesignProfile} profile */
function suggestImprovements(profile) {
  const improvements = [];
  if (Object.keys(profile.colors).length === 0) improvements.push({ priority: "alta", area: "Tokens de color", description: "No se detectaron tokens de color", action: "Define colores como CSS variables o en tailwind.config.js" });
  if (!profile.stack.hasTokenFile) improvements.push({ priority: "alta", area: "Token file", description: "No existe archivo único de tokens", action: "Crea src/tokens.ts con exports de colores, tipografía y espaciado" });
  if (profile.existingComponents.length === 0) improvements.push({ priority: "alta", area: "Componentes base", description: "No se encontró librería de componentes", action: "Crea src/components con Button, Input, Card" });
  if (Object.keys(profile.spacing).length === 0) improvements.push({ priority: "media", area: "Espaciado", description: "No se detectaron tokens de espaciado", action: "Define escala de espaciado (4, 8, 16, 24, 32px)" });
  if (Object.keys(profile.breakpoints).length === 0) improvements.push({ priority: "media", area: "Breakpoints", description: "No se detectaron breakpoints como tokens", action: "Define breakpoints en tailwind.config.js o custom media queries" });
  if (profile.typography.fontFamilies.length === 0) improvements.push({ priority: "media", area: "Tipografía", description: "No se detectó fuente declarada como token", action: "Define --font-sans o fontFamily en tailwind.config.js" });
  if (Object.keys(profile.shadows).length === 0) improvements.push({ priority: "baja", area: "Sombras", description: "No se detectaron tokens de sombra", action: "Define sombras estándar (sm, md, lg)" });
  return improvements;
}

export { generateComponent, suggestImprovements };

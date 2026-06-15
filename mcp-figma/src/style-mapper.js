// @ts-check
import { extractColorFromFill } from "./figma-client.js";

/**
 * @typedef {{ figmaName: string, figmaValue: string, localToken: string|null, localValue: string, matchType: "exact"|"approximate"|"new", confidence: number }} ColorMapping
 * @typedef {{ type: string, color?: { r:number, g:number, b:number, a?:number } }} Fill
 * @typedef {{ name: string, fills: Fill[] }} FillItem
 * @typedef {{ name: string, style: { fontSize?: number } }} TextItem
 * @typedef {{ colors: Record<string,string>, typography: { fontSizes: Record<string,string> } }} DesignProfile
 */

/** @param {string} hex */
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  return [parseInt(clean.slice(0,2),16), parseInt(clean.slice(2,4),16), parseInt(clean.slice(4,6),16)];
}

/** @param {string} a @param {string} b */
function colorDistance(a, b) {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  if (!ra || !rb) return Infinity;
  return Math.sqrt((ra[0]-rb[0])**2 + (ra[1]-rb[1])**2 + (ra[2]-rb[2])**2);
}

/**
 * @param {FillItem[]} fillItems
 * @param {DesignProfile} profile
 * @returns {ColorMapping[]}
 */
function mapColors(fillItems, profile) {
  const localEntries = Object.entries(profile.colors);
  return fillItems.map(({ name, fills }) => {
    const figmaHex = fills.map(extractColorFromFill).find(Boolean) ?? null;
    if (!figmaHex) return { figmaName: name, figmaValue: "desconocido", localToken: null, localValue: "desconocido", matchType: "new", confidence: 0 };

    const exact = localEntries.find(([,v]) => v.toLowerCase() === figmaHex.toLowerCase());
    if (exact) return { figmaName: name, figmaValue: figmaHex, localToken: exact[0], localValue: exact[1], matchType: "exact", confidence: 1 };

    let best = null, bestDist = Infinity;
    for (const [token, value] of localEntries) {
      const dist = colorDistance(figmaHex, value);
      if (dist < bestDist) { bestDist = dist; best = [token, value]; }
    }
    if (best && bestDist < 30) return { figmaName: name, figmaValue: figmaHex, localToken: best[0], localValue: best[1], matchType: "approximate", confidence: Math.max(0, 1 - bestDist/30) };

    return { figmaName: name, figmaValue: figmaHex, localToken: null, localValue: figmaHex, matchType: "new", confidence: 0 };
  });
}

/**
 * @param {TextItem[]} textItems
 * @param {DesignProfile} profile
 * @returns {ColorMapping[]}
 */
function mapTypography(textItems, profile) {
  return textItems.map(({ name, style }) => {
    const figmaSize = style.fontSize ? `${style.fontSize}px` : null;
    if (!figmaSize) return { figmaName: name, figmaValue: "desconocido", localToken: null, localValue: "desconocido", matchType: "new", confidence: 0 };
    const match = Object.entries(profile.typography.fontSizes).find(([,v]) => v === figmaSize);
    if (match) return { figmaName: name, figmaValue: figmaSize, localToken: match[0], localValue: match[1], matchType: "exact", confidence: 1 };
    return { figmaName: name, figmaValue: figmaSize, localToken: null, localValue: figmaSize, matchType: "new", confidence: 0 };
  });
}

/**
 * @param {ColorMapping[]} colorMappings
 * @param {ColorMapping[]} typographyMappings
 */
function buildMappingReport(colorMappings, typographyMappings) {
  const all = [...colorMappings, ...typographyMappings];
  const unmapped = [
    ...colorMappings.filter(m => m.matchType === "new").map(m => `color: ${m.figmaName} (${m.figmaValue})`),
    ...typographyMappings.filter(m => m.matchType === "new").map(m => `tipografía: ${m.figmaName} (${m.figmaValue})`),
  ];
  const total = all.length;
  let recommendation = "";
  if (total === 0) recommendation = "No hay estilos en Figma para mapear.";
  else if (unmapped.length === 0) recommendation = "✅ Todos los estilos de Figma coinciden con tokens existentes.";
  else if (unmapped.length <= 3) recommendation = `⚠️ ${unmapped.length} estilo(s) nuevo(s) sin equivalente en el proyecto.`;
  else recommendation = `❌ ${unmapped.length} estilos sin equivalente — considera sincronizar el design system con Figma.`;
  return { colors: colorMappings, typography: typographyMappings, unmapped, recommendation };
}

export { mapColors, mapTypography, buildMappingReport };

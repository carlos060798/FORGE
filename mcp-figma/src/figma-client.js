// @ts-check
const FIGMA_API = "https://api.figma.com/v1";

/**
 * @typedef {{ type: string, color?: { r:number, g:number, b:number, a?:number } }} Fill
 * @typedef {{ id:string, name:string, type:string, fills?:Fill[], style?:object, children?:FigmaNode[], absoluteBoundingBox?:{width:number,height:number} }} FigmaNode
 */

function pat() {
  const token = process.env.FIGMA_PAT;
  if (!token) throw new Error("FIGMA_PAT no está definido en las variables de entorno");
  return token;
}

function headers() {
  return { "X-Figma-Token": pat(), "Content-Type": "application/json" };
}

/** @param {string} path */
async function get(path) {
  const res = await fetch(`${FIGMA_API}${path}`, { headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API ${res.status}: ${body}`);
  }
  return res.json();
}

/** @param {string} fileKey */
async function getFileMeta(fileKey) {
  const data = await get(`/files/${fileKey}?depth=1`);
  return {
    name: data.name,
    lastModified: data.lastModified,
    version: data.version,
    componentCount: Object.keys(data.components ?? {}).length,
    styleCount: Object.keys(data.styles ?? {}).length,
  };
}

/** @param {string} fileKey */
async function getFileComponents(fileKey) {
  const data = await get(`/components/file/${fileKey}`);
  return data.meta?.components ?? [];
}

/**
 * @param {string} fileKey
 * @param {string} nodeId
 */
async function getNodeById(fileKey, nodeId) {
  return get(`/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`);
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} [a]
 */
function rgbaToHex(r, g, b, a = 1) {
  const toHex = (/** @type {number} */ n) => Math.round(n * 255).toString(16).padStart(2, "0");
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return a < 1 ? `${hex}${toHex(a)}` : hex;
}

/** @param {Fill} fill */
function extractColorFromFill(fill) {
  if (fill.type === "SOLID" && fill.color) {
    return rgbaToHex(fill.color.r, fill.color.g, fill.color.b, fill.color.a ?? 1);
  }
  return null;
}

export { getFileMeta, getFileComponents, getNodeById, rgbaToHex, extractColorFromFill };

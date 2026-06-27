/**
 * spec.js — Spec tipada + validateSpec() + verificador de cobertura req→code
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * @param {object} spec
 * @param {object} [ir]
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateSpec(spec, ir) {
  const errors = [];
  const warnings = [];

  if (!spec.irId) errors.push('spec.irId está vacío — la spec debe referenciar un IR');
  if (!spec.projectName) errors.push('spec.projectName está vacío');
  if (!spec.requirements || spec.requirements.length === 0) {
    errors.push('spec.requirements está vacío — la spec no tiene requisitos');
  }

  const ids = spec.requirements.map(r => r.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) errors.push(`IDs de requisito duplicados: ${duplicates.join(', ')}`);

  const badIds = spec.requirements.filter(r => !/^REQ-\d{3,}$/.test(r.id));
  if (badIds.length > 0) warnings.push(`IDs con formato no estándar (esperado REQ-NNN): ${badIds.map(r => r.id).join(', ')}`);

  if (ir) {
    if (spec.irId !== ir.id) errors.push(`spec.irId (${spec.irId}) no coincide con ir.id (${ir.id})`);
    const functionalReqs = spec.requirements.filter(r => r.type === 'functional');
    if (ir.features.core.length > 0 && functionalReqs.length === 0) {
      warnings.push(`El IR tiene ${ir.features.core.length} features core pero la spec no tiene requisitos funcionales`);
    }
  }

  const mustReqs = spec.requirements.filter(r => r.priority === 'must');
  if (mustReqs.length === 0) warnings.push('La spec no tiene requisitos "must" — todos son opcionales');

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * @param {object} spec
 * @param {string} srcDir
 * @returns {{ covered: object[], uncovered: object[], coveragePercent: number, filesScanned: number }}
 */
export function checkCoverage(spec, srcDir) {
  const covered = [];
  const uncovered = [];
  const codeFiles = _collectCodeFiles(srcDir);
  const filesScanned = codeFiles.length;

  const allContent = codeFiles.map(f => {
    try { return _stripComments(fs.readFileSync(f, 'utf8')); } catch { return ''; }
  }).join('\n');

  for (const req of spec.requirements) {
    if (allContent.includes(req.id)) {
      const mentioningFiles = codeFiles.filter(f => {
        try { return _stripComments(fs.readFileSync(f, 'utf8')).includes(req.id); } catch { return false; }
      });
      covered.push({ ...req, coveredBy: mentioningFiles.map(f => path.relative(srcDir, f)) });
    } else {
      uncovered.push(req);
    }
  }

  const total = spec.requirements.length;
  const coveragePercent = total === 0 ? 100 : Math.round((covered.length / total) * 100);
  return { covered, uncovered, coveragePercent, filesScanned };
}

/**
 * @param {string} specMdPath
 * @param {string} irId
 * @returns {object}
 */
export function parseSpecMd(specMdPath, irId) {
  const content = fs.readFileSync(specMdPath, 'utf8');
  const requirements = [];
  const endpoints = [];

  const bulletPattern = /[-*]\s+\*\*?(REQ-\d+)\*\*?\s*(?:\[(must|should|could)\])?:?\s+(.+)/gi;
  for (const match of content.matchAll(bulletPattern)) {
    const id = match[1].toUpperCase();
    if (requirements.find(r => r.id === id)) continue;
    requirements.push({ id, type: _inferType(match[3]), text: match[3].trim(), priority: (match[2]?.toLowerCase()) ?? 'should' });
  }

  const tablePattern = /\|\s*(REQ-\d+)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*([^|]+)\|/gi;
  for (const match of content.matchAll(tablePattern)) {
    const id = match[1].toUpperCase();
    if (requirements.find(r => r.id === id)) continue;
    requirements.push({ id, type: _normalizeType(match[2]), text: match[4].trim(), priority: _normalizePriority(match[3]) });
  }

  const endpointPattern = /\b(GET|POST|PUT|PATCH|DELETE|HEAD)\s+(\/[\w/:{}-]*)\s*[-—]\s*(.+)/g;
  for (const match of content.matchAll(endpointPattern)) {
    endpoints.push({ method: match[1], path: match[2], description: match[3].trim() });
  }

  const h1Match = content.match(/^#\s+(.+)/m);
  const projectName = h1Match ? h1Match[1].trim() : path.basename(path.dirname(specMdPath));

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    irId,
    projectName,
    requirements,
    endpoints: endpoints.length > 0 ? endpoints : undefined,
    sourcePath: specMdPath,
  };
}

function _stripComments(content) {
  return content
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/#[^\n]*/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

function _collectCodeFiles(dir, exts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java']) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  function walk(current, depth = 0) {
    if (depth > 8) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'target'].includes(entry.name)) continue;
        walk(full, depth + 1);
      } else if (entry.isFile() && exts.some(ext => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

function _inferType(text) {
  const lower = text.toLowerCase();
  if (lower.includes('rendimiento') || lower.includes('performance') || lower.includes('latencia') || lower.includes('escalab') || lower.includes('seguridad') || lower.includes('security')) return 'non-functional';
  if (lower.includes('restricción') || lower.includes('constraint') || lower.includes('cumplimiento') || lower.includes('compliance')) return 'constraint';
  return 'functional';
}

function _normalizeType(raw) {
  const v = raw.toLowerCase();
  if (v.includes('non') || v.includes('nf') || v.includes('performance')) return 'non-functional';
  if (v.includes('constraint') || v.includes('restriccion')) return 'constraint';
  return 'functional';
}

function _normalizePriority(raw) {
  const v = raw.toLowerCase();
  if (v === 'must' || v === 'obligatorio') return 'must';
  if (v === 'could' || v === 'opcional') return 'could';
  return 'should';
}

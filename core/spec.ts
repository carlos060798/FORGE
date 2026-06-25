/**
 * spec.ts — Spec tipada + validateSpec() + verificador de cobertura req→code
 *
 * Cierra el gap de trazabilidad vs. Spec Kit:
 * - SpecDocument: representación JSON tipada de spec.md
 * - validateSpec(): verifica que la spec esté completa y coherente con el IR
 * - checkCoverage(): detecta requisitos sin cobertura en el código generado
 *
 * La spec sigue siendo un .md legible por humanos; este módulo la parsea
 * y la valida como objeto estructurado.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IR } from './ir.types.js';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface SpecRequirement {
  id: string;           // e.g. "REQ-001"
  type: 'functional' | 'non-functional' | 'constraint';
  text: string;
  priority: 'must' | 'should' | 'could';
  /** Archivos de código que implementan este requisito (llenado por checkCoverage) */
  coveredBy?: string[];
}

export interface SpecEndpoint {
  method: string;
  path: string;
  description: string;
  reqId?: string;       // requisito que origina este endpoint
}

export interface SpecDocument {
  version: string;
  generatedAt: string;
  irId: string;         // ID del IR del que deriva
  projectName: string;
  requirements: SpecRequirement[];
  endpoints?: SpecEndpoint[];
  /** Ruta al spec.md original */
  sourcePath: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CoverageResult {
  covered: SpecRequirement[];
  uncovered: SpecRequirement[];
  coveragePercent: number;
  /** Archivos analizados para calcular cobertura */
  filesScanned: number;
}

// ── Validador de spec ─────────────────────────────────────────────────────────

export function validateSpec(spec: SpecDocument, ir?: IR): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validaciones estructurales básicas
  if (!spec.irId) errors.push('spec.irId está vacío — la spec debe referenciar un IR');
  if (!spec.projectName) errors.push('spec.projectName está vacío');
  if (!spec.requirements || spec.requirements.length === 0) {
    errors.push('spec.requirements está vacío — la spec no tiene requisitos');
  }

  // Validar IDs únicos
  const ids = spec.requirements.map(r => r.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) {
    errors.push(`IDs de requisito duplicados: ${duplicates.join(', ')}`);
  }

  // Validar formato de IDs (REQ-NNN)
  const badIds = spec.requirements.filter(r => !/^REQ-\d{3,}$/.test(r.id));
  if (badIds.length > 0) {
    warnings.push(`IDs con formato no estándar (esperado REQ-NNN): ${badIds.map(r => r.id).join(', ')}`);
  }

  // Coherencia con el IR (si se provee)
  if (ir) {
    if (spec.irId !== ir.id) {
      errors.push(`spec.irId (${spec.irId}) no coincide con ir.id (${ir.id})`);
    }

    // Verificar que las features core del IR tengan al menos un requisito funcional
    const functionalReqs = spec.requirements.filter(r => r.type === 'functional');
    if (ir.features.core.length > 0 && functionalReqs.length === 0) {
      warnings.push(`El IR tiene ${ir.features.core.length} features core pero la spec no tiene requisitos funcionales`);
    }
  }

  // Debe tener al menos un requisito "must"
  const mustReqs = spec.requirements.filter(r => r.priority === 'must');
  if (mustReqs.length === 0) {
    warnings.push('La spec no tiene requisitos "must" — todos son opcionales');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Verificador de cobertura req→code ─────────────────────────────────────────

/**
 * Analiza el directorio src/ para detectar qué requisitos tienen
 * evidencia de implementación en el código generado.
 *
 * Estrategia: busca el ID del requisito (e.g. "REQ-001") en comentarios
 * o en el nombre de archivos/funciones. Simple pero efectivo para el MVP.
 */
export function checkCoverage(spec: SpecDocument, srcDir: string): CoverageResult {
  const covered: SpecRequirement[] = [];
  const uncovered: SpecRequirement[] = [];
  let filesScanned = 0;

  // Recopilar todos los archivos de código fuente
  const codeFiles = collectCodeFiles(srcDir);
  filesScanned = codeFiles.length;

  // Leer contenido de todos los archivos (en memoria)
  const allContent = codeFiles.map(f => {
    try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
  }).join('\n');

  for (const req of spec.requirements) {
    // Buscar el ID del requisito en el código
    const found = allContent.includes(req.id);

    if (found) {
      // Encontrar qué archivos lo mencionan
      const mentioningFiles = codeFiles.filter(f => {
        try { return fs.readFileSync(f, 'utf8').includes(req.id); } catch { return false; }
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

function collectCodeFiles(dir: string, exts: string[] = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java']): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];

  function walk(current: string, depth: number = 0): void {
    if (depth > 8) return; // evitar loops en symlinks
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        // Ignorar directorios generados o de dependencias
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

// ── Parser de spec.md → SpecDocument ─────────────────────────────────────────

/**
 * Parsea un spec.md generado por FORGE y extrae los requisitos.
 * Busca líneas que contengan "REQ-NNN" seguidas de texto descriptivo.
 *
 * Formato esperado en spec.md:
 *   - **REQ-001** [must/should/could]: Descripción del requisito
 *   o:
 *   | REQ-001 | functional | must | Descripción |
 */
export function parseSpecMd(specMdPath: string, irId: string): SpecDocument {
  const content = fs.readFileSync(specMdPath, 'utf8');
  const requirements: SpecRequirement[] = [];
  const endpoints: SpecEndpoint[] = [];

  // Patrón 1: - **REQ-NNN** [must]: texto
  const bulletPattern = /[-*]\s+\*\*?(REQ-\d+)\*\*?\s*(?:\[(must|should|could)\])?:?\s+(.+)/gi;
  for (const match of content.matchAll(bulletPattern)) {
    const id = match[1].toUpperCase();
    if (requirements.find(r => r.id === id)) continue; // evitar duplicados
    requirements.push({
      id,
      type: inferType(match[3]),
      text: match[3].trim(),
      priority: (match[2]?.toLowerCase() as 'must' | 'should' | 'could') ?? 'should',
    });
  }

  // Patrón 2: tabla markdown | REQ-NNN | type | priority | text |
  const tablePattern = /\|\s*(REQ-\d+)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*([^|]+)\|/gi;
  for (const match of content.matchAll(tablePattern)) {
    const id = match[1].toUpperCase();
    if (requirements.find(r => r.id === id)) continue;
    requirements.push({
      id,
      type: normalizeType(match[2]),
      text: match[4].trim(),
      priority: normalizePriority(match[3]),
    });
  }

  // Patrón endpoints: GET /path — description
  const endpointPattern = /\b(GET|POST|PUT|PATCH|DELETE|HEAD)\s+(\/[\w/:{}-]*)\s*[-—]\s*(.+)/g;
  for (const match of content.matchAll(endpointPattern)) {
    endpoints.push({
      method: match[1],
      path: match[2],
      description: match[3].trim(),
    });
  }

  // Extraer nombre del proyecto del H1
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

function inferType(text: string): SpecRequirement['type'] {
  const lower = text.toLowerCase();
  if (lower.includes('rendimiento') || lower.includes('performance') ||
      lower.includes('latencia') || lower.includes('escalab') ||
      lower.includes('seguridad') || lower.includes('security')) {
    return 'non-functional';
  }
  if (lower.includes('restricción') || lower.includes('constraint') ||
      lower.includes('cumplimiento') || lower.includes('compliance')) {
    return 'constraint';
  }
  return 'functional';
}

function normalizeType(raw: string): SpecRequirement['type'] {
  const v = raw.toLowerCase();
  if (v.includes('non') || v.includes('nf') || v.includes('performance')) return 'non-functional';
  if (v.includes('constraint') || v.includes('restriccion')) return 'constraint';
  return 'functional';
}

function normalizePriority(raw: string): SpecRequirement['priority'] {
  const v = raw.toLowerCase();
  if (v === 'must' || v === 'obligatorio') return 'must';
  if (v === 'could' || v === 'opcional') return 'could';
  return 'should';
}

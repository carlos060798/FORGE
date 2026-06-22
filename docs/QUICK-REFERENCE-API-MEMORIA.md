# Quick Reference: API de Memoria

**Referencia rápida** para consultar memoria sin abrir documentación completa.

---

## 1️⃣ Leer memoria (30 segundos)

### SQLite
```javascript
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('.sdd/memoria/memoria.db');
const rows = db.prepare('SELECT * FROM entradas WHERE agente = ?').all('arquitecto');
```

### Markdown
```javascript
const fs = require('fs');
const contenido = fs.readFileSync('.sdd/memoria/agente-arquitecto.md', 'utf8');
// Buscar líneas con "##" para encontrar entradas
```

---

## 2️⃣ Detectar backend

```javascript
// Auto-detect
const nodeSoportaSQLite = () => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  return major > 22 || (major === 22 && minor >= 5);
};

const backend = nodeSoportaSQLite() ? 'sqlite' : 'markdown';
```

---

## 3️⃣ Tabla SQLite (esquema)

```sql
CREATE TABLE entradas (
  id       INTEGER PRIMARY KEY,
  ts       TEXT,           -- ISO timestamp
  fecha    TEXT,           -- YYYY-MM-DD
  agente   TEXT,           -- nombre agente
  archivo  TEXT,           -- ruta
  resumen  TEXT,           -- contenido
  bytes    INTEGER DEFAULT 0
);

-- Índices
CREATE INDEX idx_agente  ON entradas(agente);
CREATE INDEX idx_fecha   ON entradas(fecha);
CREATE INDEX idx_archivo ON entradas(archivo);
```

---

## 4️⃣ Consumo (observabilidad)

```javascript
// Leer .sdd/observabilidad/consumo.jsonl
const lineas = fs.readFileSync('.sdd/observabilidad/consumo.jsonl', 'utf8').trim().split('\n');
const eventos = lineas.map(l => JSON.parse(l));
// Campos: ts, agente, tool, archivo, bytes, provider, effort_level
```

---

## 5️⃣ Índice invertido (rápido)

```javascript
// .sdd/memoria/indice.jsonl — búsqueda sin cargar BD completa
const indice = lineas
  .map(l => JSON.parse(l))
  .filter(e => e.agente === 'arquitecto')
  .filter(e => e.fecha === '2026-06-21');
```

---

## 6️⃣ Configurar backend

En `.sdd/sdd.config.yaml`:
```yaml
memoria:
  backend: "sqlite"  # o "markdown"
```

---

## 7️⃣ Auto-compresión

```javascript
// Detectar si necesita compresión
const { statSync } = require('fs');
const { size } = statSync('.sdd/memoria/agente-arquitecto.md');
if (size > 40000) console.log('Ejecuta: /sdd.optimizar memoria');
```

---

**Ver `EJEMPLOS-MEMORIA-API.md` para ejemplos completos con error handling.**

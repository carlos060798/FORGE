/**
 * Servidor falso de la API REST de GitHub, para las pruebas del adaptador (F2.1).
 *
 * Escucha en 127.0.0.1 con node:http: ninguna prueba toca la red. Las respuestas siguen la forma
 * de tests/.../spikes/contratos-respuesta.md §1 (ejemplos construidos a mano, NO capturas reales).
 *
 * Qué simula: incidencias (con `pull_request` opcional), comentarios paginados, ramas, la API Git
 * Data (blobs, árbol, commit, referencia), solicitudes de cambio, y permisos/fallos inyectables.
 * Qué NO simula: reglas de protección de rama, borradores no permitidos por el plan, límites
 * secundarios reales (se inyectan con `fallos`), ni la semántica exacta de los 404 de GitHub.
 */

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

const sha = (texto) => createHash('sha1').update(String(texto)).digest('hex');

/**
 * @typedef {Object} Fallo
 * @property {string} [metodo]
 * @property {RegExp} patron                 sobre «MÉTODO ruta»
 * @property {number} estado
 * @property {string} [cuerpo]               texto tal cual (no tiene por qué ser JSON)
 * @property {Record<string, string>} [cabeceras]
 * @property {number} [veces]                cuántas veces aplica (por defecto, siempre)
 */

/**
 * @param {Object} o
 * @param {string} o.token                   el único token que se acepta
 * @param {Record<string, any>} [o.repos]    `owner/repo` → { ramas, incidencias, comentarios, archivado }
 * @param {Fallo[]} [o.fallos]
 * @param {number|false} [o.escrituraDenegada]  estado con el que se rechaza TODO POST (403 o 404)
 */
export async function crearServidorGitHub({ token, repos = {}, fallos = [], escrituraDenegada = false }) {
  const estado = {
    repos: new Map(),
    /** @type {Array<{ metodo: string, url: string, ruta: string, cabeceras: Record<string, any>, cuerpo: any, textoCuerpo: string }>} */
    peticiones: [],
    fallos: fallos.map((f) => ({ ...f })),
    escrituraDenegada,
    siguienteId: 5000,
  };
  for (const [nombre, r] of Object.entries(repos)) {
    estado.repos.set(nombre.toLowerCase(), {
      archivado: r.archivado === true,
      ramas: new Map(Object.entries(r.ramas ?? { main: sha(`base:${nombre}`) })),
      commits: new Map(),
      arboles: new Map(),
      blobs: new Map(),
      incidencias: new Map(Object.entries(r.incidencias ?? {}).map(([n, v]) => [Number(n), v])),
      comentarios: new Map(Object.entries(r.comentarios ?? {}).map(([n, v]) => [Number(n), v.map((c) => ({ id: ++estado.siguienteId, ...c }))])),
      solicitudes: [],
    });
  }

  const json = (res, codigo, cuerpo, cabeceras = {}) => {
    res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8', ...cabeceras });
    res.end(JSON.stringify(cuerpo));
  };

  const servidor = createServer((req, res) => {
    const trozos = [];
    req.on('data', (c) => trozos.push(c));
    req.on('end', () => {
      const u = new URL(req.url ?? '/', 'http://127.0.0.1');
      const textoCuerpo = Buffer.concat(trozos).toString('utf8');
      let cuerpo;
      try { cuerpo = textoCuerpo ? JSON.parse(textoCuerpo) : undefined; } catch { cuerpo = undefined; }
      const metodo = req.method ?? 'GET';
      estado.peticiones.push({ metodo, url: req.url ?? '', ruta: u.pathname, cabeceras: { ...req.headers }, cuerpo, textoCuerpo });
      try {
        responder(req, res, metodo, u, cuerpo);
      } catch (e) {
        json(res, 500, { message: `error del servidor falso: ${e?.message}` });
      }
    });
  });

  function responder(req, res, metodo, u, cuerpo) {
    // 1. Autenticación y cabeceras que GitHub exige
    if (req.headers.authorization !== `Bearer ${token}`) return json(res, 401, { message: 'Bad credentials' });
    if (!req.headers['user-agent']) return json(res, 403, { message: 'Request forbidden by administrative rules. Please make sure your request has a User-Agent header.' });

    // 2. Fallos inyectados
    const clave = `${metodo} ${u.pathname}`;
    for (const f of estado.fallos) {
      if (f.metodo && f.metodo !== metodo) continue;
      if (!f.patron.test(clave)) continue;
      if (f.veces !== undefined) {
        if (f.veces <= 0) continue;
        f.veces--;
      }
      res.writeHead(f.estado, { 'content-type': 'application/json; charset=utf-8', ...(f.cabeceras ?? {}) });
      res.end(f.cuerpo ?? JSON.stringify({ message: 'fallo inyectado' }));
      return;
    }

    // 3. Escritura denegada (token sin permiso de escritura)
    if (metodo !== 'GET' && estado.escrituraDenegada) {
      return json(res, estado.escrituraDenegada, { message: 'Resource not accessible by personal access token' });
    }

    const partes = u.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
    if (partes[0] !== 'repos' || partes.length < 3) return json(res, 404, { message: 'Not Found' });
    const nombre = `${partes[1]}/${partes[2]}`;
    const repo = estado.repos.get(nombre.toLowerCase());
    if (!repo) return json(res, 404, { message: 'Not Found' });
    const resto = partes.slice(3);

    // GET /repos/o/r
    if (resto.length === 0 && metodo === 'GET') return json(res, 200, { full_name: nombre, archived: repo.archivado, default_branch: 'main' });

    // Incidencias y comentarios
    if (resto[0] === 'issues' && /^\d+$/.test(resto[1] ?? '')) {
      const n = Number(resto[1]);
      const incidencia = repo.incidencias.get(n);
      if (!incidencia) return json(res, 404, { message: 'Not Found' });
      if (resto.length === 2 && metodo === 'GET') {
        const lista = repo.comentarios.get(n) ?? [];
        return json(res, 200, {
          id: 1000000000 + n, number: n, state: 'open', title: '', body: null, user: { login: 'autor' }, labels: [],
          ...incidencia, comments: incidencia.comments ?? lista.length,
        });
      }
      if (resto[2] === 'comments' && resto.length === 3) {
        if (metodo === 'GET') {
          const porPagina = Math.min(100, Math.max(1, Number(u.searchParams.get('per_page') ?? 30)));
          const pagina = Math.max(1, Number(u.searchParams.get('page') ?? 1));
          const lista = repo.comentarios.get(n) ?? [];
          const trozo = lista.slice((pagina - 1) * porPagina, pagina * porPagina);
          const hayMas = lista.length > pagina * porPagina;
          // La cabecera Link existe, pero el adaptador no debe seguirla: apunta a un host ajeno a propósito
          const cab = hayMas ? { link: `<https://trampa.example/repos/${nombre}/issues/${n}/comments?page=${pagina + 1}>; rel="next"` } : {};
          return json(res, 200, trozo.map((c) => ({ ...c, user: c.user === undefined ? { login: 'otro' } : c.user })), cab);
        }
        if (metodo === 'POST') {
          if (!cuerpo || typeof cuerpo.body !== 'string') return json(res, 422, { message: 'Validation Failed' });
          const c = { id: ++estado.siguienteId, body: cuerpo.body, user: { login: 'forge-bot' } };
          if (!repo.comentarios.has(n)) repo.comentarios.set(n, []);
          repo.comentarios.get(n).push(c);
          return json(res, 201, { ...c, html_url: `https://github.com/${nombre}/issues/${n}#issuecomment-${c.id}`, created_at: '2026-10-11T12:00:00Z' });
        }
      }
    }

    // Git Data
    if (resto[0] === 'git') {
      if (resto[1] === 'ref' && resto[2] === 'heads' && metodo === 'GET') {
        const rama = resto.slice(3).join('/');
        const s = repo.ramas.get(rama);
        if (!s) return json(res, 404, { message: 'Not Found' });
        return json(res, 200, { ref: `refs/heads/${rama}`, node_id: 'REF_x', object: { type: 'commit', sha: s } });
      }
      if (resto[1] === 'commits' && resto.length === 3 && metodo === 'GET') {
        const c = repo.commits.get(resto[2]);
        if (c) return json(res, 200, { sha: resto[2], tree: { sha: c.tree } });
        // Los commits base son sintéticos: cualquier SHA que sea punta de rama tiene un árbol derivado
        if ([...repo.ramas.values()].includes(resto[2])) return json(res, 200, { sha: resto[2], tree: { sha: sha(`arbol:${resto[2]}`) } });
        return json(res, 404, { message: 'Not Found' });
      }
      if (resto[1] === 'blobs' && metodo === 'POST') {
        if (!cuerpo || typeof cuerpo.content !== 'string') return json(res, 422, { message: 'Validation Failed' });
        const s = sha(`blob:${cuerpo.content}`);
        repo.blobs.set(s, cuerpo.content);
        return json(res, 201, { sha: s });
      }
      if (resto[1] === 'trees' && metodo === 'POST') {
        if (!cuerpo || !Array.isArray(cuerpo.tree) || typeof cuerpo.base_tree !== 'string') return json(res, 422, { message: 'Validation Failed' });
        for (const e of cuerpo.tree) if (!repo.blobs.has(e.sha)) return json(res, 422, { message: 'tree.sha references a missing blob' });
        const s = sha(`tree:${JSON.stringify(cuerpo)}`);
        repo.arboles.set(s, cuerpo.tree);
        return json(res, 201, { sha: s });
      }
      if (resto[1] === 'commits' && metodo === 'POST') {
        if (!cuerpo || !repo.arboles.has(cuerpo.tree) || !Array.isArray(cuerpo.parents)) return json(res, 422, { message: 'Validation Failed' });
        const s = sha(`commit:${JSON.stringify(cuerpo)}`);
        repo.commits.set(s, { tree: cuerpo.tree, parents: cuerpo.parents, message: cuerpo.message });
        return json(res, 201, { sha: s });
      }
      if (resto[1] === 'refs' && resto.length === 2 && metodo === 'POST') {
        const ref = cuerpo?.ref;
        if (typeof ref !== 'string' || !ref.startsWith('refs/heads/') || !repo.commits.has(cuerpo.sha)) return json(res, 422, { message: 'Validation Failed' });
        const rama = ref.slice('refs/heads/'.length);
        if (repo.ramas.has(rama)) return json(res, 422, { message: 'Reference already exists' });
        repo.ramas.set(rama, cuerpo.sha);
        return json(res, 201, { ref, object: { type: 'commit', sha: cuerpo.sha } });
      }
    }

    // Solicitudes de cambio
    if (resto[0] === 'pulls' && resto.length === 1 && metodo === 'POST') {
      if (!cuerpo || typeof cuerpo.title !== 'string' || !repo.ramas.has(cuerpo.head) || !repo.ramas.has(cuerpo.base)) {
        return json(res, 422, { message: 'Validation Failed' });
      }
      const numero = 100 + repo.solicitudes.length;
      const pr = { id: ++estado.siguienteId, number: numero, state: 'open', title: cuerpo.title, draft: cuerpo.draft === true, head: { ref: cuerpo.head }, base: { ref: cuerpo.base }, merged: false, body: cuerpo.body };
      repo.solicitudes.push(pr);
      return json(res, 201, { ...pr, html_url: `https://github.com/${nombre}/pull/${numero}` });
    }

    return json(res, 404, { message: 'Not Found' });
  }

  await new Promise((r) => servidor.listen(0, '127.0.0.1', () => r(undefined)));
  const puerto = /** @type {any} */ (servidor.address()).port;
  return {
    host: `127.0.0.1:${puerto}`,
    baseUrl: `http://127.0.0.1:${puerto}`,
    estado,
    peticiones: estado.peticiones,
    /** Peticiones que no son lecturas. */
    escrituras: () => estado.peticiones.filter((p) => p.metodo !== 'GET'),
    repo: (nombre) => estado.repos.get(nombre.toLowerCase()),
    reiniciar: () => { estado.peticiones.length = 0; },
    async cerrar() {
      servidor.closeAllConnections();
      await new Promise((r) => servidor.close(() => r(undefined)));
    },
  };
}

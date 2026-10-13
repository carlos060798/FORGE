// @ts-check
/**
 * Servidor GitLab FALSO para las pruebas del adaptador (core/integraciones/proveedores/gitlab.js).
 *
 * Escucha en 127.0.0.1 con node:http: ninguna prueba toca la red ni usa credenciales reales. Las
 * respuestas tienen la forma de contratos-respuesta.md (ejemplos construidos a mano, no capturas).
 * Modela solo lo que el adaptador usa; cualquier otra ruta o método responde 404 / 405 y se anota,
 * de modo que una prueba puede afirmar «no se hizo nada más».
 *
 * Estado en memoria; no guarda nada en disco.
 */

import { createServer } from 'node:http';

/**
 * @typedef {Object} NotaFalsa
 * @property {number} id
 * @property {string} body
 * @property {boolean} [system]
 * @property {{ username: string }} [author]
 *
 * @typedef {Object} IncidenciaFalsa
 * @property {string} title
 * @property {string | null} description
 * @property {string[]} [labels]
 * @property {string} [state]
 * @property {NotaFalsa[]} [notas]
 *
 * @typedef {Object} ProyectoFalso
 * @property {number} [id]
 * @property {boolean} [archived]
 * @property {string[]} [ramas]
 * @property {Record<string, string>} [archivos]   rutas que existen en la rama base
 * @property {Record<number, IncidenciaFalsa>} [incidencias]
 *
 * @typedef {Object} OpcionesServidor
 * @property {string} token
 * @property {Record<string, ProyectoFalso>} proyectos    clave: ruta completa («grupo/sub/proyecto»)
 * @property {'personal'|'proyecto'} [tipoToken]          un token de proyecto no tiene /personal_access_tokens/self
 * @property {string[]} [ambitos]                         ámbitos que devuelve el token personal
 * @property {number} [porPagina]                         tope de elementos por página de notas
 * @property {boolean} [respetarDraft]                    la API marca como borrador si el título empieza por «Draft:»
 * @property {boolean} [aceptarParametroDraft]            además acepta draft: true
 * @property {string|null} [usuario]                      nombre de usuario de la cuenta del token (GET /user); null = 404
 */

/**
 * @param {OpcionesServidor} o
 */
export async function crearServidorGitLab(o) {
  const proyectos = new Map(Object.entries(o.proyectos).map(([ruta, p]) => [ruta, {
    id: p.id ?? 4,
    archived: p.archived === true,
    ramas: new Set(p.ramas ?? ['main']),
    archivos: new Map(Object.entries(p.archivos ?? {})),
    incidencias: new Map(Object.entries(p.incidencias ?? {}).map(([iid, i]) => [Number(iid), { ...i, notas: [...(i.notas ?? [])] }])),
    commits: /** @type {any[]} */ ([]),
    mrs: /** @type {any[]} */ ([]),
  }]));
  let siguienteId = 1000;
  /** @type {Array<{ metodo: string, ruta: string, cabeceras: Record<string, any>, cuerpo: any }>} */
  const peticiones = [];
  /** @type {Array<{ coincide: (m: string, ruta: string) => boolean, estado: number, cuerpo?: any, cabeceras?: Record<string, string>, crudo?: string }>} */
  const fallos = [];
  const porPagina = o.porPagina ?? 20;

  const servidor = createServer((req, res) => {
    const trozos = [];
    req.on('data', (c) => trozos.push(c));
    req.on('end', () => {
      const crudo = Buffer.concat(trozos).toString('utf8');
      let cuerpo = null;
      if (crudo) { try { cuerpo = JSON.parse(crudo); } catch { cuerpo = crudo; } }
      const metodo = req.method ?? 'GET';
      const ruta = req.url ?? '';
      peticiones.push({ metodo, ruta, cabeceras: { ...req.headers }, cuerpo });

      /** @param {number} estado @param {any} [dato] @param {Record<string, string>} [cab] @param {string} [texto] */
      const responder = (estado, dato, cab = {}, texto) => {
        const t = texto ?? (dato === undefined ? '' : JSON.stringify(dato));
        res.writeHead(estado, { 'content-type': 'application/json', ...cab });
        res.end(metodo === 'HEAD' ? undefined : t);
      };

      const f = fallos.find((x) => x.coincide(metodo, ruta));
      if (f) { responder(f.estado, f.cuerpo, f.cabeceras, f.crudo); return; }

      if (req.headers['private-token'] !== o.token) { responder(401, { message: '401 Unauthorized' }); return; }
      if (!['GET', 'HEAD', 'POST'].includes(metodo)) { responder(405, { message: 'Method Not Allowed' }); return; }

      const url = new URL(ruta, 'http://local');
      const seg = url.pathname.split('/');            // ['', 'api', 'v4', ...]
      if (seg[1] !== 'api' || seg[2] !== 'v4') { responder(404, { message: '404 Not Found' }); return; }
      const resto = seg.slice(3);

      if (metodo === 'GET' && resto.join('/') === 'user') {
        if (o.usuario === null) { responder(404, { message: '404 Not Found' }); return; }
        responder(200, { id: 9, username: o.usuario ?? 'forge-bot-ejemplo', state: 'active' });
        return;
      }
      if (metodo === 'GET' && resto.join('/') === 'personal_access_tokens/self') {
        if (o.tipoToken === 'proyecto') { responder(404, { message: '404 Not Found' }); return; }
        responder(200, { id: 9, name: 'forge-test', revoked: false, active: true, scopes: o.ambitos ?? ['api'], expires_at: '2027-01-01' });
        return;
      }
      if (resto[0] !== 'projects' || resto.length < 2) { responder(404, { message: '404 Not Found' }); return; }
      const ruta_proyecto = decodeURIComponent(resto[1]);
      const p = proyectos.get(ruta_proyecto);
      if (!p || /%2F/i.test(resto[1]) === false && ruta_proyecto.includes('/')) { responder(404, { message: '404 Project Not Found' }); return; }
      const sub = resto.slice(2);

      // Proyecto
      if (sub.length === 0 && metodo === 'GET') {
        responder(200, { id: p.id, path_with_namespace: ruta_proyecto, archived: p.archived, default_branch: 'main' });
        return;
      }
      // Incidencia y notas
      if (sub[0] === 'issues' && /^\d+$/.test(sub[1] ?? '')) {
        const iid = Number(sub[1]);
        const inc = p.incidencias.get(iid);
        if (!inc) { responder(404, { message: '404 Not found' }); return; }
        if (sub.length === 2 && metodo === 'GET') {
          responder(200, {
            id: 40 + iid, iid, project_id: p.id, title: inc.title, description: inc.description, state: inc.state ?? 'opened',
            labels: inc.labels ?? [], author: { username: 'autor-ejemplo' },
            web_url: `http://${req.headers.host}/${ruta_proyecto}/-/issues/${iid}`,
          });
          return;
        }
        if (sub[2] === 'notes' && sub.length === 3 && metodo === 'GET') {
          const pagina = Math.max(1, Number(url.searchParams.get('page') ?? 1));
          const pp = Math.min(100, Math.max(1, Number(url.searchParams.get('per_page') ?? 20)), porPagina);
          const todas = inc.notas ?? [];
          const trozo = todas.slice((pagina - 1) * pp, pagina * pp);
          const hayMas = pagina * pp < todas.length;
          responder(200, trozo.map((n) => ({
            id: n.id, type: null, body: n.body, system: n.system === true, internal: false,
            author: n.author ?? { username: 'otro-usuario-ejemplo' }, created_at: '2026-10-02T09:00:00.000Z',
          })), { 'x-next-page': hayMas ? String(pagina + 1) : '', 'x-page': String(pagina) });
          return;
        }
        if (sub[2] === 'notes' && sub.length === 3 && metodo === 'POST') {
          if (!cuerpo || typeof cuerpo.body !== 'string') { responder(400, { message: 'body is missing' }); return; }
          const nota = { id: siguienteId++, body: cuerpo.body, system: false, author: { username: o.usuario ?? 'forge-bot-ejemplo' } };
          inc.notas = [...(inc.notas ?? []), nota];
          responder(201, { id: nota.id, body: nota.body, author: nota.author, system: false, created_at: '2026-10-11T12:00:00.000Z' });
          return;
        }
      }
      // Ramas
      if (sub[0] === 'repository' && sub[1] === 'branches') {
        if (sub.length === 3 && metodo === 'GET') {
          const nombre = decodeURIComponent(sub[2]);
          if (!p.ramas.has(nombre)) { responder(404, { message: '404 Branch Not Found' }); return; }
          responder(200, { name: nombre, protected: nombre === 'main', default: nombre === 'main', commit: { id: 'a'.repeat(40) } });
          return;
        }
        if (sub.length === 2 && metodo === 'POST') {
          const { branch, ref } = cuerpo ?? {};
          if (typeof branch !== 'string' || typeof ref !== 'string') { responder(400, { message: 'branch/ref missing' }); return; }
          if (p.ramas.has(branch)) { responder(400, { message: 'Branch already exists' }); return; }
          if (!p.ramas.has(ref)) { responder(400, { message: 'Invalid reference name' }); return; }
          p.ramas.add(branch);
          responder(201, { name: branch, protected: false, default: false, commit: { id: 'b'.repeat(40) } });
          return;
        }
      }
      // Archivos (existencia en la rama base)
      if (sub[0] === 'repository' && sub[1] === 'files' && sub.length === 3 && (metodo === 'HEAD' || metodo === 'GET')) {
        const archivo = decodeURIComponent(sub[2]);
        const ref = url.searchParams.get('ref') ?? '';
        if (!p.ramas.has(ref) || !p.archivos.has(archivo)) { responder(404, { message: '404 File Not Found' }); return; }
        responder(200, { file_name: archivo.split('/').pop(), file_path: archivo, ref });
        return;
      }
      // Commit
      if (sub[0] === 'repository' && sub[1] === 'commits' && sub.length === 2 && metodo === 'POST') {
        const { branch, commit_message: mensaje, actions } = cuerpo ?? {};
        if (!p.ramas.has(branch)) { responder(400, { message: 'A branch called that does not exist' }); return; }
        if (typeof mensaje !== 'string' || !Array.isArray(actions) || actions.length === 0) { responder(400, { message: 'actions missing' }); return; }
        for (const a of actions) {
          const existe = p.archivos.has(a.file_path);
          if (a.action === 'create' && existe) { responder(400, { message: 'A file with this name already exists' }); return; }
          if (a.action === 'update' && !existe) { responder(400, { message: 'A file with this name doesn\'t exist' }); return; }
        }
        p.commits.push({ branch, mensaje, actions });
        responder(201, { id: 'c'.repeat(40), short_id: 'cccccccc', title: mensaje.split('\n')[0], message: mensaje });
        return;
      }
      // Solicitud de fusión
      if (sub[0] === 'merge_requests' && sub.length === 1 && metodo === 'POST') {
        const { source_branch: origen, target_branch: destino, title } = cuerpo ?? {};
        if (typeof origen !== 'string' || typeof destino !== 'string' || typeof title !== 'string') { responder(400, { message: 'missing' }); return; }
        const borrador = (o.respetarDraft !== false && /^\s*(draft:|\[draft\]|\(draft\))/i.test(title)) || (o.aceptarParametroDraft === true && cuerpo.draft === true);
        const iid = p.mrs.length + 1;
        const mr = { id: siguienteId++, iid, project_id: p.id, title, state: 'opened', source_branch: origen, target_branch: destino, draft: borrador, web_url: `http://${req.headers.host}/${ruta_proyecto}/-/merge_requests/${iid}` };
        p.mrs.push({ ...mr, description: cuerpo.description });
        responder(201, mr);
        return;
      }
      responder(404, { message: '404 Not Found' });
    });
  });

  await new Promise((r) => servidor.listen(0, '127.0.0.1', () => r(undefined)));
  const puerto = /** @type {any} */ (servidor.address()).port;

  return {
    puerto,
    host: `127.0.0.1:${puerto}`,
    baseUrl: `http://127.0.0.1:${puerto}`,
    peticiones,
    /** Estado interno de un proyecto, para afirmar lo que quedó. @param {string} ruta */
    proyecto: (ruta) => proyectos.get(ruta),
    /** Respuesta forzada para las peticiones que cumplan el predicado (se evalúa antes que nada). */
    fallar(coincide, estado, cuerpo, cabeceras, crudo) { fallos.push({ coincide, estado, cuerpo, cabeceras, crudo }); },
    limpiarFallos() { fallos.length = 0; },
    /** Peticiones que escriben (todo salvo GET y HEAD). */
    escrituras: () => peticiones.filter((p) => p.metodo !== 'GET' && p.metodo !== 'HEAD'),
    async cerrar() {
      servidor.closeAllConnections();
      await new Promise((r) => servidor.close(() => r(undefined)));
    },
  };
}

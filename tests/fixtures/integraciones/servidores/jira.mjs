// @ts-check
/**
 * Servidor FALSO de Jira Cloud (REST v3) para las pruebas del adaptador. Escucha solo en 127.0.0.1,
 * con puerto efímero, y no hace ninguna llamada de red. Las respuestas siguen la forma de
 * `spikes/contratos-respuesta.md` (ejemplos construidos a mano, no capturas reales).
 *
 * Uso:
 *   const s = await crearServidorJiraFalso({ usuario, token, tickets: { 'ABC-1': { summary, description, labels, comments } } });
 *   s.baseUrl            // http://127.0.0.1:<puerto>
 *   s.peticiones         // todas las recibidas: { metodo, ruta, cabeceras, cuerpo }
 *   s.forzar = (p) => ({ estado: 500, texto: '...' })   // sustituye la respuesta (o undefined para no tocar)
 *   await s.cerrar()
 */

import { createServer } from 'node:http';

const CLAVE = /^[A-Z][A-Z0-9_]{1,19}-\d{1,9}$/;
/** accountId de la cuenta del token en el servidor falso (GET /myself). */
export const CUENTA_PROPIA = 'cuenta-forge';

/**
 * @typedef {Object} TicketFalso
 * @property {string} summary
 * @property {unknown} [description]        ADF (o null)
 * @property {string[]} [labels]
 * @property {Array<{ id?: string, autor?: string, cuenta?: string, body: unknown }>} [comments]   `cuenta`: accountId del autor
 */

/** Documento ADF con un párrafo, para construir comentarios de prueba. @param {string} texto */
export function adfParrafo(texto) {
  return { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }] };
}

/**
 * @param {{ usuario: string, token: string, tickets?: Record<string, TicketFalso>, porPaginaMax?: number, cuenta?: string|null }} o
 */
export async function crearServidorJiraFalso(o) {
  /** @type {Record<string, TicketFalso>} */
  const tickets = JSON.parse(JSON.stringify(o.tickets ?? {}));
  const porPaginaMax = o.porPaginaMax ?? 100;
  const esperado = 'Basic ' + Buffer.from(`${o.usuario}:${o.token}`, 'utf8').toString('base64');
  let siguienteId = 10000;
  /** @type {Array<{ metodo: string, ruta: string, cabeceras: Record<string, any>, cuerpo: string }>} */
  const peticiones = [];

  const estado = {
    peticiones,
    tickets,
    /** @type {((p: { metodo: string, ruta: string, cuerpo: string }) => ({ estado: number, texto?: string, cabeceras?: Record<string, string>, grande?: number } | undefined)) | null} */
    forzar: null,
    baseUrl: '',
    puerto: 0,
    async cerrar() {
      servidor.closeAllConnections();
      await new Promise((r) => servidor.close(() => r(undefined)));
    },
  };

  /** @type {import('node:http').Server} */
  const servidor = createServer((req, res) => {
    const trozos = [];
    req.on('data', (c) => trozos.push(c));
    req.on('end', () => {
      const cuerpo = Buffer.concat(trozos).toString('utf8');
      const metodo = req.method ?? '';
      const ruta = req.url ?? '';
      peticiones.push({ metodo, ruta, cabeceras: { ...req.headers }, cuerpo });
      const responder = (codigo, objeto, cab = {}) => {
        res.writeHead(codigo, { 'content-type': 'application/json', ...cab });
        res.end(typeof objeto === 'string' ? objeto : JSON.stringify(objeto));
      };

      if (estado.forzar) {
        const f = estado.forzar({ metodo, ruta, cuerpo });
        if (f) {
          if (typeof f.grande === 'number') {
            res.writeHead(f.estado, { 'content-type': 'application/json' });
            res.end('x'.repeat(f.grande));
            return;
          }
          responder(f.estado, f.texto ?? '{}', f.cabeceras);
          return;
        }
      }

      if (req.headers.authorization !== esperado) {
        responder(401, { errorMessages: ['Client must be authenticated to access this resource.'] });
        return;
      }

      const u = new URL(ruta, 'http://local');
      // La cuenta del propio token (R7)
      if (u.pathname === '/rest/api/3/myself' && metodo === 'GET') {
        if (o.cuenta === null) { responder(404, { errorMessages: ['no disponible'] }); return; }
        responder(200, { accountId: o.cuenta ?? CUENTA_PROPIA, displayName: 'FORGE', active: true });
        return;
      }
      const m = /^\/rest\/api\/3\/issue\/([^/]+)(\/comment)?$/.exec(u.pathname);
      if (!m) { responder(404, { errorMessages: ['no existe'] }); return; }
      const clave = decodeURIComponent(m[1]);
      if (!CLAVE.test(clave) || !tickets[clave]) {
        responder(404, { errorMessages: ['Issue does not exist or you do not have permission to see it.'] });
        return;
      }
      const t = tickets[clave];

      if (!m[2]) {
        if (metodo !== 'GET') { responder(405, {}); return; }
        responder(200, {
          id: '10010', key: clave, self: `https://tu-dominio.atlassian.net/rest/api/3/issue/10010`,
          fields: { summary: t.summary, description: t.description ?? null, labels: t.labels ?? [], status: { name: 'Open' } },
        });
        return;
      }

      const comentarios = (t.comments ??= []);
      if (metodo === 'GET') {
        const inicio = Math.max(0, Number(u.searchParams.get('startAt') ?? 0) | 0);
        const pedido = Math.max(1, Number(u.searchParams.get('maxResults') ?? 100) | 0);
        const n = Math.min(pedido, porPaginaMax);
        const pagina = comentarios.slice(inicio, inicio + n).map((c, i) => ({
          id: c.id ?? String(20000 + inicio + i),
          self: 'https://tu-dominio.atlassian.net/rest/api/3/issue/10010/comment/x',
          author: { accountId: c.cuenta ?? 'cuenta-ejemplo', displayName: c.autor ?? 'Persona Ejemplo', active: true },
          body: c.body,
          created: '2026-10-01T12:00:00.000+0000',
          updated: '2026-10-01T12:00:00.000+0000',
        }));
        responder(200, { startAt: inicio, maxResults: n, total: comentarios.length, comments: pagina });
        return;
      }
      if (metodo === 'POST') {
        let j;
        try { j = JSON.parse(cuerpo); } catch { responder(400, { errorMessages: ['JSON'] }); return; }
        if (!j || j.body?.type !== 'doc' || j.body?.version !== 1 || !Array.isArray(j.body?.content)) {
          responder(400, { errorMessages: ['Comment body is not valid!'] });
          return;
        }
        const id = String(siguienteId++);
        comentarios.push({ id, autor: 'FORGE', cuenta: o.cuenta ?? CUENTA_PROPIA, body: j.body });
        responder(201, { id, self: `https://tu-dominio.atlassian.net/rest/api/3/issue/10010/comment/${id}`, body: j.body, created: '2026-10-11T12:00:00.000+0000' });
        return;
      }
      responder(405, {});
    });
  });

  await new Promise((r) => servidor.listen(0, '127.0.0.1', () => r(undefined)));
  estado.puerto = /** @type {any} */ (servidor.address()).port;
  estado.baseUrl = `http://127.0.0.1:${estado.puerto}`;
  return estado;
}

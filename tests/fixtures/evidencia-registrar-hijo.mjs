// Proceso hijo de la prueba de concurrencia: registra cinco verificaciones encadenadas en el proyecto que
// recibe como argumento. Va como archivo (no como código en línea) para no depender de las comillas.
import { registrarVerificacion } from '../../core/verificar/registro.js';

const cwd = process.argv[2];
const duracion = Number(process.argv[3]);
for (let i = 0; i < 5; i++) {
  const r = registrarVerificacion(cwd, { formato: 1, veredicto: 'pasa', codigoSalida: 0, comando: 'x', lenguaje: 'js', duracionMs: duracion }, {});
  if (!r.ok) { console.error(r.error); process.exit(1); }
}

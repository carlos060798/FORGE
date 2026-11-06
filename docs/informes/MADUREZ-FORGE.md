# Madurez de FORGE/Fragua 5.0.0

Fecha: 2026-11-06. Evaluación de solo lectura. Fuentes: `docs/informes/EVALUACION-DEL-MARCO.md`, `COMPARATIVA-DE-MERCADO.md`, `AUDITORIA-RAMAS-Y-PLANES.md`, `CRITICA-HOSTIL.md` y `SDLC-NATIVO-FALTANTES.md` (estos dos ya existían al cerrar; `SEGURIDAD-CIBER.md` no existía y no se incorporó), más comprobaciones propias.

## 1. Verificación propia

| Comando | Resultado |
|---|---|
| `npm run typecheck` (`tsc`) | Termina sin errores. |
| `node --test tests/agents.test.js tests/evals/guardian.test.js` | 154 pruebas, 154 pasan, 5,3 s. |
| `timeout 200 node --test tests/verificar-mutacion.test.js` | No termina en 200 s ni da resumen. Se reproduce el fallo H-04 de la evaluación del marco: el archivo se cuelga o es demasiado lento. Como `prepublishOnly` ejecuta `npm test` (`package.json`), esto bloquea la publicación. |
| `claude-hooks/pre-tool-guard.js:53-56` | Confirmado: la regex `rm\s+-rf?\s+` no cubre `-fr`, `-Rf` ni `--recursive --force` (H-01). |
| `git log` / `git tag` | 306 commits y ninguna etiqueta. No existe `SECURITY.md`. Hay CI (`.github/workflows/ci.yml`, Node 20/22) y plantillas de incidencias. |

No repetí la suite completa. La cifra de referencia viene de la evaluación del marco: 4057 pruebas, 4025 pasan, 1 falla y 31 se omiten, que son las de Docker real.

## 2. Modelo de madurez

Escala de 1 a 5. 1: idea o prototipo. 2: funciona en el entorno del autor. 3: beta, validado en más de un entorno y con usuarios externos limitados. 4: producción, con publicación, CI verde, soporte y seguridad formal. 5: referente, con comunidad, estándares y métricas de campo.

| Dimensión | Nivel | Evidencia |
|---|---|---|
| Funcionalidad | 3 | El pipeline de 9 etapas, el ciclo verificado, MCP/API, ADR y el export a Spec Kit/OpenSpec existen en código con pruebas (`core/`, `cli/`; `forge status` en SDLC-NATIVO). Pero solo se ha probado en proyectos pequeños, hay fases que solo son prompt (SDLC-NATIVO, tabla por fase) y no hay ningún despliegue de extremo a extremo demostrado (CRITICA-HOSTIL §1). |
| Calidad y pruebas | 3 | Más de 4000 pruebas, `tsc` limpio, evals del guardián y mutación. En contra: la suite no está verde (`tests/verificar-mutacion.test.js` se cuelga, comprobado), las 31 pruebas omitidas son justo las de Docker, que respaldan la tesis central (CRITICA-HOSTIL §1), y `cli/index.js` tiene 2243 líneas. |
| Seguridad | 2 | El guardián se esquiva con variantes triviales (`pre-tool-guard.js:53-56`). El fallback `.sh` saca el comando con grep sobre el JSON (`pre-tool-guard.sh:46-70`). El hook deja pasar todo si recibe una entrada malformada (`:197-203`). Los secretos se filtran por nombre de archivo y pueden llegar al proveedor del modelo (`docs/PROBLEMAS-CONOCIDOS.md:65`). No hay `SECURITY.md`. A favor: los registros son de solo adición, se ejecuta en Docker sin red y los límites están documentados. |
| Operabilidad y CI | 2 | Hay CI definida, pero según `PROBLEMAS-CONOCIDOS.md:360` los jobs de Linux con Docker «no han corrido nunca». El único entorno validado es Windows 11. La versión 5.0.0 no está en npm (`PROBLEMAS-CONOCIDOS.md:3`). Hay 29 + 2 commits sin subir a `origin` y `main` va 240 commits por detrás (AUDITORIA §0). El tope de gasto nunca se ha contrastado con una factura (`:279`). |
| Documentación | 4 | Es muy abundante (95 archivos) y franca sobre sus límites (`PROBLEMAS-CONOCIDOS.md`, `GARANTIAS-Y-LIMITES.md`). Hay QUICK-START y guía para no técnicos. Le resta: textos desfasados (PROBLEMAS-CONOCIDOS describe el commit `82815b4`) y un marketing que exagera, con «a producción» en `README.md:9` y «sin escribir código» (CRITICA-HOSTIL §1). |
| Gobernanza | 2 | Existen CHANGELOG, VERSIONING, CONTRIBUTING, RELEASE-CHECKLIST, el guard spec→plan y la licencia MIT. Sin embargo, el propio proyecto aprueba «por delegación» (`.sdd/especificaciones/2026-10-03-api-http/plan.md:3`, citado en CRITICA-HOSTIL). No hay etiquetas de versión. Hay un único mantenedor (`LICENSE:3`). No hay RBAC ni políticas de organización (COMPARATIVA §3.6). |
| Adopción y comunidad | 1 | El paquete no está publicado, no hay usuarios externos medidos y la comunidad no se ha cuantificado (COMPARATIVA, tabla). Como referencia, Spec Kit tiene 148k estrellas y OpenSpec 74k. |
| Agnosticismo | 2 | El motor LLM admite Anthropic, OpenAI, Ollama y Stub, pero OpenAI y Ollama nunca se han probado de verdad. `--integracion` cubre 8 herramientas, aunque solo reciben skills; los comandos, agentes y hooks completos son nativos de Claude Code (COMPARATIVA §1 y §3.2). |

Media aproximada: 2,4.

## 3. Dictamen global

**Pre-beta, con un núcleo técnico de calidad beta.**

- El código y las pruebas corresponden a una beta temprana.
- La distribución, la seguridad operativa, la validación multiplataforma y la adopción corresponden a un prototipo avanzado.
- No está lista para producción. Faltan cuatro cosas:
  1. publicarla;
  2. tener la CI de Linux en verde;
  3. un guardián que no se esquive con trivialidades;
  4. un solo usuario externo.
- Lo diferencial no tiene par en el mercado consultado, aunque está sin demostrar en campo. Es el veredicto por código de salida en un contenedor sin red, con separación de roles, la detección de «éxito sospechoso» y el tope de gasto.

## 4. Hoja de ruta mínima hacia beta (nivel 3 en todas las dimensiones)

Orden de prioridad. **[Ya]** significa que se puede hacer sin el dueño. **[Dueño]** significa que requiere su decisión.

1. **[Ya]** Dejar la suite en verde. Hay que diagnosticar el cuelgue de `tests/verificar-mutacion.test.js`, ponerle un timeout explícito o moverlo a `test:lento`, y registrar el motivo de cada prueba omitida. Desbloquea `prepublishOnly`.
2. **[Ya]** Endurecer el guardián:
   - tokenizar el comando y normalizar las banderas (`-fr`, `-Rf`, `--recursive --force`);
   - añadir los casos de evasión a `tests/evals/casos-guardian.json`;
   - en Bash, que bloquee por defecto si no hay Node;
   - registrar las entradas malformadas en la auditoría;
   - unificar Node >= 20 en el wrapper.
3. **[Ya]** Crear `SECURITY.md` con el canal de reporte y el alcance, que debe decir que el hook es una red de seguridad y no un límite.
4. **[Dueño]** Subir los commits locales a `origin` y hacer el fast-forward de `main` (sin conflictos, AUDITORIA §2). Antes hay que rescatar los 9 informes de revisión de los worktrees y después podarlos.
5. **[Dueño]** Lanzar la CI en GitHub Actions, incluidos los jobs `aislamiento` y `pruebas-docker` en Linux, y corregir lo que falle. Es la prueba de la tesis central.
6. **[Dueño]** Decidir cómo publicar: `fragua@5.0.0-beta.1` con dist-tag `beta`, etiqueta git y una entrada en el CHANGELOG.
7. **[Dueño]** Rebajar el marketing a lo demostrado: quitar «a producción» y «sin escribir código» hasta que haya evidencia, y ajustar las palabras clave de `package.json`.
8. **[Dueño]** Cumplir su propio guard: no más `aprobado_por_delegacion` sin un registro verificable de quién aprobó, cuándo y con qué hash.
9. **[Ya]** Validar con proveedores reales. Una ejecución corta con OpenAI y otra con Ollama, con la evidencia guardada. Además, contrastar el tope de gasto con una factura real.
10. **[Dueño]** Conseguir de 3 a 5 usuarios piloto externos, con al menos uno en Linux o macOS, y recoger sus incidencias.
11. **[Ya, deuda]** Partir `cli/index.js` en `cli/comandos/`, consolidar los duplicados (`deploy-vercel`/`vercel-deploy` y los 4 comandos de compresión) y fechar o archivar los documentos obsoletos.

Criterio de salida a beta: suite y CI de Linux en verde, paquete beta publicado, el guardián pasa los casos de evasión, existe `SECURITY.md` y hay al menos 3 usuarios externos con incidencias registradas.

## 5. Limitaciones

- Las pruebas fueron puntuales; no repetí la suite completa.
- No se usó Docker ni modelos reales.
- La seguridad se evaluó sin `SEGURIDAD-CIBER.md`, que no existía al cerrar.
- Las cifras de comunidad de otros proyectos salen de COMPARATIVA y cambian rápido.

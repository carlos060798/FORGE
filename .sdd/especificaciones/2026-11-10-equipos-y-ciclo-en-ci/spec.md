---
id: 2026-11-10-equipos-y-ciclo-en-ci
titulo: "Equipos pequeños: aprobaciones atribuibles entre personas, estado del ciclo compartible por git y el ciclo verificado corriendo en la integración continua"
tamano: grande  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-10
actualizada: 2026-11-10
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [equipos, aprobaciones, ci, evidencia, fase-4]
---

# Especificación: equipos y ciclo en CI

> **Estado (2026-11-10): borrador, solo especificación; no hay código.** Es la Fase 4 del plan «Marco Mínimo Viable para el desarrollador individual»: **no se implementa hasta que el MVP esté cerrado** (CI verde, beta publicada, uso real documentado) y el dueño resuelva las decisiones abiertas. Se escribe ahora para que las decisiones estén sobre la mesa. El ciclo desde otras herramientas (Cursor, Codex) **no** va aquí: ya lo cubren las fases 2 y 3 de `2026-10-14-ciclo-por-mcp`.

## 1. Contexto y Motivación

Hoy Fragua está pensado para una persona en su equipo: el estado del ciclo (`.sdd/motor/`) y el candado del proyecto no se versionan; los puntos de guardado llevan un sello con una clave que vive fuera del proyecto y no sale del equipo (`core/estado-usuario.js`), así que una sesión empezada en un portátil no se reanuda en otro; las aprobaciones (`.sdd/aprobaciones.jsonl`) se firman con esa misma clave local, de modo que otra persona no puede verificar que la firma es de quien dice ser; y el ciclo verificado solo corre donde está Docker y la persona, nunca en la integración continua.

La visión del dueño es un marco que sirva igual a una persona sola y a un equipo pequeño que hace producto. Para un equipo de dos a cinco personas hacen falta tres cosas que hoy no existen, y las tres chocan con una garantía actual (un repositorio no puede fabricar estado que el ciclo acepte), así que necesitan decisión explícita.

## 2. Objetivo

Que un equipo pequeño pueda: (a) saber **quién** aprobó cada spec y plan, y verificarlo desde cualquier equipo del equipo; (b) **retomar** un ciclo que empezó otra persona, sin perder las garantías de sello; (c) ejecutar el ciclo verificado **en la integración continua**, con el mismo veredicto por código de salida y la misma cadena de evidencia, de forma que la fusión a `main` dependa de ese veredicto y no de un portátil.

## 3. Criterios de aceptación (propuesta; cada uno espera decisión)

### Aprobaciones atribuibles
- **CA-001-01** Una aprobación lleva, además del HMAC local, una **firma verificable por terceros** atada a la identidad git de quien aprueba: firma SSH (`git config gpg.format ssh`, la misma clave que ya usa para firmar commits) o GPG. `fragua verificar --comprobar-aprobaciones` la comprueba contra una lista de claves permitidas que vive en el repositorio (`.sdd/aprobadores.txt`, en el formato `allowed_signers` de SSH).
- **CA-001-02** Sin clave de firma configurada, `fragua aprobar` sigue funcionando como hoy (solo HMAC local) y lo dice; `--comprobar-aprobaciones --exigir-firma` falla en ese caso. Así el solo dev no cambia nada.
- **CA-001-03** `.sdd/aprobaciones.jsonl` se versiona (hoy `.gitignore` lo excluye vía `.sdd/*`); un registro que no case con el hash vigente del archivo aprobado se rechaza igual que hoy.

### Estado del ciclo compartible
- **CA-002-01** Un ciclo se puede **exportar** (`fragua ciclo exportar <sesión>`) como un paquete firmado con la clave de firma de la persona (no con el HMAC local), e **importar** en otro equipo; el sello local se regenera al importar y queda registrado quién importó qué y cuándo.
- **CA-002-02** Lo que nunca sale del equipo: la clave HMAC local, las claves de proveedor y cualquier secreto. Un paquete que contenga un formato de secreto conocido se rechaza al exportar.
- **CA-002-03** Reanudar un ciclo importado no repite llamadas pagadas (misma regla que hoy: el diario manda).

### Ciclo en CI
- **CA-003-01** `fragua run --ci` ejecuta el ciclo sin terminal: las pausas que hoy piden una decisión humana **terminan la ejecución con un código de salida propio** (propuesta: 6) y dejan la decisión pendiente escrita en `.sdd/motor/<sesión>/pendiente.json`, para que una persona la tome después con `fragua resume --decision`.
- **CA-003-02** Un workflow de ejemplo (`.github/workflows/ciclo.yml`, apagado por defecto) corre `fragua run --ci` con Docker real en `ubuntu-latest`, con la clave del proveedor en un secreto del repositorio y un tope de gasto por ejecución que fija el workflow (no el repositorio: `FRAGUA_BUDGET_USD` como variable del entorno de CI).
- **CA-003-03** El informe de evidencia de una ejecución en CI lleva `origen: ci` y el identificador del run dentro de lo que firma la cadena; `--comprobar-evidencia --exigir-origen ci` permite que la protección de rama dependa de él.
- **CA-003-04** Un ciclo en CI nunca hace push ni abre solicitudes de cambio por sí mismo: deja los archivos en el workspace del runner y es el workflow (es decir, el equipo) quien decide publicarlos. Coherente con ADR-22.

## 4. Decisiones abiertas (del dueño)

1. **Firma:** ¿SSH (reutiliza la clave de firmar commits, sin dependencias) o GPG (más extendido en empresas, exige binario)? Propuesta: SSH primero.
2. **Versionar `.sdd/aprobaciones.jsonl`:** cambia la regla de que `.sdd/` no se versiona salvo artefactos. ¿Sí o no?
3. **Exportar ciclos:** ¿vale la pena frente a la alternativa simple «cada persona empieza su propio ciclo y el CI es la fuente de verdad»? Propuesta: **aplazar** la exportación y hacer solo aprobaciones firmadas más ciclo en CI; es más pequeño y cubre el caso real.
4. **Código de salida para «decisión pendiente» en CI:** 6 está libre (hoy: 0 éxito, 1 fallo, 4 sin aislamiento, 5 cero pruebas).
5. **Tope de gasto en CI:** ¿por ejecución, por día de repositorio, o ambos?

## 5. Fuera de alcance

- Un servidor central, cuentas de usuario o RBAC: todo se apoya en git y en el proveedor de CI.
- Ejecutar el ciclo desde Cursor, Codex u otros hosts: `2026-10-14-ciclo-por-mcp`, fases 2 y 3.
- Equipos de más de cinco personas o varios repositorios.

## 6. Dependencias

- `2026-11-06-aprobaciones-con-identidad` (terminal real, registro firmado) cerrada y aprobada.
- CI verde en Linux con Docker real (`2026-11-09-ci-verde-y-cuarentena`), porque el ciclo en CI corre sobre ese job.
- ADR nuevo que matice ADR-04 (puntos de guardado en archivos) y la garantía «un repositorio no puede fabricar un estado que el ciclo acepte» para el caso de la importación firmada, si la decisión 3 la mantiene.

# Documentación de FORGE

> **Sitio web de documentación**: hay una versión navegable, bilingüe (ES/EN) y con buscador en [`docs-site/`](../docs-site/) — ábrela en el navegador o visita la versión publicada en GitHub Pages.

Esta carpeta contiene la documentación de referencia en Markdown. Está organizada en dos rutas según para quién es.

---

## 🟢 Para construir (no necesitas saber programar)

| Documento | De qué trata |
|-----------|--------------|
| [INICIO-RAPIDO.md](INICIO-RAPIDO.md) | Los primeros pasos: instalar y escribir tu primera idea |
| [FABRICA.md](FABRICA.md) | Cómo una idea se convierte en producto, en vivo y sin código |
| [QUE-PASA-SI-FALLA.md](QUE-PASA-SI-FALLA.md) | Qué hacer cuando algo sale mal, en lenguaje simple |
| [SEGURIDAD-PARA-NOTECNICOS.md](SEGURIDAD-PARA-NOTECNICOS.md) | Tokens y seguridad explicados sin miedo |

## 🔵 Para entender el motor (desarrolladores)

| Documento | De qué trata |
|-----------|--------------|
| [FLUJO.md](FLUJO.md) | El flujo de ingeniería SDD completo, con diagrama |
| [FILOSOFIA.md](FILOSOFIA.md) | Qué es SDD y los principios que lo guían |
| [AGENTES.md](AGENTES.md) | Los 14 agentes: roles, cuándo se activan, L5 Governance |
| [AGENTES-DETALLE.md](AGENTES-DETALLE.md) | Qué produce cada agente, cómo depurarlo y personalizarlo |
| [MODELOS.md](MODELOS.md) | Qué modelo de Claude usa cada agente y routing dinámico v2.7 |
| [MEMORIA-Y-OBSERVABILIDAD.md](MEMORIA-Y-OBSERVABILIDAD.md) | Persistencia, ledger y compresión de tokens |
| [MAPAS.md](MAPAS.md) | Indexación de estructura, símbolos y dependencias |
| [RELACION-CON-CLAUDE-CODE.md](RELACION-CON-CLAUDE-CODE.md) | FORGE como capa sobre las primitivas oficiales |
| [PERSONALIZACION.md](PERSONALIZACION.md) | Los 5 niveles de personalización |
| [COMPRESION.md](COMPRESION.md) | La técnica de compresión de contexto |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Errores técnicos reales de FORGE y sus soluciones |

## 📖 Ejemplos y casos

| Documento | De qué trata |
|-----------|--------------|
| [CASO-COMPLETO.md](CASO-COMPLETO.md) | Caso introductorio: app de lista de tareas (perfil guiado) |
| [EJEMPLO-API-REST.md](EJEMPLO-API-REST.md) | Caso mediano: API REST con JWT y PostgreSQL (perfil experto) |
| [EJEMPLOS.md](EJEMPLOS.md) | Ejemplos por stack (TypeScript, Python, Go…) |

---

## Ingeniería de prompts

La guía de ingeniería de prompts con Claude — principios oficiales, ejemplos buenos vs malos y cómo FORGE los aplica — está en el **sitio de documentación** ([`docs-site/`](../docs-site/)), sección *Ingeniería de prompts*.

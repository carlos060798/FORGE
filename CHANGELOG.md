# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-06-13

### Added

#### Dashboard de Estado
- Página "Estado" en UI web: fase actual, progreso %, tareas completadas/totales
- Auto-refresh cada 5s: usuario ve progreso en tiempo real sin recargar
- 4 cards informativos: especificación, tareas, perfil, progreso
- Onboarding banner: si proyecto no inicializado, muestra pasos claros

#### Tracker de Tokens
- Página "Tokens" en UI web: estima tokens consumidos en contexto
- Cálculo USD: muestra costo estimado (Sonnet 4.6 @ $0.003/1K tokens)
- Desglose por tipo: constitucion.md, specs, planes, tareas
- Botón "/sdd.comprimir": atajos para comprimir si necesario

#### Recomendador de Presets Inteligente
- Wizard 4 opciones: solitario, equipo pequeño, empresa, datos sensibles
- Recomendación automática: resalta preset correcto con ⭐ badge
- Explicaciones: "Por qué recomendamos esto para tu situación"

#### Seguridad Mejorada
- `.gitignore` automático: protege .sdd/.vercel-deploy.json, .env, tokens
- Documentación SEGURIDAD-PARA-NOTECNICOS.md: guía completa para no-técnicos
- Advertencia en README: sección 🔐 SEGURIDAD visible desde inicio
- Validación inmediata de tokens: GitHub y Vercel CLI validan antes de usar

### Fixed

#### Auto-Commit Silencioso en Vercel Deploy
- Pre-checks de git ahora auto-commitean: en lugar de error mostrando `git commit`
- Usuario NO ve comandos git: "git add", "git commit", "git push" invisibles
- Cambios se guardan automáticamente: `git add -A && git commit "Auto-commit SDD-ES deploy"`
- Impacto: No-técnicos pueden completar flujo GitHub → Vercel sin fricción

#### Validación de Rutas
- PASO 4 (GitHub): path relativa correcta en invocación bash
- PASO 10 (Vercel): path relativa correcta en invocación bash

#### Sintaxis en server.js
- Línea 145: `function estimar Tokens` → `function estimarTokens`

### Security

#### Protección de Credentials
- ✅ Tokens GitHub/Vercel en variables de entorno (NO archivos)
- ✅ .gitignore creado (30+ entradas críticas)
- ✅ sdd.config.yaml NO guarda tokens (solo URLs)
- ✅ .sdd/.vercel-deploy.json ignorado automáticamente

#### Validación de Tokens
- ✅ GitHub: `gh auth status --show-token` valida antes de usar
- ✅ Vercel: `vercel whoami` valida antes de usar
- ✅ Si token inválido, sale inmediatamente

#### Documentación de Seguridad
- docs/SEGURIDAD-PARA-NOTECNICOS.md: 1000+ líneas
- docs/V2.3.0-ANALISIS-SEGURIDAD.md: análisis técnico
- Guía de recuperación si error
- Cómo generar token SEGURO (90 días expiration)

### Documentation

#### Nuevos Documentos
- docs/V2.3.0-CERTIFICACION-NONTECNICOS.md: Validación E2E
- docs/V2.3.0-ANALISIS-SEGURIDAD.md: Análisis de riesgos
- docs/V2.3.0-REPUTACION-SEGURIDAD.md: Impacto en reputación
- docs/V2.3.0-CHECKLIST-PRELANZAMIENTO.md: Checklist completo
- docs/V2.3.0-RESUMEN-EJECUTIVO-FINAL.md: Resumen ejecutivo
- docs/SEGURIDAD-PARA-NOTECNICOS.md: Guía de seguridad

#### Documentos Actualizados
- README.md: agregada sección 🔐 SEGURIDAD

### Files
- `.gitignore`: creado con protecciones críticas

## [2.1.0] - 2026-06-12

### Added
- Gate humano en `/sdd.implementar` con resumen de tareas y tokens
- Deep reasoning instructions en 4 agentes OPUS (arquitecto, crítico, seguridad, asesor-datos)
- Roadmap v2.2 documentado en docs/roadmap-v2.2.md
- Vercel deployment skill (opción A: sincrónica)
- CLI command `/sdd.config` abre UI de configuración en navegador (puerto 7842)

### Fixed
- RegExp injection vulnerability en patchYamlAgentes (SLUG_RE validation)
- Buffer DoS en parseBody (64KB limit)
- NaN validation en patchYamlCalidad
- Path traversal en leerPreset (SLUG_RE whitelist)

### Changed
- Removed `effort:` from agents (no es campo oficial de Claude Code)
- Model routing instructions en sdd.implementar y sdd.analizar

## [2.0.0] - 2026-05-15

### Added
- 26 comandos (sdd.*, especificar, planificar, implementar, analizar, verificar, etc.)
- 12 agentes especializados (arquitecto, revisor, seguridad, asesor-datos, etc.)
- 10 skills (modo-guiado, orquestacion-ptc, validacion-spec, etc.)
- 2 MCPs integrados (Figma, Playwright)
- Modo guiado para usuarios no-técnicos
- Preset enterprise con compliance (SOC2, GDPR, ISO 27001)
- QA en navegador real (Playwright)

## [1.0.0] - 2026-03-01

### Added
- Initial release
- SDD methodology foundation
- Basic command structure

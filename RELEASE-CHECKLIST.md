# Checklist de release FORGE

## Pre-publish
- [ ] `npm run build` — sin errores TypeScript
- [ ] `npm test` — todos pasando, 0 fallos (con `FORGE_TEST_DOCKER=1` si hay Docker)
- [ ] CI en verde sin Node 18 (matriz 20 y 22), **incluido el job `aislamiento`** (Linux con Docker real; nunca se ha ejecutado)
- [x] `forge probar-modelo` ejecutado con un modelo real y el informe revisado (2026-10-09: `.sdd/especificaciones/2026-10-09-validacion-modelo-real/evidencia-2026-10-09.md`)
- [ ] Gasto calculado comparado con el facturado por el proveedor (los precios de `core/session-budget.js` no están contrastados)
- [ ] Versión en package.json, plugin.json, marketplace.json y README coinciden (5.0.0), también `docs-site/assets/data.js`
- [ ] CHANGELOG.md actualizado
- [ ] Branch mergeada a main

## Publish
- [ ] `npm pack --dry-run` — verificar archivos incluidos
- [ ] `npm publish --access public`

## Post-publish
- [ ] `npx forge@latest init` en proyecto de prueba
- [ ] `forge doctor` sin errores críticos
- [ ] Tag git: `git tag v5.0.0 && git push --tags`

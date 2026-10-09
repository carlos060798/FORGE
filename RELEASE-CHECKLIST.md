# Checklist de release FORGE

## Pre-publish
- [ ] `npm run build` — sin errores TypeScript
- [ ] `npm test` — todos pasando, 0 fallos (con `FORGE_TEST_DOCKER=1` si hay Docker)
- [ ] CI en verde sin Node 18 (matriz 20 y 22), **incluido el job `aislamiento`** (Linux con Docker real; nunca se ha ejecutado)
- [ ] `forge probar-modelo` ejecutado con un modelo real y el informe revisado (5.0.0 hace el ciclo el modo por defecto y aún no se ha probado con uno de pago: **no publicar sin este paso**)
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

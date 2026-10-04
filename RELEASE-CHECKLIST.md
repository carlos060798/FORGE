# Checklist de release FORGE

## Pre-publish
- [ ] `npm run build` — sin errores TypeScript
- [ ] `npm test` — todos pasando, 0 fallos (con `FORGE_TEST_DOCKER=1` si hay Docker)
- [ ] CI en verde, **incluido el job `aislamiento`** (Linux con Docker real; nunca se ha ejecutado)
- [ ] `forge probar-modelo` ejecutado con un modelo real y el informe revisado (4.3.0 incluye el motor agéntico, aún sin probar con uno de pago)
- [ ] Versión en package.json, plugin.json, marketplace.json y README coinciden (4.3.0); `docs-site/assets/data.js` aún dice 4.2.0
- [ ] CHANGELOG.md actualizado
- [ ] Branch mergeada a main

## Publish
- [ ] `npm pack --dry-run` — verificar archivos incluidos
- [ ] `npm publish --access public`

## Post-publish
- [ ] `npx forge@latest init` en proyecto de prueba
- [ ] `forge doctor` sin errores críticos
- [ ] Tag git: `git tag v4.3.0 && git push --tags`

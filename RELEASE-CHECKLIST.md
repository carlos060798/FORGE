# Checklist de release FORGE

## Pre-publish
- [ ] `npm run build` — sin errores TypeScript
- [ ] `npm test` — 907/907 pasando
- [ ] Versión en package.json, plugin.json y README coinciden
- [ ] CHANGELOG.md actualizado
- [ ] Branch mergeada a main

## Publish
- [ ] `npm pack --dry-run` — verificar archivos incluidos
- [ ] `npm publish --access public`

## Post-publish
- [ ] `npx forge@latest init` en proyecto de prueba
- [ ] `forge doctor` sin errores críticos
- [ ] Tag git: `git tag v4.0.0 && git push --tags`

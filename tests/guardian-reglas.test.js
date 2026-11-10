// @ts-check
/**
 * Spec 2026-11-06-guardian-endurecido: CA-001-01 a CA-001-04
 * Reglas del guardián como módulo puro (core/evidencia/guardian-reglas.js): el comando se trocea en argv
 * en vez de compararse con regex, así que el orden de las banderas, `;`, `&&`, `$(…)` y `bash -c` no lo esquivan.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { segmentar, evaluarComando, esRutaCriticaDelGuardian, esSecreto, escribeAlgo } from "../core/evidencia/guardian-reglas.js";

import { esConfiguracionProtegida } from "../core/evidencia/protegidos.js";

const OPC = { protegidaConfig: esConfiguracionProtegida };
const bloquea = (c) => assert.notEqual(evaluarComando(c, OPC), null, `debía bloquear: ${c}`);
const permite = (c) => assert.equal(evaluarComando(c, OPC), null, `debía permitir: ${c} → ${JSON.stringify(evaluarComando(c, OPC))}`);

describe("guardián — segmentar", () => {
  test("separa por ; && || | y saltos de línea, respetando comillas", () => {
    assert.deepEqual(segmentar("a b; c && d || e | f\ng").map((s) => s.argv[0]), ["a", "c", "d", "e", "f", "g"]);
    assert.deepEqual(segmentar("echo 'a; b' \"c && d\"").map((s) => s.argv), [["echo", "a; b", "c && d"]]);
  });
  test("sustituciones $(…) y `…` son comandos aparte", () => {
    const verbos = segmentar("echo $(rm -rf /) y `git push -f`").map((s) => s.argv[0]);
    assert.ok(verbos.includes("rm") && verbos.includes("git"));
  });
  test("recoge los destinos de redirección, pegados o separados", () => {
    assert.deepEqual(segmentar("echo x > .env").flatMap((s) => s.redirs), [".env"]);
    assert.deepEqual(segmentar("echo x >>.env 2>&1").flatMap((s) => s.redirs), [".env"]);
    assert.deepEqual(segmentar("echo x 2>/dev/null").flatMap((s) => s.redirs), ["/dev/null"]);
  });
  test("entrada hostil no lanza", () => {
    for (const x of ["", "'sin cerrar", "\"sin cerrar", "$(((", "`".repeat(50), "a".repeat(100000)]) segmentar(x);
  });
});

describe("guardián — borrado y git destructivo", () => {
  test("rm recursivo sobre objetivos peligrosos, en cualquier forma de las banderas", () => {
    for (const c of ["rm -rf /", "rm -r -f /", "rm -fr /", "rm -Rf ~", "rm --recursive --force ~", "rm -rf *", "rm -rf ./", "rm -rf .", "rm -rf ..",
      "sudo rm -rf /", "echo ok; rm -r -f /", "true && rm -rf $HOME", "bash -c 'rm -rf /'", "rm -rf /etc/x", "rm -rf 'C:\\'"]) bloquea(c);
  });
  test("rm legítimo sigue permitido", () => {
    for (const c of ["rm -rf node_modules", "rm -rf dist build", "rm archivo.txt", "rm -f /tmp/x.log", "rm -rf ./dist"]) permite(c);
  });
  test("find -delete sin filtros", () => {
    bloquea("find . -delete");
    permite("find . -name '*.tmp' -delete");
  });
  test("PowerShell: Remove-Item recursivo sobre la raíz, con el orden de parámetros que sea", () => {
    for (const c of ["Remove-Item -Force -Recurse C:\\", "Remove-Item -Recurse -Force C:\\", "Remove-Item C:\\ -Recurse", "ri -r -fo C:\\", "rd /s /q C:\\"]) bloquea(c);
    permite("Remove-Item -Recurse -Force .\\dist");
  });
  test("git push forzado en todas sus formas", () => {
    for (const c of ["git push --force origin main", "git push -f", "git push origin +main", "git -c x=y push --force origin main", "git -C . push -f",
      "git push -fu origin main", "git push origin :rama", "git push --delete origin rama", "git push --mirror", "git push origin main # git push"]) {
      if (c.includes("# git push")) { permite(c); continue; }
      bloquea(c);
    }
    permite("git push origin rama");
    permite("git push --force-with-lease origin rama");
  });
  test("git local irreversible", () => {
    for (const c of ["git reset --hard", "git -c a=b reset --hard HEAD~2", "git clean -fd", "git clean -f -d", "git reflog expire --all", "git gc --prune=now"]) bloquea(c);
    permite("git status"); permite("git log --oneline"); permite("git reset --soft HEAD~1");
  });
});

describe("guardián — escritura sobre lo protegido por shell", () => {
  test(".env y configuración de calidad", () => {
    for (const c of ["echo X > .env", "echo X >> .env.local", "sed -i s/a/b/ .env", "sed --in-place s/a/b/ .env", "tee .env", "cp malo .env", "mv x .env",
      "node -e \"require('fs').writeFileSync('.env','X')\"", "python -c \"open('.env','w').write('x')\"", "echo {} > tsconfig.json", "echo x > src/TSCONF~1.JSO",
      "Set-Content -Path .env -Value x", "Out-File .env", "printf x | tee tsconfig.json", "dd if=/dev/zero of=.env"]) bloquea(c);
  });
  test("lo que no es protegido se escribe con normalidad", () => {
    for (const c of ["echo X > .env.example", "echo hola > notas.txt", "sed -i s/a/b/ src/a.js", "cp a.js b.js", "node -e \"console.log(1)\"", "echo ok 2>/dev/null"]) permite(c);
  });
  test("el propio guardián y su registro", () => {
    for (const c of ["echo {} > .claude/settings.json", "cp x claude-hooks/pre-tool-guard.js", "sed -i s/exit/x/ .claude/hooks/pre-tool-guard.js",
      "echo '{\"nivel\":\"confirmado\"}' > .sdd/execution-level.json", "rm .claude/settings.json"]) bloquea(c);
  });
  test("lectura de secretos", () => {
    for (const c of ["cat .env", "type .env.local", "Get-Content .env", "grep KEY .env", "head -1 .env.production"]) bloquea(c);
    for (const c of ["cat .env.example", "cat README.md", "git log"]) permite(c);
  });
  test("la clave HMAC del estado de usuario", () => {
    bloquea("cat ~/.fragua/integraciones/abc/clave");
    bloquea("type C:\\Users\\u\\AppData\\Local\\fragua\\integraciones\\abc\\clave");
  });
});

describe("guardián — rutas y secretos", () => {
  test("rutas críticas del guardián", () => {
    for (const r of [".claude/settings.json", ".claude/settings.local.json", ".claude/hooks/x.js", "claude-hooks/pre-tool-guard.js", "claude-hooks/shared/config.js",
      ".sdd/execution-level.json", ".sdd/aprobaciones.jsonl", ".SDD/Aprobaciones.JSONL", ".git/config", "./.CLAUDE/Settings.json", ".claude\\settings.json", "claude-hooks.", ".git/hooks/pre-commit"]) assert.equal(esRutaCriticaDelGuardian(r), true, r);
    for (const r of ["src/a.js", ".claude/agents/x.md", ".github/workflows/ci.yml", ".sdd/estado.json", ".sdd/aprobaciones.md", "docs/claude-hooks.md"]) assert.equal(esRutaCriticaDelGuardian(r), false, r);
  });
  test("esSecreto", () => {
    for (const r of [".env", "a/.env.local", ".ENV", ".env.production", ".env."]) assert.equal(esSecreto(r), true, r);
    for (const r of [".env.example", ".env.template", ".env.sample", "env.js", "src/.envrc.md"]) assert.equal(esSecreto(r), false, r);
  });
  test("escribeAlgo (para agentes de solo lectura)", () => {
    for (const c of ["echo x > a.js", "printf x > src/a.js", "tee a.txt", "sed -i s/a/b/ a", "cp a b", "mv a b", "rm a", "git commit -m x", "touch a", "node -e \"require('fs').writeFileSync('a','b')\""]) assert.equal(escribeAlgo(c), true, c);
    for (const c of ["ls -la", "cat a.js", "grep x a", "git log", "git diff", "echo x 2>/dev/null", "node --version"]) assert.equal(escribeAlgo(c), false, c);
  });
});

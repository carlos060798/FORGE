# Spike adicional: cadena de hashes con `node:crypto` y la clave local (soporta F5/F6)

> Experimento ejecutado (2026-10-17) fuera del repositorio: script en el directorio temporal de la sesión, `FORGE_HOME` apuntando a una carpeta temporal, importando `core/estado-usuario.js` tal cual. Sin Docker.

## Piezas ya existentes (no hay que escribir criptografía)

- `canonico(v)`: JSON con claves ordenadas, `undefined` omitido (`core/estado-usuario.js:304-311`). Verificado: el mismo valor con otro orden de claves da el mismo `sha256`; `NaN` pasa a `null`.
- `claveLocal(dir)`: 32 bytes en `<estado>/integraciones/<hash-proyecto>/clave`, modo 0600, creada con `link` atómico, **fuera del árbol del proyecto** (`:413-442`); `rutaDeEstado` rechaza una raíz dentro del proyecto (`:368-382`).
- `firmar` / `firmaValida`: HMAC-SHA256 sobre `canonico`, comparación con `timingSafeEqual` (`:445-454`).
- Escritura: `crearArchivo` exclusivo de `core/escritura-segura.js`, como `verificar/registro.js:31`.

## Diseño comprobado

Cada informe lleva `anterior` (sha256 del informe previo o `null`), `sha256` = SHA-256 de `canonico(informe sin sha256 ni firma)`, y opcional `firma` = HMAC de `canonico(informe sin firma, con sha256)`.

| Ataque | Resultado del experimento |
|---|---|
| alterar un campo de un informe intermedio | detectado (`sha256` no coincide) |
| borrar un informe intermedio | detectado (`anterior` no encaja) |
| reordenar | detectado |
| **truncar los últimos informes** | **NO detectado** (la cadena restante es válida). Es el límite de CA-005-04; solo lo cubre un ancla externa (imprimir/guardar la cabeza). |
| rehacer toda la cadena con otros datos y recalcular hashes (quien tiene el repo) | solo con `sha256` es indetectable; **con `firma` se detecta** (falla en el primer informe) porque no tiene la clave |
| rehacer y **quitar las firmas** | pasa como «íntegra» si el comprobador no exige firma → **regla: si existe clave local del proyecto, o si algún informe está firmado, todo informe sin firma es error**; «sin firma» solo se acepta en máquinas sin clave, y el resultado se llama «encadenado, no firmado» |

## Decisiones que cambian el diseño

1. **Firmar siempre que haya clave local** (no «opcional P2»): crear la clave es gratis (`claveLocal` la crea con `O_EXCL`), y sin firma la cadena no resiste a quien tiene el repositorio. El «opcional» queda en que **no se crea la clave** al solo leer o comprobar (`existeEstado` antes, como hace `diario.tope()`, `core/ciclo/diario.js:200-203`).
2. La firma es **HMAC con clave simétrica local**: solo verifica quien tiene esa clave (la misma máquina/usuario). No sirve a un tercero (un auditor); para eso haría falta firma asimétrica (`crypto.sign` con Ed25519, también `node:crypto`) con clave privada en el estado del usuario y la pública publicable. Recomendación: v1 HMAC (reutiliza lo ya revisado, H1/H3); Ed25519 solo si la spec exige verificación por terceros, y entonces la clave pública debe ir en el informe y anclada fuera.
3. Una cadena **por proyecto** en `.sdd/verificaciones/` (suposición #3 del plan) es compatible; el comprobador recorre por `anterior`, no por nombre de archivo ni por fecha. Para saber cuál es la «cabeza» sin depender de nombres hay que decidirlo: guardar `cabeza` firmada en el estado del usuario (junto a la clave) en cada informe nuevo: **eso sí detecta truncado local** (el archivo de cabeza lo controla el usuario, no el repo). Coste: un archivo pequeño; recomendado, es la mejora de mayor valor por menor esfuerzo.
4. El `sha256` y la firma cubren el informe **ya redactado**; la redacción debe ocurrir antes de hashear (no después), o dos máquinas con otra redacción darán hashes distintos.
5. Carrera: dos `verificar --registrar` simultáneos eligen el mismo `anterior`. Hay que tomar el candado del proyecto (`ciclo/candado.js`) al leer la cabeza y escribir, o la cadena se bifurca (comprobador debe tratar la bifurcación como error, no como dos válidas).

## Qué cambia en la spec o el plan

- Plan §3/F6: `cadena.js` reutiliza `canonico`/`firmar`/`firmaValida` de `core/estado-usuario.js`; no hay primitivas nuevas. F6.3 deja de ser «opcional»: firma por defecto si hay clave. Nuevo CA: cadena firmada rechaza informes sin firma.
- CA-005-04 se redacta con exactitud: «no detecta el truncado de los últimos informes sin la cabeza guardada del lado del usuario».
- Riesgo: la clave vive en el perfil del usuario; en CI sin perfil persistente la cadena queda sin clave (se avisa «encadenado, no firmado»).

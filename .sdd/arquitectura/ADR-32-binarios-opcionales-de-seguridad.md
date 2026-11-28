# ADR-32: Binarios opcionales de seguridad

> Estado: propuesta  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-27
> Spec relacionada: 2026-11-27-componente-seguridad
> Autor: Claude (pendiente de aceptación por el dueño)
> Evidencia: informe «Skills agnósticas git y DevOps» y plan consolidado §4.4-4.6, que citan la documentación de cada herramienta. Ninguna se ha ejecutado aquí. Versiones a fijar: sin decidir.

## Contexto

El Principio IV de la constitución (dependencias mínimas, `.sdd/memoria/constitucion.md:67`) exige un ADR por dependencia nueva. La puerta `seguridad` necesita herramientas externas. El incidente de Trivy en 2026 (tags de `trivy-action` reetiquetados con código malicioso, CVE-2026-33634, citado en el informe) muestra que el escáner puede ser el vector.

## Decisión

Reglas comunes a todo binario de seguridad:
1. **Opcional y perezoso**: se detecta en ejecución (presencia y versión); nunca es requisito de instalación.
2. **Nunca se instala en silencio**: ni descarga ni actualización automática. `doctor` puede indicar cómo instalarlo; lo hace el usuario.
3. **Ausente = `not_evaluable`** (código 6, ADR-30), visible en el informe con el nombre de la herramienta y este ADR.
4. **Versión fijada y verificada** como cualquier dependencia; una versión distinta de la permitida = `not_evaluable` [NV: mecanismo de verificación por decidir].
5. **Sin red** en ejecución; los códigos nativos se traducen según ADR-30.
6. **Una decisión por binario.** Cada una puede aceptarse o rechazarse por separado.

### Decisión 32.1: escáner de secretos — gitleaks (propuesta)
- Modo `git`/`dir`, con `--redact` y un `--exit-code` dedicado (fuga→1, error→8).
- Riesgo: el proyecto se declaró «feature complete» en 2026 y su autor trabaja en Betterleaks (en evaluación, no se adopta) [NV].
- TruffleHog queda excluido por defecto: su verificación prueba credenciales contra servicios externos (usa red).

### Decisión 32.2: escáner de dependencias sin red — osv-scanner `--offline` (propuesta)
- `--offline` no descarga ni envía datos según su documentación [NV: no probado]. 0→0, 1→1, 128→6, errores→8.
- Pendiente: cómo llega la base local al contenedor sin red sin actualizarla en silencio [NV].

### Candidatos posteriores (no decididos; cada uno con su propia decisión 32.N)
- **semgrep** (SAST): en cola, sugerido desde `mvp` (plan §4.5). Licencia y reglas por revisar [NV].
- **syft** (SBOM): genera SBOM sin conexión por defecto según el informe [NV]. En cola.
- **SkillSpector (NVIDIA)**: escáner de skills, no de código. **Pendiente de que el dueño confirme que es la herramienta que mencionó.** No se integra nada hasta entonces. Si se confirma: externa, opcional, un SAFE nunca equivale a confianza, y lista de skills permitidas con hash fijado (plan §4.6).

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Empaquetar los binarios con Fragua | Dependencias pesadas y cadena de suministro propia |
| Instalarlos al vuelo | Instalación silenciosa y red en ejecución |
| Un solo ADR para todas | Impide aceptar o rechazar cada herramienta por separado |
| TruffleHog | Verifica contra servicios externos |

## Consecuencias

### Positivas
- La puerta `seguridad` tiene contenido sin dependencias obligatorias.

### Negativas
- Sin los binarios, la puerta queda en `not_evaluable`; en `producto` eso bloquea.

### Neutrales
- Cada candidato posterior se decide en su momento.

## Cuándo revisitar

- Cambio de mantenimiento o licencia de gitleaks u osv-scanner.
- Confirmación del dueño sobre SkillSpector.
- Apertura de SAST/SBOM tras los pilotos.

## Referencias

- Informe «Skills agnósticas git y DevOps» (cadena de suministro, códigos de salida).
- Plan consolidado §4.1 punto 5, §4.4, §4.5, §4.6, §7 decisión 15.
- ADR-29, ADR-30.

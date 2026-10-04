# ADR-03: Dependencias en una imagen preparada, ejecución sin red

> Estado: propuesta  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-03
> Spec relacionada: 2026-10-03-ciclo-verificado
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

Los documentos de partida piden a la vez un contenedor sin red y que el código "incluya sus dependencias". Con una imagen base mínima y sin red, no se puede instalar ni el ejecutor de pruebas. CA-003-01 exige ausencia de red; CA-003-09 exige que las dependencias declaradas estén disponibles.

## Decisión

Dos fases separadas:

1. **Preparar** (con red, sin código generado): se construye una imagen `forge-sbx:<huella de manifiesto y lockfile>` que instala solo a partir de los manifiestos del proyecto, con los scripts de instalación desactivados donde el gestor lo permita. Se cachea por huella.
2. **Ejecutar** (sin red): el código generado corre sobre esa imagen.

Si el implementador propone cambiar un manifiesto de dependencias, el cambio no se aplica y el ciclo pasa a revisión humana con motivo `dependencias` (CA-008-05). La imagen base se elige por stack (`core/stack-detector.js`) y se fija por digest en la configuración.

## Alternativas consideradas

- **A. Red abierta durante la ejecución**: rechazada porque el código generado podría exfiltrar datos o descargar cualquier cosa.
- **B. Proxy con lista de registros permitidos**: rechazada por complejidad para una primera entrega; sigue dando red al código generado.
- **C. Copiar `node_modules` o equivalente del anfitrión**: rechazada porque los binarios nativos dependen de la plataforma y puede arrastrar secretos.
- **D. Imagen preparada por huella**: aceptada porque separa "instalar lo declarado" de "ejecutar lo generado".

## Consecuencias

### Positivas
- El código generado nunca tiene red.
- La preparación se paga una vez por cada cambio de manifiesto.

### Negativas
- La primera ejecución de un proyecto es lenta (construcción de imagen).
- Las imágenes ocupan disco; hace falta una política de limpieza.
- Desactivar scripts de instalación puede romper paquetes que los necesitan.

### Neutrales
- Un paquete declarado malicioso sigue siendo un riesgo de la fase de preparación; se mitiga con la revisión humana de los cambios de manifiesto.

## Cuándo revisitar

- Si aparecen proyectos cuyas dependencias no se instalan sin scripts.
- Si la primera entrega amplía los lenguajes cubiertos.

## Referencias

- `core/stack-detector.js:25` (`test_cmd`, `install_cmd`)
- `../doc/04_setup_and_dependencies.md` (`python:3.11-slim`, sin red)

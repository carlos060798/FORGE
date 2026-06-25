---
description: Guía completa del plugin SDD-ES con todos los comandos, flujos, agentes y referencias de personalización.
allowed-tools: Read
---

# /sdd.ayuda — Guía Completa

Muestra esta guía formateada:

```
╔══════════════════════════════════════════════════════════════════════╗
║              SDD-ES — Desarrollo Guiado por Especificaciones          ║
║                    Plugin para Claude Code | v2.0.0                   ║
║                                                                       ║
║   Inspirado en github/spec-kit y LiorCohen/sdd. En español.           ║
║   Agnóstico al stack. Completamente personalizable.                   ║
╚══════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════
  📚 COMANDOS DISPONIBLES
═══════════════════════════════════════════════════════════════════════

🏗️  INICIALIZACIÓN
   /sdd                              Hub central — entiende lenguaje natural
   /sdd.descubrir [idea]             Extrae contexto mínimo de una idea vaga — punto de entrada para proyectos nuevos
   /sdd.constitucion                 Establece principios del proyecto
   /sdd.configurar                   Ajusta agentes y modelos
   /sdd.configurar preset:lean       Configuración para proyectos personales y prototipos
   /sdd.configurar preset:startup    Configuración para equipos pequeños
   /sdd.configurar preset:enterprise Configuración para productos críticos con compliance
   /sdd.ayuda                        Esta guía

📝 ESPECIFICACIÓN
   /sdd.especificar [descripción]    Capturar requisitos en formato SDD-ES
   /sdd.importar [fuente]            Importar spec externa (URL, archivo)
   /sdd.aclarar                      Resolver [NECESITA_ACLARACION]
   /sdd.checklist                    Validar calidad formal de la spec

🛠️  PLANIFICACIÓN E IMPLEMENTACIÓN
   /sdd.planificar                   Generar plan técnico
   /sdd.planificar aprobar           Aprobar el plan
   /sdd.tareas                       Desglosar en tareas atómicas
   /sdd.analizar                     Auditoría de consistencia (RECOMENDADO)
   /sdd.implementar                  Ejecutar todas las tareas
   /sdd.implementar T003             Ejecutar tarea específica
   /sdd.implementar continuar        Retomar desde última tarea incompleta
   /sdd.qa                           QA en navegador real desde los criterios de aceptación
   /sdd.verificar                    Verificación final contra spec

🚀 DESPLIEGUE
   /sdd.desplegar                    Publicar con verificación previa + health check
   /sdd.canary                       Vigilar el servicio recién desplegado
   /sdd.retro                        Retrospectiva: capturar aprendizajes del ciclo

🗺️  PRODUCTO Y DOMINIO
   /sdd.snapshot                     Actualizar SNAPSHOT.md del producto
   /sdd.glosario                     Gestionar términos del dominio
   /sdd.estado                       Dashboard de progreso
   /sdd.release                      Versión semántica + CHANGELOG desde specs completadas
   /sdd.release patch|minor|major    Forzar tipo de versión manualmente
   /sdd.release --preview            Ver qué entraría sin modificar nada

🏭 FÁBRICA (idea → producto instalable)
   /sdd.interpretar [idea]           Interpretar idea en bruto y generar IR (Interpreted Requirement)
   /sdd.diseñar                      Elegir dirección visual y generar ProductDesign
   /sdd.construir                    Pipeline completo automático: diseño + código + deploy
   /sdd.exportar                     Empaquetar el proyecto actual como bundle descargable
   /sdd.crear-app [idea]             Generar app web o CLI desde una descripción en lenguaje natural
   /sdd.crear-mcp [descripción]      Generar servidor MCP empaquetado (.mcpb) desde una descripción
   /sdd.crear-agente                 Wizard interactivo para crear un agente SDD-ES personalizado

🏛️  CALIDAD Y COMPLIANCE
   /sdd.compliance                   Reporte de cumplimiento regulatorio (GDPR, SOC2, ISO 27001, HIPAA)
   /sdd.adr                          Registrar decisión de arquitectura (Architecture Decision Record)
   /sdd.defect-report                Reporte de defectos y tasa de bugs del proyecto

⚙️  UTILIDADES
   /sdd.modo [normal|rapido|prototipo]  Cambiar modo de sesión (normal=completo, rapido=sin crítico, prototipo=sin revisores)
   /sdd.mapear                       Indexar estructura, símbolos y dependencias del proyecto
   /sdd.comprimir                    Comprimir archivos de memoria para ahorrar tokens
   /sdd.optimizar                    Optimizar artefactos SDD para reducir uso de contexto
   /sdd.optimizar-memoria            Compactar la memoria del agente activo

═══════════════════════════════════════════════════════════════════════
  🔄 FLUJOS RECOMENDADOS
═══════════════════════════════════════════════════════════════════════

FLUJO DESDE CERO (idea vaga, proyecto nuevo, sin nada definido)
   /sdd.descubrir [idea]         → genera contexto base con preguntas mínimas
   /sdd.constitucion             → principios y restricciones del proyecto
   /sdd.especificar              → usa el contexto para generar la spec
   /sdd.planificar → /sdd.tareas → /sdd.implementar

FLUJO MÍNIMO (cambios micro, <10 líneas, ≤3 archivos)
   /sdd.especificar [descripción]
   → Detecta tamaño Micro y ejecuta automáticamente:
     spec + plan + tareas + implementar

FLUJO ESTÁNDAR (features normales)
   /sdd.constitucion              (solo la primera vez)
   /sdd.especificar [descripción]
   /sdd.planificar
   /sdd.planificar aprobar
   /sdd.tareas
   /sdd.implementar

FLUJO CALIDAD MÁXIMA (features grandes, producto enterprise)
   /sdd.constitucion
   /sdd.especificar [descripción]
   /sdd.aclarar
   /sdd.checklist
   /sdd.planificar
   /sdd.planificar aprobar
   /sdd.tareas
   /sdd.analizar
   /sdd.implementar
   /sdd.verificar
   /sdd.snapshot

═══════════════════════════════════════════════════════════════════════
  🤖 AGENTES ESPECIALIZADOS
═══════════════════════════════════════════════════════════════════════

DISEÑO Y ARQUITECTURA
   arquitecto             Decisiones técnicas, diseño de alto nivel
   product-designer       Diseño de producto: pantallas, user flow, MVP
   architecture-designer  Stack técnico: frontend, backend, BD, deploy
   disenador-api          Contratos: OpenAPI, GraphQL, gRPC, eventos
   asesor-datos           Esquemas, queries, índices, migraciones

IMPLEMENTACIÓN
   desarrollador-backend  Lógica servidor: servicios, APIs, datos
   desarrollador-frontend UI: componentes, vistas, estado cliente
   operaciones            CI/CD, deploys, infraestructura

CALIDAD
   tester                 Tests unitarios, integración, E2E
   revisor                Revisión contra spec/calidad/constitución
   critico                Riesgos y puntos ciegos
   seguridad              Auditoría de vulnerabilidades
   documentador           Docs técnicas útiles

CONTEXTO
   investigador           Stack, patrones, deuda técnica — se activa en /sdd.descubrir y /sdd.especificar

Cada agente tiene un modelo asignado en .sdd/sdd.config.yaml.
Usa /sdd.configurar para cambiar qué agentes están activos y qué modelo usan.

═══════════════════════════════════════════════════════════════════════
  📁 ESTRUCTURA GENERADA EN TU PROYECTO
═══════════════════════════════════════════════════════════════════════

   .sdd/
   ├── sdd.config.yaml           ← Configuración personalizable
   ├── estado.json               ← Estado global del flujo
   ├── INDICE.md                 ← Registro de todas las specs
   ├── SNAPSHOT.md               ← Estado actual del producto
   ├── memoria/
   │   └── constitucion.md       ← Principios del proyecto
   ├── dominio/
   │   ├── glosario.md           ← Términos del dominio
   │   └── definiciones/         ← Definiciones extendidas
   ├── arquitectura/
   │   └── *.md                  ← ADRs (decisiones de arquitectura)
   ├── cambios/
   │   └── YYYY/MM/DD/...        ← Registro cronológico de cambios
   ├── hooks/
   │   ├── antes_*.sh            ← Hooks personalizables
   │   └── despues_*.sh
   └── especificaciones/
       └── {ID}/
           ├── spec.md           ← Especificación
           ├── plan.md           ← Plan técnico
           ├── tareas.md         ← Tareas atómicas
           ├── checklist-spec.md ← Resultado del checklist
           ├── analisis.md       ← Auditoría de consistencia
           ├── verificacion.md   ← Verificación final
           └── .estado-tareas.json

═══════════════════════════════════════════════════════════════════════
  🎨 PERSONALIZACIÓN
═══════════════════════════════════════════════════════════════════════

TODO el plugin es texto Markdown. Personalizar cualquier cosa requiere
solo editar archivos:

1. Templates de spec/plan/tareas      → plantillas/*.md
2. Comportamiento de comandos          → commands/*.md
3. Personalidad y reglas de agentes    → agents/*.md
4. Agentes activos y modelos           → .sdd/sdd.config.yaml
5. Hooks pre/post fase                 → .sdd/hooks/*.sh
6. Permisos y protecciones             → .sdd/sdd.config.yaml

Ver detalles en: docs/configuration.md

═══════════════════════════════════════════════════════════════════════
  🔌 HOOKS PERSONALIZABLES
═══════════════════════════════════════════════════════════════════════

Crea scripts ejecutables en .sdd/hooks/ para integrar tu propio flujo:

   antes_constitucion.sh      despues_constitucion.sh
   antes_especificar.sh       despues_especificar.sh
   antes_aclarar.sh           despues_aclarar.sh
   antes_planificar.sh        despues_planificar.sh
   antes_tareas.sh            despues_tareas.sh
   antes_analizar.sh          despues_analizar.sh
   antes_implementar.sh       despues_implementar.sh
   antes_cada_tarea.sh        despues_cada_tarea.sh   ← por tarea
   antes_verificar.sh         despues_verificar.sh
   antes_importar.sh

Casos de uso típicos:
   • Aplicar linter después de implementar
   • Crear branch de Git antes de empezar una spec (si lo deseas)
   • Subir reporte a Slack/Teams al verificar
   • Generar PR de GitLab/GitHub manualmente con tus credenciales
   • Notificar al equipo cuando se aprueba un plan

⚠️  IMPORTANTE: SDD-ES NO se acopla a Git/GitHub/GitLab.
   Si quieres integrar tu sistema de control de versiones,
   hazlo desde hooks personalizados.

═══════════════════════════════════════════════════════════════════════
  📖 DOCUMENTACIÓN ADICIONAL
═══════════════════════════════════════════════════════════════════════

   docs/introduction.md       Introducción al proyecto
   docs/core-concepts.md      Qué es SDD y por qué funciona
   docs/workflows.md          Flujos de trabajo completos
   docs/agents.md             Cuándo usar cada agente
   docs/configuration.md      Configuración de agentes y modelos
   docs/examples.md           Ejemplos completos de uso
   docs/FABRICA.md            Recorrido idea→deploy para no-programadores

═══════════════════════════════════════════════════════════════════════

¿Tienes una duda específica? Pregunta en lenguaje natural:
   "¿Cómo cambio el modelo del agente revisor?"
   "¿Qué hace el comando /sdd.analizar?"
   "¿Cómo desactivo el agente frontend?"
```

---
name: Propuesta de agente
about: Proponer un nuevo agente especializado para FORGE
title: "[AGENTE] "
labels: enhancement, agent
assignees: ''
---

## Nombre del agente propuesto

<!-- Ej: `auditor-accesibilidad` -->

## Problema que resuelve

<!-- ¿Qué tarea actual es difícil, lenta o propensa a errores sin este agente? -->

## Rol y responsabilidades

<!-- ¿Qué hace este agente específicamente? ¿Cuándo se invoca? -->

## Diferencia con agentes existentes

<!-- Explica por qué no basta con los 14 agentes actuales (arquitecto, tester, revisor, seguridad...) -->

## Herramientas necesarias

<!-- ¿Qué tools de Claude Code necesita? ej: Read, Bash, Write -->
- [ ] Read
- [ ] Write
- [ ] Edit
- [ ] Bash
- [ ] Task (sub-agentes)
- [ ] Otra: 

## ¿Es de solo lectura?

<!-- Los agentes de solo lectura (como arquitecto, crítico) no modifican archivos. -->
- [ ] Sí — solo analiza y reporta
- [ ] No — necesita escribir/modificar archivos

## Ejemplo de uso

```
/sdd.implementar → el agente auditor-accesibilidad revisa los componentes generados
                   y reporta violaciones WCAG 2.1 antes de hacer commit
```

## Mockup del output esperado

```
<!-- Cómo se vería el output del agente en la terminal -->
```

## ¿Estarías dispuesto/a a implementarlo?

- [ ] Sí, abriría un PR
- [ ] No, pero puedo ayudar a definir los criterios
- [ ] Solo propuesta — que alguien más lo implemente

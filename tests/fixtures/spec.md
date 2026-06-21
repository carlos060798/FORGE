---
id: spec-fixture-test-001
titulo: "API REST de Gestión de Tareas con JWT"
tamano: mediano
estado: aprobada
creada: 2026-06-21
actualizada: 2026-06-21
autor: forge-test
etiquetas: [api, rest, jwt, tareas, crud]
---

# Especificación: Task Manager API

## 1. Contexto y Motivación

Necesito una API REST para gestionar tareas personales con autenticación segura.

## 2. Objetivo

Construir una API REST con Node.js que permita a usuarios registrados crear, leer, actualizar y eliminar sus tareas.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Usuario registrado | Usuario con cuenta activa | Gestionar sus tareas via API |

## 4. Historias de Usuario

### HU-001: Autenticación

**Como** usuario  
**Quiero** registrarme y hacer login  
**Para** acceder a mis tareas de forma segura

**Criterios de aceptación:**
- [ ] **CA-001-01**: POST /auth/register crea usuario y retorna JWT (P1)
- [ ] **CA-001-02**: POST /auth/login valida credenciales y retorna JWT (P1)

### HU-002: CRUD de Tareas

**Como** usuario autenticado  
**Quiero** crear, leer, actualizar y eliminar tareas  
**Para** gestionar mi trabajo

**Criterios de aceptación:**
- [ ] **CA-002-01**: GET /tasks retorna lista paginada de tareas del usuario (P1)
- [ ] **CA-002-02**: POST /tasks crea una tarea nueva (P1)
- [ ] **CA-002-03**: PUT /tasks/:id actualiza una tarea (P1)
- [ ] **CA-002-04**: DELETE /tasks/:id elimina una tarea (P1)

## 5. Escenarios de Uso

### Escenario 1: Registro y primera tarea

**Dado** que un nuevo usuario llama POST /auth/register  
**Cuando** las credenciales son válidas  
**Entonces** recibe un JWT y puede llamar POST /tasks inmediatamente

## 6. Requisitos Funcionales

- **RF-001**: DEBE existir endpoint de registro y login
- **RF-002**: DEBE existir CRUD de tareas protegido por JWT
- **RF-003**: Las tareas DEBEN estar aisladas por usuario

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Seguridad | JWT con expiración de 24h | Verificable en el token |
| Rendimiento | Respuesta < 200ms en operaciones CRUD | Medible con k6 |

## 8. Fuera de Alcance

- ❌ Colaboración entre usuarios
- ❌ Notificaciones push
- ❌ App móvil

## 9. Preguntas Abiertas

Ninguna.

## 10. Criterios de Éxito Medibles

- Todos los endpoints responden correctamente a peticiones autenticadas
- Los tests de la API pasan con `npm test`

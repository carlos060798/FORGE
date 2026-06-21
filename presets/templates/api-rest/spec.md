---
id: template-api-rest
titulo: "API REST con autenticación JWT y CRUD"
tamano: mediano
estado: borrador
creada: TEMPLATE
actualizada: TEMPLATE
autor: forge-template
etiquetas: [api, rest, jwt, crud, nodejs]
---

# Especificación: API REST con autenticación JWT y CRUD

## 1. Contexto y Motivación

Necesito una API REST que permita a clientes externos (frontend, app móvil, integraciones) acceder a mis datos y lógica de negocio de forma segura. La API debe tener autenticación por token JWT, operaciones CRUD sobre el recurso principal, validación robusta, y manejo de errores predecible.

## 2. Objetivo

Construir una API REST en Node.js con Express que exponga endpoints de autenticación (registro, login) y operaciones CRUD completas sobre el recurso principal, retornando respuestas JSON con códigos HTTP correctos en todos los casos.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Usuario autenticado | Persona con cuenta en el sistema | Acceder a sus datos y modificarlos |
| Cliente sin autenticar | App o script sin token | Registrarse o hacer login |
| Administrador | Usuario con permisos elevados | Gestionar todos los recursos |

## 4. Historias de Usuario

### HU-001: Registro y login

**Como** cliente de la API  
**Quiero** poder registrarme con email y contraseña y obtener un token JWT  
**Para** autenticarme en las rutas protegidas

**Criterios de aceptación:**
- [ ] **CA-001-01**: `POST /auth/register` con email y contraseña válidos retorna `201` y un token JWT (P1)
- [ ] **CA-001-02**: `POST /auth/login` con credenciales correctas retorna `200` y un token JWT (P1)
- [ ] **CA-001-03**: Email duplicado en registro retorna `409 Conflict` con mensaje claro (P1)
- [ ] **CA-001-04**: Credenciales incorrectas en login retorna `401 Unauthorized` (P1)
- [ ] **CA-001-05**: El token JWT expira en 24 horas (P2)

### HU-002: CRUD del recurso principal

**Como** usuario autenticado  
**Quiero** crear, leer, actualizar y eliminar mis recursos via la API  
**Para** gestionar mis datos desde cualquier cliente

**Criterios de aceptación:**
- [ ] **CA-002-01**: `GET /recursos` retorna lista de recursos del usuario autenticado (P1)
- [ ] **CA-002-02**: `POST /recursos` crea un recurso nuevo y retorna `201` con el recurso creado (P1)
- [ ] **CA-002-03**: `GET /recursos/:id` retorna el recurso si pertenece al usuario o `404` si no existe (P1)
- [ ] **CA-002-04**: `PUT /recursos/:id` actualiza el recurso y retorna `200` con el recurso actualizado (P1)
- [ ] **CA-002-05**: `DELETE /recursos/:id` elimina el recurso y retorna `204 No Content` (P1)
- [ ] **CA-002-06**: Acceder a recursos de otro usuario retorna `403 Forbidden` (P1)

### HU-003: Validación y errores

**Como** cliente de la API  
**Quiero** recibir mensajes de error claros y códigos HTTP correctos  
**Para** saber exactamente qué salió mal y cómo corregirlo

**Criterios de aceptación:**
- [ ] **CA-003-01**: Datos de entrada inválidos retornan `400 Bad Request` con lista de campos inválidos (P1)
- [ ] **CA-003-02**: Rutas protegidas sin token retornan `401 Unauthorized` (P1)
- [ ] **CA-003-03**: Errores internos retornan `500` sin exponer detalles del stack trace en producción (P1)
- [ ] **CA-003-04**: Todas las respuestas de error tienen el formato `{"error": "mensaje", "campo": "optional"}` (P2)

## 5. Escenarios de Uso

### Escenario 1: Registro y primer uso

**Dado** que un nuevo cliente quiere usar la API  
**Cuando** hace `POST /auth/register` con email y contraseña  
**Entonces** recibe `201` con un token JWT  
**Y** puede usar ese token en el header `Authorization: Bearer <token>` para acceder a rutas protegidas

### Escenario 2: CRUD completo

**Dado** que el usuario tiene un token válido  
**Cuando** hace `POST /recursos` con los datos del recurso  
**Entonces** recibe `201` con el recurso creado incluyendo su `id`  
**Y** puede hacer `GET /recursos/:id` para leerlo, `PUT` para modificarlo, `DELETE` para eliminarlo

### Escenario 3: Token expirado

**Dado** que el usuario tiene un token de más de 24 horas  
**Cuando** intenta acceder a una ruta protegida  
**Entonces** recibe `401` con el mensaje "Token expirado. Vuelve a hacer login."

## 6. Requisitos Funcionales

- **RF-001**: DEBE existir `POST /auth/register` que crea usuario y retorna JWT
- **RF-002**: DEBE existir `POST /auth/login` que valida credenciales y retorna JWT
- **RF-003**: DEBE existir middleware de autenticación que valida el JWT en rutas protegidas
- **RF-004**: DEBEN existir rutas CRUD: `GET/POST /recursos` y `GET/PUT/DELETE /recursos/:id`
- **RF-005**: Los recursos DEBEN estar aislados por usuario — un usuario no puede ver ni modificar los de otro
- **RF-006**: Las contraseñas DEBEN almacenarse hasheadas con bcrypt (mínimo 10 rounds)
- **RF-007**: DEBEN existir tests unitarios para cada endpoint (mínimo happy path + caso de error)

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Rendimiento | Respuesta de endpoints CRUD en < 200ms | Medible con test de carga básico |
| Seguridad | Contraseñas hasheadas con bcrypt ≥ 10 rounds | Verificable en el código |
| Seguridad | JWT firmado con secret de entorno, no hardcodeado | Verificable en el código |
| Mantenibilidad | Cada ruta en su propio archivo de router | Estructura de carpetas estándar |

## 8. Fuera de Alcance

- ❌ Frontend o UI — solo la API
- ❌ Roles y permisos complejos (solo user/admin básico)
- ❌ OAuth o login con Google/GitHub
- ❌ Envío de emails de verificación
- ❌ Paginación avanzada con cursores

## 9. Dependencias y Asunciones

### Asunciones
- Node.js ≥18 disponible en el entorno de desarrollo
- SQLite como base de datos (archivo local, sin servidor)
- El nombre del "recurso principal" se definirá en el plan técnico

## 10. Términos del Dominio

- **Recurso**: La entidad principal de la API (ej: tareas, productos, notas — se define en el plan)
- **JWT**: JSON Web Token — método de autenticación stateless via token firmado

## 11. Criterios de Éxito Medibles

- Todos los endpoints de autenticación y CRUD funcionan con `curl` o Postman
- Los tests unitarios pasan con `npm test`
- Un token inválido siempre retorna `401`, nunca `500`

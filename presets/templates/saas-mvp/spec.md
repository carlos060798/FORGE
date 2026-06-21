---
id: template-saas-mvp
titulo: "SaaS MVP — Autenticación, dashboard y gestión de recurso principal"
tamano: grande
estado: borrador
creada: TEMPLATE
actualizada: TEMPLATE
autor: forge-template
etiquetas: [saas, mvp, autenticacion, dashboard, crud]
---

# Especificación: SaaS MVP

> **Nota de template:** Este spec usa "Items" como placeholder del recurso principal. Al ejecutar `/forge`, FORGE preguntará qué gestiona tu SaaS y personalizará el spec.

## 1. Contexto y Motivación

Necesito construir un MVP funcional de mi SaaS para validar el modelo de negocio con usuarios reales. El MVP debe incluir lo mínimo para que un usuario pueda registrarse, gestionar el recurso principal del negocio, y tener visibilidad del estado general en un dashboard. La prioridad es velocidad de validación, no perfección técnica.

## 2. Objetivo

Construir un SaaS MVP con autenticación completa, dashboard de resumen, y CRUD del recurso principal, desplegable en producción en menos de una semana de desarrollo activo.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Usuario registrado | Usuario con cuenta activa | Gestionar sus Items y ver el resumen en el dashboard |
| Usuario nuevo | Visitante sin cuenta | Registrarse fácilmente y llegar al dashboard en < 2 min |
| Usuario existente | Usuario retornando | Login rápido y acceso directo al dashboard |

## 4. Historias de Usuario

### HU-001: Registro y onboarding

**Como** usuario nuevo  
**Quiero** registrarme con email y contraseña y llegar directamente a mi dashboard  
**Para** empezar a usar el producto sin fricción

**Criterios de aceptación:**
- [ ] **CA-001-01**: Formulario de registro con email, contraseña y nombre; valida en tiempo real (P1)
- [ ] **CA-001-02**: Registro exitoso → redirección automática al dashboard (P1)
- [ ] **CA-001-03**: Email ya registrado → mensaje claro "Ya tienes cuenta, haz login" (P1)
- [ ] **CA-001-04**: Contraseña débil → indicador de fortaleza en el formulario (P2)

### HU-002: Autenticación y sesión

**Como** usuario registrado  
**Quiero** hacer login y mantener mi sesión activa entre visitas  
**Para** no tener que autenticarme cada vez

**Criterios de aceptación:**
- [ ] **CA-002-01**: Login con email y contraseña correctos → acceso al dashboard (P1)
- [ ] **CA-002-02**: Credenciales incorrectas → mensaje "Email o contraseña incorrectos" sin indicar cuál (P1)
- [ ] **CA-002-03**: La sesión persiste al cerrar el navegador (cookie httpOnly) (P1)
- [ ] **CA-002-04**: `GET /logout` cierra la sesión y redirige al login (P1)

### HU-003: Dashboard de resumen

**Como** usuario autenticado  
**Quiero** ver un resumen de mi actividad al entrar al sistema  
**Para** tener visibilidad inmediata sin navegar por menús

**Criterios de aceptación:**
- [ ] **CA-003-01**: El dashboard muestra el total de Items, los creados esta semana, y los pendientes (P1)
- [ ] **CA-003-02**: El dashboard muestra los últimos 5 Items modificados (P1)
- [ ] **CA-003-03**: Si no hay Items, muestra un mensaje de bienvenida con CTA para crear el primero (P1)
- [ ] **CA-003-04**: El dashboard se carga en < 1 segundo (P2)

### HU-004: CRUD del recurso principal (Items)

**Como** usuario autenticado  
**Quiero** crear, ver, editar y eliminar mis Items  
**Para** gestionar mi negocio desde el SaaS

**Criterios de aceptación:**
- [ ] **CA-004-01**: Formulario de creación con los campos básicos del Item; se añade a la lista al guardar (P1)
- [ ] **CA-004-02**: Lista de Items paginada (10 por página) con búsqueda por nombre (P1)
- [ ] **CA-004-03**: Edición inline o modal del Item con los mismos campos (P1)
- [ ] **CA-004-04**: Eliminación con confirmación modal "¿Seguro? Esta acción no se puede deshacer." (P1)
- [ ] **CA-004-05**: Los Items son privados — un usuario no puede ver los de otro (P1)

### HU-005: Perfil de usuario

**Como** usuario autenticado  
**Quiero** poder cambiar mi nombre y contraseña  
**Para** mantener mi cuenta actualizada

**Criterios de aceptación:**
- [ ] **CA-005-01**: Página de perfil con formulario para cambiar nombre (P1)
- [ ] **CA-005-02**: Formulario para cambiar contraseña con confirmación (contraseña actual + nueva + repetir) (P1)
- [ ] **CA-005-03**: Cambio exitoso muestra toast de confirmación (P2)

## 5. Escenarios de Uso

### Escenario 1: Nuevo usuario hasta primer Item

**Dado** que un nuevo usuario visita el SaaS  
**Cuando** se registra con email y contraseña  
**Entonces** llega al dashboard con el mensaje de bienvenida y el CTA para crear su primer Item  
**Y** crea el Item en < 2 minutos desde la landing

### Escenario 2: Usuario retornando

**Dado** que un usuario ya registrado cierra y vuelve a abrir el navegador  
**Cuando** visita la URL del SaaS  
**Entonces** la sesión persiste y va directamente al dashboard (no al login)

### Escenario 3: Dashboard con datos

**Dado** que un usuario tiene 15 Items (3 de ellos creados esta semana)  
**Cuando** entra al dashboard  
**Entonces** ve "15 Items totales | 3 esta semana" y los últimos 5 modificados  
**Y** puede hacer click en cualquiera para ir directamente a editarlo

## 6. Requisitos Funcionales

- **RF-001**: DEBE existir sistema de autenticación con sesiones (cookies httpOnly, no JWT en localStorage)
- **RF-002**: DEBE existir página de login, registro y logout
- **RF-003**: DEBE existir dashboard con métricas básicas del recurso principal
- **RF-004**: DEBEN existir páginas de lista y detalle/edición del recurso principal
- **RF-005**: El recurso principal DEBE estar aislado por usuario
- **RF-006**: DEBE existir página de perfil con edición de nombre y contraseña
- **RF-007**: DEBEN existir tests para las rutas de autenticación y CRUD

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Rendimiento | Dashboard carga en < 1 segundo | Medible con Lighthouse |
| Seguridad | Cookies httpOnly + SameSite=Strict | Verificable en DevTools |
| Seguridad | CSRF protection en formularios POST | Verificable en el código |
| Usabilidad | Formularios con validación en cliente antes de enviar | Sin round-trips innecesarios |

## 8. Fuera de Alcance

- ❌ Multi-tenancy / organizaciones (un usuario = una cuenta)
- ❌ Planes de pago o suscripciones (Stripe en v2)
- ❌ Notificaciones por email
- ❌ Modo oscuro
- ❌ App móvil

## 9. Preguntas Abiertas

- [ ] **[NECESITA_ACLARACION]**: ¿Cuál es el "recurso principal" de tu SaaS? (tareas, clientes, proyectos, facturas, etc.) — responde esto antes de pasar al plan técnico

## 10. Criterios de Éxito Medibles

- Un nuevo usuario puede registrarse y crear su primer Item en < 3 minutos
- El dashboard muestra datos reales en < 1 segundo
- Los tests de autenticación y CRUD pasan con `npm test`
- La app es desplegable en Vercel con `git push`

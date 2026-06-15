---
generado_por: /sdd.mapear
fecha: [FECHA]
proyecto: [NOMBRE_PROYECTO]
---

# Mapa de Símbolos Públicos

Funciones, clases, tipos e interfaces exportadas por cada archivo.

Generado automáticamente por `/sdd.mapear`.

## Convención

- **fn** = función
- **class** = clase
- **type** = tipo TypeScript
- **interface** = interfaz TypeScript
- **enum** = enumeración
- **const** = constante exportada

## Archivos

[SÍMBOLOS POR ARCHIVO AQUÍ]

Ejemplo:

```markdown
## src/auth/login.service.ts

- **fn** autenticarUsuario(email: string, password: string): Promise<Session>
  Autentica usuario con email y password. Lanza InvalidCredentialsError si fallan.

- **fn** cerrarSesion(sessionId: string): Promise<void>
  Cierra sesión borrando el token.

- **type** AuthResult
  ```typescript
  { session: Session, user: User }
  ```

## src/users/user.service.ts

- **fn** crearUsuario(datos: CreateUserDTO): Promise<User>
  Crea nuevo usuario. Valida email único.

- **fn** obtenerPorId(id: string): Promise<User>
  Obtiene usuario por ID. Lanza UserNotFoundError si no existe.
```

## Cómo usarlo

Durante `/sdd.implementar`, antes de modificar archivo X:

1. Claude consulta este mapa: ¿qué exporta X?
2. Si necesita más detalle, lee el archivo
3. Típicamente el mapa le alcanza

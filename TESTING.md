# Pruebas Unitarias del Sistema de Login

## Resumen
Se han creado y ejecutado **10 pruebas unitarias** para validar la funcionalidad de autenticación (login y registro). Todas las pruebas **pasaron correctamente** ✅

### Diagrama de Arquitectura
```
┌─────────────────────────────────────────┐
│      Express App (app.js)               │
│  ┌─────────────────────────────────┐   │
│  │  Rutas Auth (/auth/login, etc)  │   │
│  └──────────────┬──────────────────┘   │
│                 │                       │
│  ┌──────────────▼──────────────────┐   │
│  │  authController.js              │   │
│  │  - loginUser()                  │   │
│  │  - registerUser()               │   │
│  └──────────────┬──────────────────┘   │
│                 │                       │
│  ┌──────────────▼──────────────────┐   │
│  │  db.js (MySQL Pool)             │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
           │
           ├─► __tests__/authController.test.js
           │   (Jest - Pruebas Unitarias)
           │
           └─► Node (Ejecución)
```

## Archivos Creados

### 1. **controllers/authController.js**
Módulo que contiene la lógica de autenticación separada y testeable:
- `loginUser(usuario, password)` - Valida credenciales de usuario
- `registerUser(nombre, usuario, password, confirm_password)` - Registra nuevo usuario

### 2. **__tests__/authController.test.js**
Archivo con todas las pruebas unitarias usando Jest

## Pruebas Implementadas

### Pruebas de Login (5 pruebas)
1. ✅ **Credenciales correctas** - Retorna datos del usuario cuando login es válido
2. ✅ **Usuario inexistente** - Retorna error cuando el usuario no existe
3. ✅ **Contraseña incorrecta** - Retorna error cuando la contraseña es inválida
4. ✅ **Error de base de datos** - Maneja excepciones de la BD correctamente
5. ✅ **Campos vacíos** - Valida que usuario y contraseña sean requeridos

### Pruebas de Registro (5 pruebas)
1. ✅ **Registro exitoso** - Crea nuevo usuario cuando los datos son válidos
2. ✅ **Contraseñas no coinciden** - Retorna error si las contraseñas no son iguales
3. ✅ **Usuario duplicado** - Impide registrar un usuario que ya existe
4. ✅ **Error de base de datos** - Maneja excepciones correctamente
5. ✅ **Campos requeridos** - Valida que todos los campos sean necesarios

## Cómo Ejecutar las Pruebas

```bash
# Ejecutar todas las pruebas
npm test

# Ejecutar pruebas en modo watch (monitoreo)
npm test:watch

# Ejecutar pruebas de un archivo específico
npm test authController.test.js
```

## Resultados
```
Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Time:        9.517 s
```

## Dependencias Instaladas
- **jest** - Framework de testing
- **supertest** - Testing para APIs HTTP

## Próximos Pasos (Opcional)
- Crear pruebas de integración para los endpoints `/auth/login` y `/auth/registro`
- Agregar cobertura de código con `jest --coverage`
- Implementar pruebas para otras funcionalidades del sistema

## Estructura de Mocks
Las pruebas utilizan mocks de la base de datos para:
- Aislar la lógica de autenticación de la BD
- Simular diferentes escenarios (éxito, error, usuario duplicado, etc.)
- Evitar necesidad de una BD real durante testing

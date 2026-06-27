# Guía de Uso - Pruebas Unitarias

## Introducción
Este documento explica cómo usar, mantener y ejecutar las pruebas unitarias del sistema de autenticación.

## Estructura de Directorios

```
InventarioRep/
├── controllers/
│   └── authController.js          # Lógica de autenticación
├── __tests__/
│   └── authController.test.js     # Pruebas unitarias
├── app.js                          # Configuración Express
├── db.js                           # Conexión MySQL
├── package.json                    # Dependencias y scripts
└── TESTING.md                      # Documentación de pruebas
```

## Instalación

### 1. Requisitos Previos
- Node.js v14 o superior
- npm v6 o superior
- Variables de entorno configuradas (.env)

### 2. Instalar Dependencias
```bash
npm install
npm install --save-dev jest supertest
```

### 3. Verificar Instalación
```bash
npm test
```

## Ejecutar Pruebas

### Comando Básico
```bash
npm test
```
Ejecuta todas las pruebas una sola vez y muestra los resultados.

### Modo Vigilancia
```bash
npm run test:watch
```
Ejecuta las pruebas automáticamente cuando detecta cambios en los archivos.

### Prueba Específica
```bash
npm test -- authController.test.js
```
Ejecuta solo el archivo especificado.

### Con Cobertura de Código
```bash
npm test -- --coverage
```
Genera un reporte de qué porcentaje del código está cubierto por pruebas.

## Interpretar Resultados

### Salida Estándar
```
PASS  __tests__/authController.test.js
  Pruebas de Autenticación
    loginUser
      ✓ Debería retornar true cuando las credenciales son correctas
      ✓ Debería retornar false cuando el usuario no existe
    registerUser
      ✓ Debería registrar un nuevo usuario correctamente

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Time:        9.517 s
```

**Significado:**
- `PASS` = Todas las pruebas del archivo pasaron
- `✓` = Prueba exitosa
- `✕` = Prueba fallida
- `Test Suites` = Archivos de prueba
- `Tests` = Total de pruebas

### En Caso de Error
```
FAIL  __tests__/authController.test.js
  ● loginUser › Debería retornar true...
    
    expect(received).toBe(expected)
    Expected: true
    Received: false
```

Significa que la prueba no se comportó como se esperaba.

## Entender las Pruebas

### Estructura de una Prueba
```javascript
test('descripción de lo que prueba', async () => {
    // ARRANQUE: Preparar datos
    db.query.mockResolvedValueOnce([[mockUser]]);
    
    // ACCIÓN: Ejecutar la función
    const result = await loginUser('juan123', 'password123');
    
    // AFIRMACIÓN: Verificar resultado
    expect(result.success).toBe(true);
});
```

### Mock de Base de Datos
Las pruebas usan `jest.mock()` para simular la BD sin conectarse realmente:
```javascript
jest.mock('../db'); // Reemplaza db.js con un mock
db.query.mockResolvedValueOnce([[user]]); // Simula respuesta exitosa
db.query.mockRejectedValueOnce(new Error('BD down')); // Simula error
```

## Agregar Nuevas Pruebas

### Pasos para Crear una Prueba
1. Abrir `__tests__/authController.test.js`
2. Adicionar dentro del `describe()` correspondiente:
```javascript
test('nueva descripción', async () => {
    // Setup
    db.query.mockResolvedValueOnce([...]);
    
    // Execute
    const result = await miFunction(...);
    
    // Assert
    expect(result.success).toBe(true);
});
```
3. Ejecutar: `npm test`

### Métodos de Verificación Comunes
```javascript
expect(valor).toBe(expected);           // Igualdad estricta
expect(valor).toEqual(expected);        // Igualdad profunda
expect(array).toContain(item);          // Contiene elemento
expect(array.length).toBe(5);           // Longitud
expect(func).toHaveBeenCalledWith(...); // Llamada con argumentos
expect(promise).rejects.toThrow();      // Rechaza promise
```

## Mejores Prácticas

### ✅ Hacer
- Pruebas independientes (no dependan una de otra)
- Nombres descriptivos que expliquen qué se prueba
- Usar `beforeEach()` para limpiar mocks entre pruebas
- Probar casos exitosos Y errores
- Mantener pruebas pequeñas y enfocadas

### ❌ Evitar
- Pruebas que usan datos de la BD real
- Pruebas que dependen del orden de ejecución
- Pruebas muy complejas o largas
- Modificar archivos o la BD durante pruebas

## Integración Continua

Para ejecutar pruebas automáticamente en despliegues, agregar a `package.json`:
```json
"scripts": {
  "test": "jest",
  "test:ci": "jest --ci --coverage"
}
```

## Resolución de Problemas

### "Cannot find module..."
- Verificar que jest esté instalado: `npm install --save-dev jest`
- Verificar rutas relativas en imports

### Prueba cuelga infinitamente
- Asegurarse que `async` pruebas retornan una Promise
- Verificar que los mocks están configurados correctamente

### Cobertura baja
- Agregar pruebas para casos extremos
- Probar condiciones de error
- Usar `npm test -- --coverage` para ver qué líneas no están cubiertas

## Recursos Adicionales

- [Jest Documentation](https://jestjs.io/)
- [Supertest Guide](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

const { loginUser, registerUser } = require('../controllers/authController');
const db = require('../db');

// Mock de la base de datos
jest.mock('../db');

describe('Pruebas de Autenticación', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('loginUser - Pruebas de login', () => {
        
        test('Debería retornar true cuando las credenciales son correctas', async () => {
            const mockUser = {
                id_usuarios: 1,
                nombre: 'Juan Pérez',
                id_rol: 1,
                usuario: 'juan123',
                contraseña: 'password123'
            };

            db.query.mockResolvedValueOnce([[mockUser]]);

            const result = await loginUser('juan123', 'password123');

            expect(result.success).toBe(true);
            expect(result.user.id_usuarios).toBe(1);
            expect(result.user.nombre).toBe('Juan Pérez');
            expect(db.query).toHaveBeenCalledWith(
                'SELECT * FROM usuarios WHERE usuario = ? AND contraseña = ?',
                ['juan123', 'password123']
            );
        });

        test('Debería retornar false cuando el usuario no existe', async () => {
            db.query.mockResolvedValueOnce([[]]);

            const result = await loginUser('usuario_inexistente', 'password123');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Usuario o contraseña incorrectos');
        });

        test('Debería retornar false cuando la contraseña es incorrecta', async () => {
            db.query.mockResolvedValueOnce([[]]);

            const result = await loginUser('juan123', 'password_incorrecta');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Usuario o contraseña incorrectos');
        });

        test('Debería manejar errores de la base de datos', async () => {
            const errorMessage = 'Error de conexión a la BD';
            db.query.mockRejectedValueOnce(new Error(errorMessage));

            const result = await loginUser('juan123', 'password123');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Error en el servidor');
            expect(result.error).toBe(errorMessage);
        });

        test('Debería validar que se requiere usuario y contraseña', async () => {
            db.query.mockResolvedValueOnce([[]]);

            const result1 = await loginUser('', 'password123');
            const result2 = await loginUser('usuario', '');

            expect(result1.success).toBe(false);
            expect(result2.success).toBe(false);
        });
    });

    describe('registerUser - Pruebas de registro', () => {
        
        test('Debería registrar un nuevo usuario correctamente', async () => {
            db.query.mockResolvedValueOnce([[]]) // Usuario no existe
                .mockResolvedValueOnce({ affectedRows: 1 }); // Inserción exitosa

            const result = await registerUser('María López', 'maria123', 'pass123', 'pass123');

            expect(result.success).toBe(true);
            expect(result.message).toBe('Usuario registrado correctamente');
        });

        test('Debería fallar si las contraseñas no coinciden', async () => {
            const result = await registerUser('María López', 'maria123', 'pass123', 'pass456');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Las contraseñas no coinciden');
        });

        test('Debería fallar si el usuario ya existe', async () => {
            const existingUser = {
                id_usuarios: 1,
                usuario: 'juan123'
            };

            db.query.mockResolvedValueOnce([[existingUser]]);

            const result = await registerUser('Juan Pérez', 'juan123', 'pass123', 'pass123');

            expect(result.success).toBe(false);
            expect(result.message).toBe('El usuario ya existe');
        });

        test('Debería manejar errores de la base de datos durante el registro', async () => {
            const errorMessage = 'Error de conexión a la BD';
            db.query.mockResolvedValueOnce([[]]) // Usuario no existe
                .mockRejectedValueOnce(new Error(errorMessage));

            const result = await registerUser('María López', 'maria123', 'pass123', 'pass123');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Error en el servidor');
        });

        test('Debería validar que se requieran todos los campos', async () => {
            const result = await registerUser('', '', '', '');

            expect(result.success).toBe(false);
        });
    });
});

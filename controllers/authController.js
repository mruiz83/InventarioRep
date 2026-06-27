const db = require('../db');

/**
 * Autentica un usuario validando sus credenciales
 * @async
 * @function loginUser
 * @param {string} usuario - Nombre de usuario a validar
 * @param {string} password - Contraseña del usuario
 * @returns {Promise<Object>} Objeto con estructura:
 *   - Si éxito: { success: true, user: {id_usuarios, nombre, id_rol, usuario} }
 *   - Si fallo: { success: false, message: string, error?: string }
 * @throws {Error} Errores de conexión a la base de datos
 * 
 * @example
 * const result = await loginUser('juan123', 'password123');
 * if (result.success) {
 *   console.log('Usuario autenticado:', result.user.nombre);
 * }
 */
const loginUser = async (usuario, password) => {
    try {
        const [rows] = await db.query('SELECT * FROM usuarios WHERE usuario = ? AND contraseña = ?', [usuario, password]);
        
        if (rows.length > 0) {
            return {
                success: true,
                user: {
                    id_usuarios: rows[0].id_usuarios,
                    nombre: rows[0].nombre,
                    id_rol: rows[0].id_rol,
                    usuario: rows[0].usuario
                }
            };
        } else {
            return {
                success: false,
                message: 'Usuario o contraseña incorrectos'
            };
        }
    } catch (error) {
        return {
            success: false,
            message: 'Error en el servidor',
            error: error.message
        };
    }
};

/**
 * Registra un nuevo usuario en el sistema
 * @async
 * @function registerUser
 * @param {string} nombre - Nombre completo del usuario
 * @param {string} usuario - Nombre de usuario (único)
 * @param {string} password - Contraseña del usuario
 * @param {string} confirm_password - Confirmación de contraseña (debe coincidir)
 * @returns {Promise<Object>} Objeto con estructura:
 *   - Si éxito: { success: true, message: string }
 *   - Si fallo: { success: false, message: string, error?: string }
 * @throws {Error} Errores de conexión a la base de datos
 * 
 * @example
 * const result = await registerUser('María López', 'maria123', 'pass123', 'pass123');
 * if (result.success) {
 *   console.log('Usuario registrado exitosamente');
 * }
 */
const registerUser = async (nombre, usuario, password, confirm_password) => {
    try {
        // Validar que las contraseñas coincidan
        if (password !== confirm_password) {
            return {
                success: false,
                message: 'Las contraseñas no coinciden'
            };
        }

        // Validar que el usuario no exista
        const [existingUser] = await db.query('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
        if (existingUser.length > 0) {
            return {
                success: false,
                message: 'El usuario ya existe'
            };
        }

        // Crear nuevo usuario (rol por defecto: 3 - colaborador)
        await db.query('INSERT INTO usuarios (nombre, usuario, contraseña, id_rol) VALUES (?, ?, ?, ?)', 
            [nombre, usuario, password, 3]);

        return {
            success: true,
            message: 'Usuario registrado correctamente'
        };
    } catch (error) {
        return {
            success: false,
            message: 'Error en el servidor',
            error: error.message
        };
    }
};

module.exports = {
    loginUser,
    registerUser
};

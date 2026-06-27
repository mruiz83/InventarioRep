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
 */
const loginUser = async (usuario, password) => {
    if (!usuario || !password) {
        return {
            success: false,
            message: 'Usuario o contraseña incorrectos'
        };
    }

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
        }

        return {
            success: false,
            message: 'Usuario o contraseña incorrectos'
        };
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
 */
const registerUser = async (nombre, usuario, password, confirm_password) => {
    if (!nombre || !usuario || !password || !confirm_password) {
        return {
            success: false,
            message: 'Todos los campos son obligatorios'
        };
    }

    try {
        if (password !== confirm_password) {
            return {
                success: false,
                message: 'Las contraseñas no coinciden'
            };
        }

        const [existingUser] = await db.query('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
        if (existingUser.length > 0) {
            return {
                success: false,
                message: 'El usuario ya existe'
            };
        }

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

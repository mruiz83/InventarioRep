const express = require('express');
const { loginUser, registerUser } = require('../controllers/authController');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('login');
});

router.post('/auth/login', async (req, res) => {
    const { usuario, password } = req.body;
    const result = await loginUser(usuario, password);

    if (result.success) {
        req.session.loggedin = true;
        req.session.id_usuario = result.user.id_usuarios;
        req.session.nombreReal = result.user.nombre;
        req.session.rol = result.user.id_rol;
        return res.redirect('/dashboard');
    }

    req.flash('error', result.message);
    return res.redirect('/');
});

router.get('/registro', (req, res) => {
    res.render('register', { messages: req.flash() });
});

router.post('/auth/registro', async (req, res) => {
    const { nombre, usuario, password, confirm_password } = req.body;
    const result = await registerUser(nombre, usuario, password, confirm_password);

    if (!result.success) {
        req.flash('error', result.message);
        return res.redirect('/registro');
    }

    req.flash('success', '✅ Usuario registrado exitosamente. Ahora puede iniciar sesión.');
    return res.redirect('/');
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;

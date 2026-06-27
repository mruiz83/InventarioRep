const attachUserContext = (req, res, next) => {
    res.locals.messages = req.flash();
    res.locals.userRol = req.session.rol || null;
    next();
};

const restrictTo = (rolesPermitidos) => {
    return (req, res, next) => {
        if (req.session.loggedin) {
            if (rolesPermitidos.includes(req.session.rol)) {
                return next();
            }
            req.flash('error', 'No tienes permiso para acceder a este módulo');
            return res.redirect('/dashboard');
        }
        res.redirect('/');
    };
};

module.exports = {
    attachUserContext,
    restrictTo
};

const supabase = require('../config/supabase');

const requireAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Acceso denegado: Token inválido o expirado' });
        }

        req.user = user;
        next();
    } catch (err) {
        res.status(500).json({ error: 'Error interno de autenticación' });
    }
};

module.exports = requireAuth;
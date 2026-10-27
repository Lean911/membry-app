require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const requireAuth = require('./middleware/auth'); // Ajustá la ruta si tu auth está en otra carpeta

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend/public')));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const LEGAL_CONFIG = Object.freeze({
    platformName: 'Membry',
    legalOwner: 'Membry Platform',
    jurisdiction: 'Ciudad Autónoma de Buenos Aires, República Argentina',
    contactEmail: 'membry.ok@gmail.com',
    version: 'v1.0-AR-2026',
    lastUpdated: 'Octubre 2026',
    platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || 5),
    paymentProcessor: 'Mercado Pago (MercadoLibre S.R.L.)',
    regulatoryLaws: {
        dataProtection: 'Ley N° 25.326 de Protección de los Datos Personales (AAIP)',
        consumerDefense: 'Ley N° 24.240 de Defensa del Consumidor',
        civilCode: 'Código Civil y Comercial de la Nación (Arts. 1104 a 1116)',
        antiMoneyLaundering: 'Ley N° 25.246 de Prevención de Lavado de Activos (UIF)'
    },
    aaipMandatoryNotice: 'EL TITULAR DE LOS DATOS PERSONALES TIENE LA FACULTAD DE EJERCER EL DERECHO DE ACCESO A LOS MISMOS EN FORMA GRATUITA A INTERVALOS NO INFERIORES A SEIS MESES, SALVO QUE SE ACREDITE UN INTERÉS LEGÍTIMO AL EFECTO CONFORME LO ESTABLECIDO EN EL ARTÍCULO 14, INCISO 3 DE LA LEY Nº 25.326. LA AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, EN SU CARÁCTER DE ÓRGANO DE CONTROL DE LA LEY Nº 25.326, TIENE LA ATRIBUCIÓN DE ATENDER LAS DENUNCIAS Y RECLAMOS QUE INTERPONGAN QUIENES RESULTEN AFECTADOS EN SUS DERECHOS POR INCUMPLIMIENTO DE LAS NORMAS VIGENTES EN MATERIA DE PROTECCIÓN DE DATOS PERSONALES.'
});

function buildLegalDocument(cfg) {
    return [
        { id: 'objeto', title: '1. Naturaleza del Servicio', body: `${cfg.platformName} es una plataforma SaaS...` },
        { id: 'exclusion', title: '2. Exclusión de Responsabilidad', body: `${cfg.platformName} actúa como intermediario tecnológico neutro...` },
        { id: 'comisiones', title: '3. Comisiones e Impuestos', body: `Comisión del ${cfg.platformFeePercent}%...` },
        { id: 'datos', title: '4. Tratamiento de Datos Personales', body: `En cumplimiento de la ${cfg.regulatoryLaws.dataProtection}...` },
        { id: 'jurisdiccion', title: '5. Ley Aplicable', body: `Jurisdicción ${cfg.jurisdiction}...` }
    ];
}

async function registrarAuditoria(req, { user_id = null, user_email = null, action, details = {} }) {
    try {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'IP desconocida';
        const userAgent = req.headers['user-agent'] || 'Dispositivo desconocido';

        await supabase.from('audit_logs').insert([{
            user_id, user_email, action,
            details: { ...details, legal_version: LEGAL_CONFIG.version },
            ip_address: ip, user_agent: userAgent
        }]);
    } catch (err) {
        console.error('Error audit:', err.message);
    }
}

app.get('/api/legal', (req, res) => {
    res.json({ success: true, config: LEGAL_CONFIG, sections: buildLegalDocument(LEGAL_CONFIG) });
});

// ✅ Auditoría PROTEGIDA con JWT
app.post('/api/audit', requireAuth, async (req, res) => {
    const { action, details } = req.body;
    await registrarAuditoria(req, {
        user_id: req.user.id,
        user_email: req.user.email,
        action, details
    });
    res.json({ success: true });
});

app.get('/api/audit/:userId', requireAuth, async (req, res) => {
    // Solo el propio usuario puede ver sus logs
    if (req.params.userId !== req.user.id) {
        return res.status(403).json({ error: 'No autorizado' });
    }
    const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', req.params.userId)
        .order('created_at', { ascending: false })
        .limit(20);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, logs });
});

// robots.txt
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: https://membry.com.ar/sitemap.xml`);
});

// sitemap.xml
app.get('/sitemap.xml', async (req, res) => {
    try {
        const { data: creators } = await supabase
            .from('profiles')
            .select('username, created_at')
            .eq('role', 'creator')
            .not('username', 'is', null);
        let urls = `<url><loc>https://membry.com.ar/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;
        (creators || []).forEach(c => {
            urls += `<url><loc>https://membry.com.ar/${c.username}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
        });
        res.header('Content-Type', 'application/xml');
        res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
    } catch (e) { res.status(500).end(); }
});

// /u/:username con SEO dinámico
app.get('/u/:username', async (req, res) => {
    const { username } = req.params;
    const htmlPath = path.join(__dirname, '../../frontend/public/index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    try {
        const { data: creator } = await supabase
            .from('creators')
            .select('display_name, username, bio, avatar_url')
            .eq('username', username.toLowerCase())
            .single();
        if (creator) {
            const seoTitle = `${creator.display_name} (@${creator.username}) | Apoyá mi contenido en Membry`;
            const seoDesc = creator.bio || `Invitale un aporte a ${creator.display_name} en Membry.`;
            html = html
                .replace(/<title>.*?<\/title>/, `<title>${seoTitle}</title>`)
                .replace(/content="La plataforma gratuita para creadores.*?"/, `content="${seoDesc}"`)
                .replace(/property="og:title" content=".*?"/, `property="og:title" content="${seoTitle}"`)
                .replace(/property="og:description" content=".*?"/, `property="og:description" content="${seoDesc}"`);
        }
    } catch (e) {}
    res.send(html);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`✅ Membry (${LEGAL_CONFIG.version}) en http://localhost:${PORT}`);
});
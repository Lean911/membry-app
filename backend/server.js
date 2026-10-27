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

// =========================================================================
// CONFIGURACIÓN LEGAL PARAMETRIZADA EN SERVIDOR (BLINDAJE INTEGRAL AR)
// =========================================================================
const LEGAL_CONFIG = Object.freeze({
    platformName: 'Membry',
    legalOwner: 'Membry Platform',
    jurisdiction: 'Ciudad Autónoma de Buenos Aires, República Argentina',
    contactEmail: 'legales@membry.com.ar',
    version: 'v2.0-BLINDAJE-AR-2026',
    lastUpdated: '26 de octubre de 2026',
    platformFeePercent: 5,
    minimumAge: 18,
    maxLiabilityARS: 50000,
    paymentProcessor: 'Mercado Pago (MercadoLibre S.R.L.)',
    regulatoryLaws: Object.freeze({
        dataProtection: 'Ley N° 25.326 de Protección de los Datos Personales (AAIP)',
        consumerDefense: 'Ley N° 24.240 de Defensa del Consumidor',
        civilCode: 'Código Civil y Comercial de la Nación (Arts. 25, 1104 a 1116 y 1743)',
        intellectualProperty: 'Ley N° 11.723 de Régimen Legal de la Propiedad Intelectual',
        antiMoneyLaundering: 'Ley N° 25.246 de Prevención de Lavado de Activos (UIF)',
        penalCode: 'Código Penal de la Nación Argentina (Delitos Informáticos y Art. 128)'
    }),
    aaipMandatoryNotice: 'EL TITULAR DE LOS DATOS PERSONALES TIENE LA FACULTAD DE EJERCER EL DERECHO DE ACCESO A LOS MISMOS EN FORMA GRATUITA A INTERVALOS NO INFERIORES A SEIS MESES, SALVO QUE SE ACREDITE UN INTERÉS LEGÍTIMO AL EFECTO CONFORME LO ESTABLECIDO EN EL ARTÍCULO 14, INCISO 3 DE LA LEY Nº 25.326. LA AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, EN SU CARÁCTER DE ÓRGANO DE CONTROL DE LA LEY Nº 25.326, TIENE LA ATRIBUCIÓN DE ATENDER LAS DENUNCIAS Y RECLAMOS QUE INTERPONGAN QUIENES RESULTEN AFECTADOS EN SUS DERECHOS POR INCUMPLIMIENTO DE LAS NORMAS VIGENTES EN MATERIA DE PROTECCIÓN DE DATOS PERSONALES.'
});

function buildLegalDocument(cfg) {
    return [
        {
            id: 'elegibilidad',
            title: '1. Elegibilidad y Mayoría de Edad Obligatoria (+18)',
            summary: `En pocas palabras: Debe ser mayor de edad (${cfg.minimumAge} años o más) según la ley argentina para utilizar ${cfg.platformName}. Si es menor de edad, tiene estrictamente prohibido el acceso.`,
            body: `Conforme al Artículo 25 del ${cfg.regulatoryLaws.civilCode}, usted declara y garantiza bajo juramento tener al menos dieciocho (${cfg.minimumAge}) años de edad y plena capacidad civil para contratar. El uso de la plataforma está terminantemente prohibido para menores de edad. Al acceder, registrarse o realizar aportes en ${cfg.platformName}, usted manifiesta que comprende y acepta este acuerdo contractual vinculante. Si no está de acuerdo, debe abandonar el sitio de inmediato.`
        },
        {
            id: 'concesion',
            title: '2. Concesión de Uso Limitada y Derecho de Admisión y Baja',
            summary: `En pocas palabras: Le concedemos un permiso personal para usar ${cfg.platformName}, pero podemos suspender o eliminar su cuenta, bloquear su IP o retirar contenido en cualquier momento y sin previo aviso si detectamos riesgos o incumplimientos.`,
            body: `Le concedemos un derecho no exclusivo, intransferible y revocable para acceder y utilizar ${cfg.platformName}. Esta concesión puede ser rescindida por nuestra parte en cualquier momento, con o sin previo aviso, si consideramos a nuestra entera discreción que se vulneran estas Condiciones. En tal caso, podremos: i) desactivar o eliminar su cuenta, ii) bloquear su correo electrónico y direcciones IP, iii) desvincular la pasarela de cobros y iv) eliminar cualquier Contribución de usuario. Usted reconoce que ${cfg.platformName} no será responsable ante usted ni ante terceros por la terminación de su acceso.`
        },
        {
            id: 'kyc',
            title: '3. Verificación de Identidad del Usuario (KYC) y Prevención de Fraude',
            summary: `En pocas palabras: Podemos exigirle en cualquier momento una foto de su DNI y una selfie sosteniendo el documento junto a su rostro para verificar su identidad y mayoría de edad.`,
            body: `A nuestra entera discreción y en cumplimiento de las normas de seguridad y prevención de fraude (${cfg.regulatoryLaws.antiMoneyLaundering}), podemos exigir a cualquier Creador o Seguidor que verifique su identidad mediante la presentación de: 1) Una copia clara de su Documento Nacional de Identidad (DNI) o pasaporte vigente con fotografía, y 2) Una fotografía actual (selfie) sosteniendo dicho documento junto a su rostro. La negativa a completar la verificación, el suministro de documentación adulterada o el intento de eludir los controles dará lugar al bloqueo permanente de la cuenta y la denuncia ante las autoridades competentes.`
        },
        {
            id: 'contribuciones',
            title: '4. Contribuciones de Usuario, Licencias y Contenido Prohibido',
            summary: `En pocas palabras: Usted es dueño de lo que publica y es el único responsable legal de su contenido. Nos otorga permiso para mostrarlo en la plataforma y garantiza que no infringe derechos de terceros ni leyes vigentes.`,
            body: `Usted conserva la titularidad de los textos, imágenes, enlaces, audios o videos que publique ("Contribuciones de usuario"), siendo el único y exclusivo responsable civil, penal y tributario de las consecuencias de su publicación. Al subir contenido, otorga a ${cfg.platformName} una licencia mundial, gratuita y no exclusiva para alojar, reproducir y mostrar públicamente dicho material dentro del servicio. Usted garantiza que: i) cuenta con el consentimiento escrito de cualquier persona mayor de 18 años identificable en su perfil; ii) jamás publicará material que involucre a menores de edad (delito reprimido por el ${cfg.regulatoryLaws.penalCode}), violencia, crueldad animal, incitación al odio, estafas, lavado de dinero, apuestas ilegales ni actividades reñidas con las políticas de ${cfg.paymentProcessor}.`
        },
        {
            id: 'intermediacion',
            title: '5. Contenido de Terceros y Neutralidad Tecnológica',
            summary: `En pocas palabras: No somos dueños ni editores de lo que publican los Creadores o Seguidores, ni controlamos enlaces externos. Si interactúa o consume contenido de un Creador, lo hace bajo su propia responsabilidad.`,
            body: `${cfg.platformName} actúa exclusivamente como un proveedor neutro de infraestructura informática (SaaS), amparado por la doctrina jurisprudencial de la Corte Suprema de Justicia de la Nación sobre responsabilidad de intermediarios en Internet (Fallo "Rodríguez, María Belén"). No realizamos control editorial previo obligatorio sobre todos los mensajes o enlaces a redes externas (Twitch, YouTube, Discord, etc.) ni garantizamos la veracidad, calidad o cumplimiento de las recompensas prometidas por los Creadores. Todo el contenido se proporciona "tal cual", asumiendo el usuario el riesgo exclusivo de su utilización.`
        },
        {
            id: 'conducta',
            title: '6. Conducta del Usuario, Seguridad Informática y Registro de Actividad',
            summary: `En pocas palabras: No utilice ${cfg.platformName} para infringir la ley, acosar usuarios ni atacar nuestros servidores. Usted nos autoriza expresamente a registrar su actividad, IP y eventos por seguridad.`,
            body: `Usted nos autoriza expresamente a supervisar y registrar en nuestro motor inmutable de auditoría informática (Audit Log) sus actividades dentro de la plataforma, incluyendo dirección IP, dispositivo, navegador, fechas, textos de reseñas e intentos de pago, con fines de seguridad operativa y prueba judicial. Queda terminantemente prohibido: i) usar bots, scrapers o herramientas de extracción automatizada de datos; ii) intentar vulnerar la seguridad, realizar ingeniería inversa o sobrecargar nuestra infraestructura; iii) suplantar identidades; o iv) utilizar la plataforma para fines ilícitos que puedan exponer a ${cfg.platformName} a responsabilidad civil o penal.`
        },
        {
            id: 'pagos',
            title: '7. Aportes, Membresías, Split de Pagos y Política Anti-Contracargos',
            summary: `En pocas palabras: Los pagos se procesan por ${cfg.paymentProcessor} con una comisión del ${cfg.platformFeePercent}% para la plataforma. Los aportes enviados a los Creadores son definitivos, no son reembolsables y usted se compromete a no realizar desconocimientos falsos de cargos.`,
            body: `${cfg.platformName} no es una entidad financiera (Ley N° 21.526) ni retiene fondos de terceros; opera mediante el sistema de liquidación dividida (Marketplace Split) de ${cfg.paymentProcessor}, reteniendo únicamente un ${cfg.platformFeePercent}% en concepto de servicio tecnológico. Cada Creador es sujeto tributario independiente responsable de su facturación ante ARCA (ex AFIP). Los aportes únicos constituyen liberalidades voluntarias de apoyo y, una vez acreditados en la cuenta del Creador, NO SON REEMBOLSABLES bajo ninguna circunstancia. El Seguidor se compromete a no denunciar ni desconocer de mala fe ante su banco o emisor de tarjeta ningún cargo legítimamente autorizado en la plataforma.`
        },
        {
            id: 'propiedad_intelectual',
            title: '8. Propiedad Intelectual, Derechos de Autor y Política de Reincidentes',
            summary: `En pocas palabras: El software, diseño y marca ${cfg.platformName} nos pertenecen. Respetamos los derechos de autor (${cfg.regulatoryLaws.intellectualProperty}) y daremos de baja a quienes suban material robado.`,
            body: `El código fuente, diseño visual, logotipos y bases de datos de ${cfg.platformName} son propiedad exclusiva de la plataforma. Respecto al contenido subido por usuarios, aplicamos un protocolo estricto de notificación y retirada ("Notice and Takedown") conforme a la ${cfg.regulatoryLaws.intellectualProperty}. Si un titular de derechos de autor notifica fehacientemente a ${cfg.contactEmail} una infracción acreditando su titularidad y la URL exacta, el material será removido preventivamente. Se cancelará definitivamente la cuenta de cualquier usuario que acumule tres (3) reclamaciones legítimas de propiedad intelectual en un período de seis (6) meses.`
        },
        {
            id: 'grabaciones',
            title: '9. Prohibición de Reventa y Explotación Comercial por Seguidores',
            summary: `En pocas palabras: El contenido o beneficios a los que acceda apoyando a un Creador son solo para su uso personal. Está prohibido revenderlos, grabarlos o redistribuirlos comercialmente.`,
            body: `El acceso a muros, enlaces exclusivos, transmisiones o beneficios otorgados por un Creador a sus Seguidores o suscriptores de membresías es estrictamente para uso personal y no comercial del Seguidor. Queda terminantemente prohibida la grabación no autorizada, copia, distribución, reventa o publicación en sitios de terceros del material provisto por los Creadores, eximiendo a ${cfg.platformName} de cualquier disputa derivada del incumplimiento de esta prohibición.`
        },
        {
            id: 'indemnidad',
            title: '10. Indemnidad Total y Exención Frente a Disputas entre Usuarios',
            summary: `En pocas palabras: Si alguien demanda a ${cfg.platformName} por culpa de su contenido o por una infracción suya, usted deberá hacerse cargo de todos los gastos legales y honorarios de abogados. Si tiene una disputa con un Creador, el reclamo es solo contra ese Creador.`,
            body: `Usted se obliga a mantener indemne, defender e indemnizar a ${cfg.platformName}, sus titulares, desarrolladores y representantes frente a cualquier reclamo, demanda, multa, sanción o gasto (incluyendo costas judiciales y honorarios razonables de abogados) promovido por terceros o autoridades gubernamentales a raíz de: i) sus Contribuciones de usuario, ii) su incumplimiento de estas Condiciones, o iii) la violación de cualquier ley o derecho de terceros. En caso de disputa entre un Seguidor y un Creador, usted exime expresamente a ${cfg.platformName} de todo reclamo por daños directos, indirectos o consecuentes derivados de dicho conflicto.`
        },
        {
            id: 'limitacion',
            title: '11. Exclusión de Garantías y Límite Máximo de Responsabilidad',
            summary: `En pocas palabras: Ofrecemos la plataforma "tal cual" sin garantizar que nunca haya interrupciones técnicas. Nuestra responsabilidad máxima ante cualquier eventualidad está limitada al tope legal permitido.`,
            body: `En la máxima medida permitida por el Artículo 1743 del ${cfg.regulatoryLaws.civilCode}, ${cfg.platformName} no garantiza que el servicio funcione de manera ininterrumpida o libre de errores externos de conectividad o de la pasarela ${cfg.paymentProcessor}. Bajo ninguna circunstancia seremos responsables por lucro cesante, pérdida de datos o daños indirectos. Su único recurso en caso de insatisfacción con la plataforma será dejar de utilizarla, estableciéndose que la responsabilidad total máxima acumulada de ${cfg.platformName} por cualquier concepto vinculado al servicio no excederá el equivalente a las comisiones netas percibidas por la plataforma respecto de su cuenta en los últimos tres (3) meses, o la suma de $${cfg.maxLiabilityARS.toLocaleString('es-AR')} ARS, lo que resulte menor.`
        },
        {
            id: 'jurisdiccion',
            title: '12. Modificaciones, Divisibilidad, Ley Aplicable y Jurisdicción',
            summary: `En pocas palabras: Podemos actualizar estas normas publicándolas en la web. Toda nuestra actividad se rige por las leyes de la República Argentina y los tribunales de la Ciudad Autónoma de Buenos Aires.`,
            body: `Nos reservamos el derecho de modificar estas Condiciones publicando la nueva versión identificada con su código de trazabilidad en el sitio web; el uso continuado implicará su plena aceptación. Si alguna cláusula fuera declarada inválida, las restantes mantendrán plena vigencia. Este acuerdo se rige íntegramente por las leyes de la República Argentina. Para cualquier controversia judicial, las partes se someten a la competencia exclusiva de los Tribunales Ordinarios con asiento en la ${cfg.jurisdiction}, renunciando a cualquier otro fuero o jurisdicción.`
        }
    ];
}

// Ruta para solicitar recuperación de contraseña
app.post('/api/auth/recover', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, error: 'El correo electrónico es requerido.' });
        }

        // Llamada a Supabase Auth para enviar el correo de recuperación
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://membry.com.ar/auth?type=recovery', // URL a donde vuelve el usuario al hacer clic en el mail
        });

        if (error) {
            return res.status(400).json({ success: false, error: error.message });
        }

        // Registrar en los Audit Logs la solicitud de recuperación
        await supabase.from('audit_logs').insert([{
            user_email: email,
            action: 'PASSWORD_RECOVERY_REQUESTED',
            details: { summary: 'Se solicitó un correo de recuperación de contraseña' }
        }]);

        res.json({ success: true, message: 'Correo de recuperación enviado exitosamente.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Error interno del servidor.' });
    }
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
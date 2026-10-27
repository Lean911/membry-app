const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const requireAuth = require('../middleware/auth');
const { MercadoPagoConfig, Preference, Payment, PreApproval } = require('mercadopago');

const mpClient = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});

const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || 5);

// ---------------------------------------------------------------------------
// FUNCIÓN DE CÁLCULO DE COMISIONES
// ⚠️ El "mpFee" real lo informa Mercado Pago en el pago aprobado.
// Acá usamos un estimado del 3.5% para previsualización; en el webhook
// se sobrescribe con el valor real que devuelve la API de MP.
// ---------------------------------------------------------------------------
function calcularComisiones(grossAmount, mpFeeEstimatePercent = 3.5) {
    const gross = parseFloat(grossAmount);
    const mpFee = +(gross * (mpFeeEstimatePercent / 100)).toFixed(2);
    const baseForFee = gross - mpFee;
    const platformFee = +(baseForFee * (PLATFORM_FEE_PERCENT / 100)).toFixed(2);
    const netAmount = +(baseForFee - platformFee).toFixed(2);
    return { gross, mpFee, platformFee, netAmount };
}

// ---------------------------------------------------------------------------
// 1. Perfil público del creador (SOLO campos seguros, sin mp_access_token)
// ---------------------------------------------------------------------------
router.get('/creator/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const { data: creator, error: creatorError } = await supabase
            .from('creators')
            .select('id, username, display_name, bio, avatar_url, coffee_price, balance, verified')
            .eq('username', username)
            .single();

        if (creatorError || !creator) {
            return res.status(404).json({ error: 'Creador no encontrado' });
        }

        const { data: tiers } = await supabase
            .from('subscription_tiers')
            .select('*')
            .eq('creator_id', creator.id)
            .eq('active', true)
            .order('price', { ascending: true });

        const { data: transactions } = await supabase
            .from('transactions')
            .select('id, supporter_name, message, type, net_amount, created_at')
            .eq('creator_id', creator.id)
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(10);

        res.json({
            creator,
            tiers: tiers || [],
            transactions: transactions || []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------------------------
// 2. Pago ÚNICO (Cafecito). Ya NO acredita saldo: solo crea la transacción
//    en estado 'pending'. El saldo se suma en el webhook cuando MP confirma.
// ---------------------------------------------------------------------------
router.post('/checkout', async (req, res) => {
    try {
        const { creator_id, title, amount, supporter_name, message } = req.body;
        const comisiones = calcularComisiones(amount);

        const { data: transaction, error } = await supabase
            .from('transactions')
            .insert([{
                creator_id,
                supporter_name: supporter_name || 'Seguidor Anónimo',
                message: message || '¡Te invitó un aporte!',
                type: 'one_time',
                gross_amount: comisiones.gross,
                platform_fee: comisiones.platformFee,
                mp_fee: comisiones.mpFee,
                net_amount: comisiones.netAmount,
                status: 'pending'
            }])
            .select()
            .single();

        if (error) throw error;

        let init_point = null;
        if (process.env.MP_ACCESS_TOKEN && !process.env.MP_ACCESS_TOKEN.includes('tu-token')) {
            const preference = new Preference(mpClient);
            const mpResponse = await preference.create({
                body: {
                    items: [{
                        title,
                        quantity: 1,
                        unit_price: comisiones.gross,
                        currency_id: 'ARS'
                    }],
                    external_reference: transaction.id,
                    notification_url: `${process.env.APP_URL || 'https://tu-dominio.com'}/api/webhook`
                }
            });
            init_point = mpResponse.init_point;
        }

        res.json({ success: true, transaction, checkout_url: init_point });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------------------------
// 3. SUSCRIPCIÓN REAL con Preapproval
// ---------------------------------------------------------------------------
router.post('/subscribe', async (req, res) => {
    try {
        const { creator_id, tier_id, supporter_email, supporter_name } = req.body;

        const { data: tier, error: tierError } = await supabase
            .from('subscription_tiers')
            .select('*, creator:creators(username, display_name)')
            .eq('id', tier_id)
            .eq('creator_id', creator_id)
            .eq('active', true)
            .single();

        if (tierError || !tier) {
            return res.status(404).json({ error: 'Plan no encontrado o inactivo' });
        }

        const preapprovalClient = new PreApproval(mpClient);
        const preapproval = await preapprovalClient.create({
            body: {
                reason: `Membresía ${tier.name} - ${tier.creator.display_name}`,
                external_reference: `${creator_id}:${tier_id}:${supporter_email}`,
                payer_email: supporter_email,
                auto_recurring: {
                    frequency: 1,
                    frequency_type: 'months',
                    transaction_amount: parseFloat(tier.price),
                    currency_id: 'ARS'
                },
                back_url: `${process.env.APP_URL || 'https://tu-dominio.com'}/suscripcion/gracias`,
                status: 'pending'
            }
        });

        const { data: subscription, error: subError } = await supabase
            .from('subscriptions')
            .insert([{
                creator_id,
                tier_id,
                supporter_email,
                supporter_name: supporter_name || 'Seguidor',
                preapproval_id: preapproval.id,
                status: 'pending',
                amount: parseFloat(tier.price)
            }])
            .select()
            .single();

        if (subError) throw subError;

        res.json({
            success: true,
            subscription,
            init_point: preapproval.init_point
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------------------------
// 4. Panel privado del creador (requiere JWT)
// ---------------------------------------------------------------------------
router.get('/dashboard/private-data', requireAuth, async (req, res) => {
    try {
        const { data: creator, error } = await supabase
            .from('creators')
            .select('balance, verified')
            .eq('id', req.user.id)
            .single();

        if (error) throw error;
        res.json({ success: true, privateData: creator });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------------------------
// 5. WEBHOOK unificado: pagos únicos + suscripciones + cobros recurrentes
// ---------------------------------------------------------------------------
router.post('/webhook', async (req, res) => {
    // Respondemos 200 inmediatamente (MP lo exige)
    res.sendStatus(200);

    try {
        const { type, data } = req.body;
        const eventType = type || req.query.type;
        const eventId = data?.id || req.query.id;

        if (!eventId) return;

        // -------- Pago único o primer cobro de suscripción --------
        if (eventType === 'payment') {
            const paymentClient = new Payment(mpClient);
            const paymentInfo = await paymentClient.get({ id: eventId });

            if (paymentInfo.status !== 'approved') return;

            const externalRef = paymentInfo.external_reference;
            if (!externalRef) return;

            // ¿Es pago único?
            const { data: tx } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', externalRef)
                .single();

            if (tx && tx.status === 'pending') {
                // Tomamos el fee REAL que informó MP
                const realMpFee = paymentInfo.fee_details
                    ?.reduce((acc, f) => acc + (f.amount || 0), 0) || tx.mp_fee;

                const platformFee = +((tx.gross_amount - realMpFee) * (PLATFORM_FEE_PERCENT / 100)).toFixed(2);
                const netAmount = +(tx.gross_amount - realMpFee - platformFee).toFixed(2);

                // 1) Actualizar transacción
                await supabase
                    .from('transactions')
                    .update({
                        status: 'approved',
                        mp_payment_id: eventId.toString(),
                        mp_fee: realMpFee,
                        platform_fee: platformFee,
                        net_amount: netAmount
                    })
                    .eq('id', tx.id);

                // 2) Acreditar saldo al creador (ÚNICA acreditación)
                const { data: creator } = await supabase
                    .from('creators')
                    .select('balance')
                    .eq('id', tx.creator_id)
                    .single();

                if (creator) {
                    await supabase
                        .from('creators')
                        .update({ balance: parseFloat(creator.balance) + netAmount })
                        .eq('id', tx.creator_id);
                }
            }
        }

        // -------- Ciclo de vida de una suscripción --------
        if (eventType === 'subscription_preapproval') {
            const preapprovalClient = new PreApproval(mpClient);
            const preapprovalInfo = await preapprovalClient.get({ id: eventId });

            await supabase
                .from('subscriptions')
                .update({
                    status: preapprovalInfo.status,
                    next_payment_date: preapprovalInfo.next_payment_date || null,
                    updated_at: new Date().toISOString()
                })
                .eq('preapproval_id', eventId);
        }

        // -------- Cobro mensual de una suscripción autorizada --------
        if (eventType === 'subscription_authorized_payment') {
            const paymentClient = new Payment(mpClient);
            // eventId es el id del "authorized_payment"; el detalle real del pago
            // viene en el endpoint de preapproval, pero MP también lo expone vía /v1/payments
            const paymentInfo = await paymentClient.get({ id: eventId }).catch(() => null);

            if (!paymentInfo || paymentInfo.status !== 'approved') return;

            const preapprovalId = paymentInfo.metadata?.preapproval_id || paymentInfo.external_reference;
            if (!preapprovalId) return;

            const { data: sub } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('preapproval_id', preapprovalId)
                .single();

            if (!sub) return;

            const realMpFee = paymentInfo.fee_details
                ?.reduce((acc, f) => acc + (f.amount || 0), 0) || 0;
            const platformFee = +((paymentInfo.transaction_amount - realMpFee) * (PLATFORM_FEE_PERCENT / 100)).toFixed(2);
            const netAmount = +(paymentInfo.transaction_amount - realMpFee - platformFee).toFixed(2);

            // Registrar el cobro recurrente (idempotente por mp_payment_id)
            await supabase
                .from('recurring_payments')
                .upsert([{
                    subscription_id: sub.id,
                    mp_payment_id: eventId.toString(),
                    amount: paymentInfo.transaction_amount,
                    status: 'approved'
                }], { onConflict: 'mp_payment_id' });

            // Acreditar al creador
            const { data: creator } = await supabase
                .from('creators')
                .select('balance')
                .eq('id', sub.creator_id)
                .single();

            if (creator) {
                await supabase
                    .from('creators')
                    .update({ balance: parseFloat(creator.balance) + netAmount })
                    .eq('id', sub.creator_id);
            }
        }
    } catch (err) {
        console.error('❌ Error en webhook:', err.message);
    }
});

module.exports = router;
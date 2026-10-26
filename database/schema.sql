-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Creadores (Perfiles Públicos)
CREATE TABLE creators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    coffee_price NUMERIC(10, 2) DEFAULT 1500.00,
    mp_access_token TEXT,
    balance NUMERIC(12, 2) DEFAULT 0.00,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Planes de Suscripción Mensual
CREATE TABLE subscription_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    benefits JSONB NOT NULL,
    is_popular BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Transacciones (pagos únicos + primer pago de suscripción)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
    supporter_name TEXT DEFAULT 'Anónimo',
    supporter_email TEXT,
    message TEXT,
    type TEXT CHECK (type IN ('one_time', 'subscription')) NOT NULL,
    gross_amount NUMERIC(10, 2) NOT NULL,
    platform_fee NUMERIC(10, 2) NOT NULL,
    mp_fee NUMERIC(10, 2) DEFAULT 0,
    net_amount NUMERIC(10, 2) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    mp_payment_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ÍNDICE ÚNICO para idempotencia de webhooks (evita procesar dos veces el mismo pago)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_mp_payment_id
    ON transactions(mp_payment_id)
    WHERE mp_payment_id IS NOT NULL;

-- 4. NUEVA: Suscripciones recurrentes (Preapproval de Mercado Pago)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
    tier_id UUID REFERENCES subscription_tiers(id),
    supporter_email TEXT NOT NULL,
    supporter_name TEXT,
    preapproval_id TEXT UNIQUE NOT NULL,   -- ID de Mercado Pago
    status TEXT CHECK (status IN ('pending', 'authorized', 'paused', 'cancelled')) DEFAULT 'pending',
    amount NUMERIC(10, 2) NOT NULL,
    next_payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. NUEVA: Cobros mensuales de cada suscripción
CREATE TABLE recurring_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    mp_payment_id TEXT UNIQUE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT CHECK (status IN ('approved', 'rejected', 'pending')) DEFAULT 'pending',
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
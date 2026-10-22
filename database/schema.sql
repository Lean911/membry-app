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

-- 2. Tabla de Planes de Suscripción Mensual
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

-- 3. Tabla de Transacciones (Cafecitos únicos y cobros de suscripciones)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
    supporter_name TEXT DEFAULT 'Anónimo',
    supporter_email TEXT,
    message TEXT,
    type TEXT CHECK (type IN ('one_time', 'subscription')) NOT NULL,
    gross_amount NUMERIC(10, 2) NOT NULL,
    platform_fee NUMERIC(10, 2) NOT NULL,
    net_amount NUMERIC(10, 2) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    mp_payment_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar un creador y planes de prueba
INSERT INTO creators (id, username, display_name, bio, avatar_url, coffee_price, balance, verified)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'sofiadev',
    'Sofía Rostova',
    'Diseño de interfaces, recursos de código y comunidad exclusiva para creadores digitales.',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    5.00,
    1450.00,
    true
);

INSERT INTO subscription_tiers (creator_id, name, price, benefits, is_popular)
VALUES 
(
    '11111111-1111-1111-1111-111111111111',
    'Comunidad VIP',
    9.99,
    '["Acceso al canal privado de Telegram", "Plantillas y recursos descargables mensuales", "Votación de próximos contenidos"]',
    true
),
(
    '11111111-1111-1111-1111-111111111111',
    'Inner Circle + Mentoría',
    24.99,
    '["Todo lo incluido en el plan VIP", "Sesión grupal en vivo 1 vez al mes", "Feedback directo a tus proyectos"]',
    false
);
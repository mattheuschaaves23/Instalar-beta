CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  logo TEXT,
  installer_photo TEXT,
  installation_gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  certificate_file TEXT,
  certificate_name VARCHAR(180),
  certification_verified BOOLEAN NOT NULL DEFAULT FALSE,
  featured_installer BOOLEAN NOT NULL DEFAULT FALSE,
  document_type VARCHAR(20),
  document_id VARCHAR(60),
  emergency_contact VARCHAR(140),
  emergency_phone VARCHAR(30),
  safety_notes TEXT,
  accepts_service_contract BOOLEAN NOT NULL DEFAULT TRUE,
  provides_warranty BOOLEAN NOT NULL DEFAULT TRUE,
  warranty_days INTEGER NOT NULL DEFAULT 90,
  default_price_per_roll NUMERIC(10, 2) DEFAULT 0,
  default_removal_price NUMERIC(10, 2) DEFAULT 0,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(150),
  street VARCHAR(160),
  house_number VARCHAR(30),
  neighborhood VARCHAR(120),
  city VARCHAR(120),
  state VARCHAR(80),
  zip_code VARCHAR(20),
  address_reference TEXT,
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  pricing_mode VARCHAR(20) NOT NULL DEFAULT 'roll',
  price_per_roll NUMERIC(10, 2) DEFAULT 0,
  price_per_square_meter NUMERIC(10, 2) DEFAULT 0,
  total_rolls INTEGER DEFAULT 0,
  total_area NUMERIC(10, 2) DEFAULT 0,
  subtotal_rolls NUMERIC(10, 2) DEFAULT 0,
  removal_cost NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) DEFAULT 0,
  installment_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  installments_count INTEGER NOT NULL DEFAULT 1,
  approved_date TIMESTAMP,
  schedule_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS environments (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  height NUMERIC(10, 2) NOT NULL,
  width NUMERIC(10, 2) NOT NULL,
  area NUMERIC(10, 2) DEFAULT 0,
  rolls_auto INTEGER DEFAULT 0,
  rolls_manual INTEGER,
  price_per_square_meter NUMERIC(10, 2) DEFAULT 0,
  removal_included BOOLEAN NOT NULL DEFAULT FALSE,
  removal_price NUMERIC(10, 2) DEFAULT 0,
  removal_total NUMERIC(10, 2) DEFAULT 0,
  price_per_roll NUMERIC(10, 2) DEFAULT 0,
  total NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(30) NOT NULL DEFAULT 'monthly',
  status VARCHAR(20) NOT NULL DEFAULT 'inactive',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  method VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  external_id VARCHAR(120) UNIQUE,
  provider VARCHAR(50) NOT NULL DEFAULT 'manual',
  provider_payment_id VARCHAR(120),
  pix_qr_code TEXT,
  pix_copy_paste TEXT,
  provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget_id INTEGER REFERENCES budgets(id) ON DELETE SET NULL,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  date TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  service_street VARCHAR(160),
  service_number VARCHAR(30),
  service_neighborhood VARCHAR(120),
  service_city VARCHAR(120),
  service_state VARCHAR(80),
  service_zip_code VARCHAR(20),
  service_reference TEXT,
  service_full_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS installer_reviews (
  id SERIAL PRIMARY KEY,
  installer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewer_name VARCHAR(120) NOT NULL,
  reviewer_region VARCHAR(160),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  reviewer_ip VARCHAR(64),
  reviewer_fingerprint VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DELETE FROM installer_reviews a
USING installer_reviews b
WHERE a.id < b.id
  AND a.installer_id = b.installer_id
  AND a.reviewer_user_id = b.reviewer_user_id
  AND a.reviewer_user_id IS NOT NULL;

DELETE FROM installer_reviews a
USING installer_reviews b
WHERE a.id < b.id
  AND a.installer_id = b.installer_id
  AND a.reviewer_fingerprint = b.reviewer_fingerprint
  AND a.reviewer_fingerprint IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS installer_reviews_unique_user_idx
  ON installer_reviews (installer_id, reviewer_user_id)
  WHERE reviewer_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS installer_reviews_unique_fingerprint_idx
  ON installer_reviews (installer_id, reviewer_fingerprint)
  WHERE reviewer_fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS installer_availability_slots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT installer_availability_slot_time_check CHECK (end_time > start_time),
  CONSTRAINT installer_availability_slot_unique UNIQUE (user_id, slot_date, start_time)
);

CREATE TABLE IF NOT EXISTS support_conversations (
  id SERIAL PRIMARY KEY,
  installer_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_from_admin BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_ideas (
  id SERIAL PRIMARY KEY,
  installer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'feature',
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  admin_note TEXT,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recommended_stores (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  cta_label VARCHAR(80) NOT NULL DEFAULT 'Visitar loja',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  event_id VARCHAR(160) NOT NULL,
  event_type VARCHAR(60),
  provider_payment_id VARCHAR(120),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80),
  entity_id VARCHAR(100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64),
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'manual';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(120);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name VARCHAR(160);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_region VARCHAR(180);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS installation_method TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS installation_days TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS service_hours TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS base_service_cost NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS travel_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_goal NUMERIC(10, 2) NOT NULL DEFAULT 5000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_profile BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS years_experience INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallpaper_store_recommended BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS installer_photo TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS installation_gallery JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS certificate_file TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS certificate_name VARCHAR(180);
ALTER TABLE users ADD COLUMN IF NOT EXISTS certification_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS featured_installer BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS document_type VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS document_id VARCHAR(60);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(140);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS safety_notes TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepts_service_contract BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provides_warranty BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS warranty_days INTEGER NOT NULL DEFAULT 90;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20) NOT NULL DEFAULT 'roll';
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS price_per_roll NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS price_per_square_meter NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS installment_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS installments_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS street VARCHAR(160);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS house_number VARCHAR(30);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(120);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city VARCHAR(120);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS state VARCHAR(80);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_reference TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_street VARCHAR(160);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_number VARCHAR(30);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_neighborhood VARCHAR(120);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_city VARCHAR(120);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_state VARCHAR(80);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_zip_code VARCHAR(20);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_reference TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS service_full_address TEXT;
ALTER TABLE environments ADD COLUMN IF NOT EXISTS price_per_square_meter NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE environments ADD COLUMN IF NOT EXISTS removal_included BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE environments ADD COLUMN IF NOT EXISTS removal_price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE environments ADD COLUMN IF NOT EXISTS removal_total NUMERIC(10, 2) DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_id_idx
  ON payments (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS installer_reviews_installer_id_idx
  ON installer_reviews (installer_id, created_at DESC);


CREATE INDEX IF NOT EXISTS users_public_profile_idx
  ON users (public_profile, city, state);

CREATE INDEX IF NOT EXISTS users_featured_installer_idx
  ON users (featured_installer, certification_verified, public_profile);

CREATE INDEX IF NOT EXISTS support_conversations_last_message_idx
  ON support_conversations (last_message_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS support_messages_conversation_idx
  ON support_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS support_messages_unread_idx
  ON support_messages (conversation_id, is_from_admin, read_at);

CREATE INDEX IF NOT EXISTS support_ideas_installer_idx
  ON support_ideas (installer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS support_ideas_status_idx
  ON support_ideas (status, created_at DESC);

CREATE INDEX IF NOT EXISTS recommended_stores_active_order_idx
  ON recommended_stores (is_active, sort_order ASC, created_at DESC);

ALTER TABLE installer_reviews ADD COLUMN IF NOT EXISTS reviewer_ip VARCHAR(64);
ALTER TABLE installer_reviews ADD COLUMN IF NOT EXISTS reviewer_fingerprint VARCHAR(80);
ALTER TABLE installer_reviews ADD COLUMN IF NOT EXISTS reviewer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS installer_reviews_fingerprint_idx
  ON installer_reviews (installer_id, reviewer_fingerprint, created_at DESC)
  WHERE reviewer_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS installer_reviews_ip_idx
  ON installer_reviews (installer_id, reviewer_ip, created_at DESC)
  WHERE reviewer_ip IS NOT NULL;

CREATE INDEX IF NOT EXISTS installer_reviews_user_idx
  ON installer_reviews (installer_id, reviewer_user_id, created_at DESC)
  WHERE reviewer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON password_reset_tokens (user_id, expires_at DESC, used_at);

CREATE INDEX IF NOT EXISTS installer_availability_slots_lookup_idx
  ON installer_availability_slots (user_id, slot_date, start_time)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS payment_webhook_events_provider_idx
  ON payment_webhook_events (provider, provider_payment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON audit_logs (actor_user_id, created_at DESC);

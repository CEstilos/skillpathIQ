-- trainer_packages
CREATE TABLE IF NOT EXISTS trainer_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  session_count integer NOT NULL,
  price decimal(10,2) NOT NULL,
  price_per_session decimal(10,2) NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  is_most_popular boolean NOT NULL DEFAULT false,
  is_best_value boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- player_packages
CREATE TABLE IF NOT EXISTS player_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  package_id uuid NOT NULL REFERENCES trainer_packages(id) ON DELETE RESTRICT,
  sessions_total integer NOT NULL,
  sessions_remaining integer NOT NULL,
  sessions_used integer NOT NULL DEFAULT 0,
  price_paid decimal(10,2) NOT NULL,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid')),
  payment_method text NOT NULL DEFAULT 'venmo',
  expiry_start_date date,
  expiry_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  refund_eligible boolean NOT NULL DEFAULT true,
  expiry_reminder_sent boolean NOT NULL DEFAULT false,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add package columns to booking_requests
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES trainer_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS player_package_id uuid REFERENCES player_packages(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE trainer_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_packages ENABLE ROW LEVEL SECURITY;

-- trainer_packages: publicly readable (booking form needs it)
CREATE POLICY "trainer_packages_public_read" ON trainer_packages
  FOR SELECT USING (true);
CREATE POLICY "trainer_packages_owner_all" ON trainer_packages
  FOR ALL USING (auth.uid() = trainer_id);

-- player_packages: trainer only
CREATE POLICY "player_packages_trainer_all" ON player_packages
  FOR ALL USING (auth.uid() = trainer_id);

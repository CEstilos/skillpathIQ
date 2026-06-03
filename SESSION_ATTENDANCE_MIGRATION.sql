-- session_attendance_requests
CREATE TABLE IF NOT EXISTS session_attendance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_package_id uuid REFERENCES player_packages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, session_id)
);

ALTER TABLE session_attendance_requests ENABLE ROW LEVEL SECURITY;

-- Trainer can read/update all requests for their players
CREATE POLICY "sar_trainer_all" ON session_attendance_requests
  FOR ALL USING (auth.uid() = trainer_id);

-- Allow public insert (validated server-side via API route — never trust client for trainer_id)
CREATE POLICY "sar_public_insert" ON session_attendance_requests
  FOR INSERT WITH CHECK (true);

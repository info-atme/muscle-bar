-- ============================================================
-- Muscle Bar Sofcho — Attendance Audit Log
-- ============================================================

CREATE TABLE attendance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'clock_in', 'clock_out', 'edit', 'approve', 'auto_clockout'
  changed_by uuid REFERENCES staff(id),
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE attendance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_log_select" ON attendance_log FOR SELECT
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
  );

CREATE POLICY "attendance_log_insert" ON attendance_log FOR INSERT
  WITH CHECK (true);

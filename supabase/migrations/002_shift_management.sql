-- ============================================================
-- Muscle Bar Sofcho — Shift Management Schema
-- ============================================================

-- 7. shift_preferences（希望シフト）
CREATE TABLE shift_preferences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      uuid NOT NULL REFERENCES staff(id),
  target_date   date NOT NULL,
  preference    text NOT NULL CHECK (preference IN ('available', 'unavailable', 'preferred')),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id, target_date)
);

-- 8. shift_assignments（確定シフト）
CREATE TABLE shift_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      uuid NOT NULL REFERENCES staff(id),
  target_date   date NOT NULL,
  status        text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'called_in', 'cancelled')),
  assigned_by   uuid REFERENCES staff(id),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id, target_date)
);

-- 9. attendance（出退勤記録）
CREATE TABLE attendance (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      uuid NOT NULL REFERENCES staff(id),
  target_date   date NOT NULL,
  clock_in      timestamptz,
  clock_out     timestamptz,
  status        text NOT NULL DEFAULT 'working' CHECK (status IN ('working', 'completed', 'absent', 'late')),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id, target_date)
);

-- ============================================================
-- Row Level Security
-- ============================================================

-- shift_preferences
ALTER TABLE shift_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_preferences_select" ON shift_preferences FOR SELECT
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
    OR staff_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "shift_preferences_insert" ON shift_preferences FOR INSERT
  WITH CHECK (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
    OR staff_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "shift_preferences_update" ON shift_preferences FOR UPDATE
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
    OR staff_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
  );

-- shift_assignments
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_assignments_select" ON shift_assignments FOR SELECT
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
    OR staff_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "shift_assignments_insert" ON shift_assignments FOR INSERT
  WITH CHECK (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
  );

CREATE POLICY "shift_assignments_update" ON shift_assignments FOR UPDATE
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
  );

CREATE POLICY "shift_assignments_delete" ON shift_assignments FOR DELETE
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
  );

-- attendance
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select" ON attendance FOR SELECT
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
    OR staff_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "attendance_insert" ON attendance FOR INSERT
  WITH CHECK (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
    OR staff_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "attendance_update" ON attendance FOR UPDATE
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
    OR staff_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
  );

-- ============================================================
-- updated_at自動更新トリガー（既存の update_updated_at() を再利用）
-- ============================================================

CREATE TRIGGER shift_preferences_updated_at
  BEFORE UPDATE ON shift_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER shift_assignments_updated_at
  BEFORE UPDATE ON shift_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

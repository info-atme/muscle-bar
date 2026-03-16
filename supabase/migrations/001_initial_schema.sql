-- ============================================================
-- Muscle Bar Sofcho — Initial Schema
-- ============================================================

-- 1. staff（スタッフマスター）
CREATE TABLE staff (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid REFERENCES auth.users(id),
  name          text NOT NULL,
  role          text NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  back_op       numeric NOT NULL DEFAULT 0.30,
  back_kanpai   numeric NOT NULL DEFAULT 0.30,
  back_tip      numeric NOT NULL DEFAULT 0.40,
  back_champagne numeric NOT NULL DEFAULT 0.20,
  back_orichan  numeric NOT NULL DEFAULT 0.30,
  line_user_id  text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. daily_summary（日次売上サマリー）
CREATE TABLE daily_summary (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date           date NOT NULL UNIQUE,
  cash_amount    integer NOT NULL DEFAULT 0,
  card_amount    integer NOT NULL DEFAULT 0,
  total_amount   integer GENERATED ALWAYS AS (cash_amount + card_amount) STORED,
  group_count    integer NOT NULL DEFAULT 0,
  guest_count    integer NOT NULL DEFAULT 0,
  male_count     integer NOT NULL DEFAULT 0,
  female_count   integer NOT NULL DEFAULT 0,
  new_count      integer NOT NULL DEFAULT 0,
  repeat_count   integer NOT NULL DEFAULT 0,
  weather        text,
  entered_by     uuid REFERENCES staff(id),
  approved_by    uuid REFERENCES staff(id),
  approved_at    timestamptz,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 3. staff_performance（スタッフ別OP実績）
-- back_totalは承認時にアプリ側で計算してUPDATEする（generated columnにしない）
CREATE TABLE staff_performance (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_summary_id    uuid NOT NULL REFERENCES daily_summary(id) ON DELETE CASCADE,
  staff_id            uuid NOT NULL REFERENCES staff(id),
  op_count            integer NOT NULL DEFAULT 0,
  kanpai_count        integer NOT NULL DEFAULT 0,
  tip_amount          integer NOT NULL DEFAULT 0,
  champagne_amount    integer NOT NULL DEFAULT 0,
  orichan_amount      integer NOT NULL DEFAULT 0,
  back_total          integer NOT NULL DEFAULT 0,
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(daily_summary_id, staff_id)
);

-- 4. events（イベント・企画管理）
CREATE TABLE events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  event_date          date,
  budget              integer,
  kpi                 jsonb,
  checklist           jsonb,
  notify_recipients   jsonb,
  status              text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'done')),
  is_template         boolean NOT NULL DEFAULT false,
  created_by          uuid REFERENCES staff(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 5. tasks（タスク管理）
CREATE TABLE tasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  assigned_to         uuid REFERENCES staff(id),
  event_id            uuid REFERENCES events(id),
  due_date            date,
  priority            text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal')),
  status              text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  notify_recipients   jsonb,
  note                text,
  created_by          uuid REFERENCES staff(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 6. notification_rules（通知ルール定義）
CREATE TABLE notification_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type      text NOT NULL,
  trigger_value     jsonb,
  send_time         time,
  recipients        jsonb NOT NULL,
  message_template  text NOT NULL,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ビュー: staff_performance_public
-- managerがback_totalを見えないようにするビュー
-- ============================================================
CREATE VIEW staff_performance_public AS
SELECT
  sp.id,
  sp.daily_summary_id,
  sp.staff_id,
  sp.op_count,
  sp.kanpai_count,
  sp.tip_amount,
  sp.champagne_amount,
  sp.orichan_amount,
  sp.note,
  sp.created_at,
  CASE
    WHEN s_viewer.role = 'owner' THEN sp.back_total
    WHEN s_viewer.role = 'staff' AND sp.staff_id = s_viewer.id THEN sp.back_total
    ELSE NULL
  END AS back_total
FROM staff_performance sp
CROSS JOIN (
  SELECT id, role FROM staff WHERE auth_user_id = auth.uid()
) s_viewer;

-- ============================================================
-- Row Level Security
-- ============================================================

-- staff
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select" ON staff FOR SELECT
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
    OR auth_user_id = auth.uid()
  );

CREATE POLICY "staff_insert" ON staff FOR INSERT
  WITH CHECK (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) = 'owner'
  );

CREATE POLICY "staff_update" ON staff FOR UPDATE
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) = 'owner'
  );

CREATE POLICY "staff_delete" ON staff FOR DELETE
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) = 'owner'
  );

-- daily_summary
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_summary_select" ON daily_summary FOR SELECT
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager', 'staff')
  );

CREATE POLICY "daily_summary_insert" ON daily_summary FOR INSERT
  WITH CHECK (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
  );

CREATE POLICY "daily_summary_update" ON daily_summary FOR UPDATE
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
  );

-- staff_performance
ALTER TABLE staff_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_performance_select" ON staff_performance FOR SELECT
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
    OR staff_id = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "staff_performance_insert" ON staff_performance FOR INSERT
  WITH CHECK (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
  );

CREATE POLICY "staff_performance_update" ON staff_performance FOR UPDATE
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
  );

-- tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON tasks FOR SELECT
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
    OR assigned_to = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "tasks_insert" ON tasks FOR INSERT
  WITH CHECK (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
  );

CREATE POLICY "tasks_update" ON tasks FOR UPDATE
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
    OR assigned_to = (SELECT id FROM staff WHERE auth_user_id = auth.uid())
  );

-- events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select" ON events FOR SELECT
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager', 'staff')
  );

CREATE POLICY "events_insert" ON events FOR INSERT
  WITH CHECK (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
  );

CREATE POLICY "events_update" ON events FOR UPDATE
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) IN ('owner', 'manager')
  );

-- notification_rules
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_rules_select" ON notification_rules FOR SELECT
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) = 'owner'
  );

CREATE POLICY "notification_rules_insert" ON notification_rules FOR INSERT
  WITH CHECK (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) = 'owner'
  );

CREATE POLICY "notification_rules_update" ON notification_rules FOR UPDATE
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) = 'owner'
  );

CREATE POLICY "notification_rules_delete" ON notification_rules FOR DELETE
  USING (
    (SELECT role FROM staff WHERE auth_user_id = auth.uid()) = 'owner'
  );

-- ============================================================
-- updated_at自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_summary_updated_at
  BEFORE UPDATE ON daily_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

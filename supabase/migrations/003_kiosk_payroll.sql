-- ============================================================
-- Muscle Bar Sofcho — Kiosk & Payroll Schema
-- ============================================================

-- staffテーブルにPINと時給を追加
ALTER TABLE staff ADD COLUMN IF NOT EXISTS pin text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS hourly_rate integer NOT NULL DEFAULT 1200;

-- daily_summaryに編集・差し戻し対応
-- statusを拡張（既存のCHECK制約を変更）
ALTER TABLE daily_summary DROP CONSTRAINT IF EXISTS daily_summary_status_check;
ALTER TABLE daily_summary ADD CONSTRAINT daily_summary_status_check
  CHECK (status IN ('draft', 'approved', 'rejected'));

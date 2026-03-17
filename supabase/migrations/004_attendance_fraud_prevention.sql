-- ============================================================
-- Muscle Bar Sofcho — Attendance Fraud Prevention
-- ============================================================

-- GPS座標、写真URL、承認フラグを出勤記録に追加
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES staff(id);

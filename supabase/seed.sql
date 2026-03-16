-- ============================================================
-- Seed Data — Muscle Bar Sofcho
-- ============================================================

-- スタッフ初期データ（auth_user_idは実際のSupabase Auth登録後に更新する）
INSERT INTO staff (name, role, back_op, back_kanpai, back_tip, back_champagne, back_orichan) VALUES
  ('神谷', 'owner', 0.30, 0.30, 0.40, 0.20, 0.30),
  ('まさはる', 'manager', 0.30, 0.30, 0.40, 0.20, 0.30),
  ('當間', 'manager', 0.30, 0.30, 0.40, 0.20, 0.30);

-- 通知ルール初期データ
INSERT INTO notification_rules (trigger_type, send_time, recipients, message_template, is_active) VALUES
  (
    'daily_summary',
    '23:30',
    '["owner"]',
    '【売上速報】{{date}}の売上\n合計: ¥{{total}}\n現金: ¥{{cash}} / カード: ¥{{card}}\n来客数: {{guests}}名（{{groups}}組）',
    true
  ),
  (
    'missing_input',
    '08:00',
    '["manager"]',
    '⚠️ {{date}}の日次入力がまだ完了していません。早めに入力をお願いします。',
    true
  ),
  (
    'task_due',
    '09:00',
    '["assigned"]',
    '📋 タスク「{{title}}」の期限が{{days_until}}日後です。',
    true
  ),
  (
    'event_before',
    '09:00',
    '["notify_recipients"]',
    '🎉 イベント「{{title}}」が{{days_until}}日後に開催されます。準備状況を確認してください。',
    true
  ),
  (
    'back_confirmed',
    '10:00',
    '["all_staff"]',
    '💰 {{month}}月のバック明細が確定しました。アプリで確認してください。',
    true
  );

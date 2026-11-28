-- Initial email provider allow list (DECISIONS "Email allow list", DEV-PLAN 5.1).
-- googlemail.com is not a row: the normaliser folds it into gmail.com before the lookup.
INSERT INTO email_domains (domain, display_name, rule, enabled, added_by) VALUES
  ('gmail.com',     'Gmail',          'gmail', true, 'migration'),
  ('naver.com',     'Naver',          'plus',  true, 'migration'),
  ('kakao.com',     'Kakao',          'plus',  true, 'migration'),
  ('daum.net',      'Daum',           'plus',  true, 'migration'),
  ('hanmail.net',   'Hanmail',        'plus',  true, 'migration'),
  ('icloud.com',    'iCloud',         'plus',  true, 'migration'),
  ('outlook.com',   'Outlook',        'plus',  true, 'migration'),
  ('hotmail.com',   'Hotmail',        'plus',  true, 'migration'),
  ('yahoo.co.jp',   'Yahoo! JAPAN',   'plus',  true, 'migration')
ON CONFLICT (domain) DO NOTHING;

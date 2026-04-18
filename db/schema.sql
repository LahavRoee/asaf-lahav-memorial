-- ═══════════════════════════════════════════
-- Supabase Schema — Asaf Lahav Memorial
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════

-- 1. Memories (approved, public)
CREATE TABLE memories (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type        TEXT NOT NULL,          -- 'photo' | 'video' | 'audio' | 'story' | 'social'
  author      TEXT NOT NULL,
  date_label  TEXT,                   -- free text like "אוקטובר 2024"
  text        TEXT,
  media_url   TEXT,                   -- Supabase Storage / R2 URL
  video_url   TEXT,                   -- YouTube / Vimeo link
  link_data   JSONB,                  -- [{url, label, sub, icon}]
  size_hint   TEXT DEFAULT '',        -- '' | 'wide' | 'tall' | 'large'
  pinned      BOOLEAN DEFAULT false,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Pending (submissions awaiting approval)
CREATE TABLE pending (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type         TEXT NOT NULL,
  author       TEXT NOT NULL,
  text         TEXT,
  media_url    TEXT,
  video_url    TEXT,
  link_data    JSONB,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  status       TEXT DEFAULT 'pending'  -- 'pending' | 'approved' | 'rejected'
);

-- 3. Comments
CREATE TABLE comments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  memory_id  UUID REFERENCES memories(id) ON DELETE CASCADE,
  author     TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Likes (fingerprint = simple browser ID)
CREATE TABLE likes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  memory_id   UUID REFERENCES memories(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(memory_id, fingerprint)
);

-- ═══ Row Level Security ═══

-- memories: everyone reads, no direct writes
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_memories" ON memories FOR SELECT USING (true);

-- pending: everyone inserts, no one reads (except via service key)
ALTER TABLE pending ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_insert_pending" ON pending FOR INSERT WITH CHECK (true);

-- comments: everyone reads and inserts
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_comments" ON comments FOR SELECT USING (true);
CREATE POLICY "anyone_insert_comments" ON comments FOR INSERT WITH CHECK (true);

-- likes: everyone reads and inserts
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_likes" ON likes FOR SELECT USING (true);
CREATE POLICY "anyone_insert_likes" ON likes FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone_delete_own_likes" ON likes FOR DELETE USING (true);

-- ═══ Indexes ═══
CREATE INDEX idx_comments_memory ON comments(memory_id);
CREATE INDEX idx_likes_memory ON likes(memory_id);
CREATE INDEX idx_pending_status ON pending(status);
CREATE INDEX idx_memories_type ON memories(type);


-- ═══════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════

INSERT INTO memories (type, author, date_label, text, media_url, pinned, size_hint, sort_order) VALUES
('photo', 'המשפחה', '11.10.2022', 'אסי שלנו. תמיד עם החיוך, תמיד עם הסטייל.',
 'https://www.storyofmylife.co.il/wp-content/uploads/2024/10/asaf-lahav-1-e1728282678324.jpeg',
 true, 'large', 1);

INSERT INTO memories (type, author, date_label, text, media_url, size_hint, sort_order) VALUES
('photo', 'המשפחה', '11.10.2022', '',
 'https://www.storyofmylife.co.il/wp-content/uploads/2024/10/asaf-lahav-2-e1728282660773.jpeg',
 'wide', 2);

INSERT INTO memories (type, author, date_label, text, size_hint, sort_order) VALUES
('story', 'מרינה להב — אשתו', 'אוקטובר 2024',
 E'האיש שלי, אסף להב (אסי)\nובכינויו הידוע — מאשמוש שלי 💜\n\nבמאי 2007, כשאני בת 22 ואסי בן 25 הכרנו במועדון הסיילו, בניו יורק, על רחבת הריקודים. ראיתי בחור גבוה, רזה ושיער מלא קוצים, פשוט חתיך! החלפנו מספרים ואחרי חודשיים של הכרות הוא עבר לגור איתי ועם השותפה שלי בקווינס. זה היה פשוט meant to be 💜\n\nבמרץ 2008 חזרנו לארץ, וב-16/08/2009 התחתנו. מיד אחרי החתונה עברנו לקריות, הקמנו משפחה לתפארת ונולדו לנו שני ילדים, דורין וירין.\n\nאסי היה איש מיוחד ואהוב על כולם. אין מקום שהוא לא היה נכנס אליו והיו רואים את ההילה שסביבו. הוא היה מצחיק, שנון ושטותניק מלידה. תמיד צוחק ומצחיק את כולם, תמיד מקליל את האווירה עם איזו פנינה שיוצאת לו מהפה.\n\nולא הרבה יודעים שאסף גם היה מחובר מאוד לדת — היה מניח תפילין כל בוקר, קידוש בימי שישי, אהב ללכת לבית כנסת בחגים. הוא היה עמוד התווך של הבית.\n\nמאשמוש שלי, עברו שנתיים והלב עדיין מסרב להאמין. אין יום שאני לא חושבת עליך.\n\nאוהבת אותך תמיד ומתגעגעת — אישתך 💜',
 'tall', 3);

INSERT INTO memories (type, author, date_label, text, size_hint, sort_order) VALUES
('story', 'עדי להב — אחותו', 'אוקטובר 2024',
 E'אסף יוסף שלנו, אסי שלי, אחי האהוב.\n\nאנחנו עוד רגע מציינים שנתיים בלעדייך ואני כנראה לעולם לא אצליח להבין איך העולם הזה ממשיך להתקיים כשאתה כבר לא חלק ממנו.\n\nזה כואב. כואב שאתה לא כאן. כואב לדבר עלייך בלשון עבר.\n\nאתה מסוג האנשים שפשוט חייב להכיר מקרוב. כי כמה שלא נדבר ונספר עלייך לכל אלו שלא זכו להכיר אותך — הם לעולם לא יצליחו להבין איזה אדם הכי מיוחד שאתה. האדם הכי נחוץ והכי חשוב שחייב להמשיך להישאר כאן.\n\nבשנתיים האחרונות ניסיתי למצוא תשובות לאובדן שלך. נאחזתי בכל זיכרון שעלה, חיכיתי לך בחלומות. הצלחתי להרגיש אותך בכל ירח מלא שהסתכלתי עליו. בכל כוכב שנצנץ קצת יותר מכל אחד אחר — בלב שלי הרגשתי שזה אתה פה איתי.\n\nאוהבת אותך לעד. עד אחרי הנצח.\nתהיה נשמתך צרורה בצרור החיים 💙',
 'tall', 4);

INSERT INTO memories (type, author, date_label, text, size_hint, sort_order) VALUES
('story', 'רועי להב — אחיו', 'אוקטובר 2024',
 E'לא הצלחתי לכתוב עליך שנתיים, וגם עכשיו זה מרגיש כאילו — למה בעצם לכתוב עליך?\n\nויש לי פער.\nפער בגובה 1.80 מ׳, חתיך עם קוצים.\nפער בשיחות פשוטות.\nפער בעל-האש אצלך.\nפער בסיפור על לקוח שלך.\nפער בביקורים במשרד שלך.\nפער בקידוש שתמיד הובלת אצל אמא.\nפער בעצה טובה.\nפער בדאגה לדינה כשחלתה.\nעל הפער הזה יקח המון זמן לגשר.\n\nילד סנדביץ׳ שלנו — קשה להאמין שאתה לא איתנו.\nבהרגשה כאילו נסעת לטיול בחו״ל ותיכף נראה אותך.\nאין יום שאנחנו לא רואים אותך בין העיניים.\nנשמור על מרינה, דורין וירין.\n\nאוהבים ומתגעגעים. תבוא אלי בחלום 💔',
 '', 5);

INSERT INTO memories (type, author, date_label, text, size_hint, sort_order) VALUES
('story', 'סיפור חייו', '1982 — 2022',
 E'אסף יוסף להב, אסי, היה אדם שאי אפשר לסכם.\n\nבן ארבעים והספיק כל כך הרבה — אב, בעל, בן, אח, דוד וחבר. כבר מילדותו קשה היה לפספס אותו — ילד שובב ובלגניסט, תמיד ידע איך להצחיק את הסובבים אותו ולהפוך כל רגע למשעשע בזכות צחוקו המתגלגל.\n\nואי אפשר לשכוח את הסטייל הייחודי שלו — קוצים בשיער עם טון של ג׳ל. זו הייתה מעין חתימה אישית שלו.\n\nבבגרותו אסי בחר בדרך העצמאית. הוא התמקד בתחום ייעוץ משכנתאות — במשך 12 שנים בנה מוניטין דרך המלצות של לקוחות מרוצים. כיועץ מוביל, היה ידוע בתואר "מלך המסורבים" — ניחן ביכולת מופלאה לעזור לאנשים להשיג את חלום הבית שלהם, גם כשנראה היה שכל הדלתות נסגרו.\n\nאסי, אנחנו אוהבים לעד. יהי זכרך ברוך.',
 'wide', 6);

INSERT INTO memories (type, author, date_label, text, link_data, size_hint, sort_order) VALUES
('social', 'פייסבוק', '', 'עמודי הפייסבוק של אסי — שיחות, תמונות, חיים.',
 '[{"url":"https://www.facebook.com/asaflahav23","label":"אסף להב בפייסבוק","sub":"הפרופיל האישי שלו","icon":"fb"},{"url":"https://www.facebook.com/asaflahav111/","label":"זוכרים את אסף להב","sub":"עמוד הזיכרון הרשמי","icon":"fb"}]',
 '', 7);

INSERT INTO memories (type, author, date_label, text, link_data, size_hint, sort_order) VALUES
('social', 'אינסטגרם', '', '',
 '[{"url":"https://www.instagram.com/asafl23/","label":"@asafl23 באינסטגרם","sub":"תמונות וסרטונים מחייו","icon":"ig"}]',
 '', 8);

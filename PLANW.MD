الخطة

خطة شاملة لتطوير لعبة SUSAWI (UI/Presentation/Balance) — مسار “صقل v1” (4–6 أسابيع)
ملخص سريع
هدف الخطة: إطلاق v1 “مستقرة + ممتعة + متوازنة” للعبة اجتماعية pass-and-play (PWA) مع عرض سينمائي واضح، قواعد فوز متوازنة (Matrix)، وبنك كلمات قوي غير مكرر، مع تغطية اختبارية تمنع الرجوع للخلف.

قرارات مثبتة (حسب اختياراتك):

الأولوية: صقل v1 (UI/UX + العرض + التوازن + بنك الكلمات + اختبارات/إطلاق).
منطق الفوز: Matrix متوازن.
اللغات: Arabic-first (الإنجليزي لاحقًا/جزئيًا).
0) تعريف المنتج (قفل الرؤية + معايير النجاح)
0.1 مبادئ التجربة (Experience Pillars)
وضوح الفلو: اللاعب يعرف “أنا فين؟ أعمل إيه؟” في كل شاشة بدون شرح.
توتر محسوب: الكشف والتسليم والمراحل تبني “إحساس المهمة” بدون إزعاج/تأخير.
عدل + قابلية إعادة اللعب: كلمات/فئات غير متكررة، ونتيجة عادلة تعتمد على مهارة الفريقين.
موبايل أولًا + RTL ممتاز: لا تكسير على شاشات صغيرة، ونص عربي مقروء دائمًا.
0.2 تعريف “Done” للإطلاق
لا يوجد Crash / أخطاء Console في فلو الجولة الأساسي.
كل الشاشات الأساسية تعمل على Mobile (360×800) وDesktop (1280×720) مع RTL.
التوازن (على الأقل عبر playtests): معدل فوز الجواسيس ~45–55% عبر إعدادات افتراضية.
بنك الكلمات: لا تكرار داخل جلسة حتى نفاد الباك (wordUsage)، مع جودة تلميحات/Decoys مقبولة.
1) قواعد اللعبة والتوازن (Game Balance) — “Matrix متوازن”
التغيير هنا هو أهم نقطة “توازن” لأنها تغيّر معنى التصويت والمهارة.

1.1 منطق الفوز النهائي (قرار نهائي)
استخدم citizensIdentified = computeVoteOutcome() ونتيجة تخمين الجاسوس:

حالة التصويت	تخمين الجاسوس	الفائز
لم يتم كشف كل الجواسيس	(أي شيء)	Spies
تم كشف كل الجواسيس	صحيح	Spies
تم كشف كل الجواسيس	خطأ أو انتهى الوقت بدون تخمين	Citizens
سلوك الشاشات:

ResolutionScreen:
Stage Vote: كما هو (اختيار عدد = spyCount).
بعد Submit Vote:
لو missed: انتقل مباشرة لـ Stage Result مع رسالة واضحة: “فشل التصويت → الجواسيس كسبوا”.
لو captured: انتقل لـ Stage Guess مع Countdown.
Stage Guess:
لو اختار الجاسوس خيارًا: حسم فوري.
لو الوقت انتهى بدون اختيار: حسم تلقائي لصالح Citizens + الانتقال لـ Result.
سجل الجولة (completeActiveMatch) يسجّل النتيجة النهائية وفق نفس المنطق (بدون تباين بين UI والـ DB).
ملفات التغيير عند التنفيذ:

game-repository.ts (تحديث resolveWinner + الاستدعاءات).
ResolutionScreen.tsx (منطق الانتقال بين stages + timeout).
SummaryScreen.tsx (عرض رسائل النتيجة إن لزم).
game-repository.test.ts (تحديث/إضافة حالات الاختبار).
1.2 إعدادات افتراضية متوازنة (Defaults)
لاعبون 4–6: 1 Spy
لاعبون 7–10: 2 Spies
Discussion: 3 دقائق افتراضي (موجود).
Guess: 30 ثانية افتراضي (موجود) + تطبيق timeout فعلي.
UX في Setup:

في PlaySetupScreen: بعد اختيار عدد اللاعبين، اعرض “موصى به” بجانب اختيار الجواسيس، مع زر override.
1.3 توازن الكلمات/التلميحات/الاختيارات
Difficulty فعلي: حاليًا generate-word-pack.mjs يعيّن difficulty بالتناوب، وهذا غير كافي.
قواعد v1:
easy: كلمات ملموسة/مكان واضح + decoys قريبة جدًا.
medium: أقل مباشرة.
hard: كلمات متقاربة/مجازية + decoys مخادعة (لكن بدون غش).
في word-engine:
حافظ على عدم التكرار + توازن الفئات (موجود).
أضف وزنًا بسيطًا لتفادي اختيار نفس difficulty آخر 2 جولات (اختياري v1.1).
2) العرض وواجهة المستخدم (UI/Presentation)
2.1 خريطة UX (Information Architecture)
فلو أساسي ثابت:
Home → Setup → Reveal (handoff/reveal لكل لاعب) → Discussion → Resolution (vote → (guess?) → result) → Summary → (Replay/Home)

مبدأ: كل شاشة لها “Primary action واحدة” واضحة في PrimaryActionBar.

2.2 نظام تصميم (Design System) — تثبيت التوكنز
اعتماد base.css كمصدر الحقيقة:

توحيد: typography scale + line-heights (موجود جزئيًا).
إضافة/تثبيت توكنز: --space-*, --radius-*, --lh-*, ألوان accent/warn/danger/success.
تعريف حالات: data-contrast, data-density, وReduced motion (موجود).
قواعد تنفيذ ثابتة:

لا نضيف CSS عشوائي داخل screens؛ أي pattern يتكرر يذهب إلى components.css.
أي layout عام يذهب إلى layout.css.
2.3 “Cinematic Presentation” بدون بطء
الكشف (Reveal):
الحفاظ على hold-to-reveal state machine (موجود) + تحسين التوجيه النصي حسب المرحلة.
تطبيق accessibility per player بوضوح: تكبير/تباين أعلى داخل reveal card عند تفعيل خيارات اللاعب.
Discussion:
تحسين وضوح progress bar + تغيير لون تدريجي (warning عند آخر 20%).
Resolution:
توضيح “التصويت نجح/فشل” كـ StatusBanner مع نص قصير جدًا + ثم انتقال واضح للمرحلة التالية.
Home:
تثبيت CTA states (Start/Resume/Abort) مع نص عربي موجز.
2.4 صوت/هزاز (اختياري ضمن صقل v1)
بما إن في soundEnabled موجود:

v1: هزاز خفيف على الأزرار الأساسية (موجود جزئيًا).
v1.1: إضافة SFX بسيطة (tap/confirm/reveal/win/lose) + احترام Reduced motion وSound toggle.
3) بنك الكلمات (Content Pipeline) — Arabic-first
3.1 توحيد مصدر الحقيقة للبنك
حاليًا يوجد تضارب محتمل بين:

word-pack.json (ضخم/موجود)
generate-word-pack.mjs (يبدو أصغر)
قرار v1: البنك المستخدم في الإنتاج هو word-pack.json، والـ script يجب أن يصبح قادرًا على توليده فعليًا بنفس الحجم/المنطق.

3.2 أدوات ضمان الجودة (QA Scripts)
أضف (عند التنفيذ) سكريبتات في scripts/:

validate-word-pack.mjs:
كشف IDs مكررة
كشف كلمات مكررة بعد normalizeWord
التأكد من: hints >= 1، decoys >= 3، category غير فاضي، difficulty من القيم الصحيحة
تقرير توزيع الفئات/difficulty (Histogram)
sample-rounds.mjs:
يعمل محاكاة لاختيار كلمات 200 جولة ويطبع نسب الفئات/التكرار/النفاد
3.3 معايير المحتوى (Editorial Rules)
ممنوع decoys بعيدة جدًا (تخلي التخمين سهل أو مستحيل).
تلميح الجاسوس:
weak: عام جدًا (موجود في game-repository.ts)
normal: من الـ word pack (موجود)
off: “بدون تلميح” (موجود)
4) الجودة التقنية (PWA/Offline/Performance)
4.1 Offline-first حقيقي
الخطوط الآن من Google Fonts داخل base.css → هذا يكسر offline.
قرار v1: self-host fonts داخل public/fonts/ وتحديث CSS لاستخدامها + fallback.
تأكد أن Workbox precache يشمل fonts والصور والـ word-pack.
4.2 أداء تحميل بنك الكلمات
loadWordPack() يعمل fetch JSON كبير.
قرار v1: cache في الذاكرة (موجود) + إضافة cache في IndexedDB مع version:
لو payload.version تغيّر → امسح cache وخزن الجديد.
اعرض رسالة تحميل قصيرة في Setup عند أول تحميل فقط.
4.3 ثبات الـ DB migrations
Dexie versions موجودة حتى v3.
قرار v1: أي تغيير في schema يزيد version + يضيف migration واضحة، مع اختبار بسيط يفتح DB على نسخة أقدم (قدر الإمكان في vitest مع fake-indexeddb).
5) الاختبارات والتحقق (Testing & Validation) — وفق develop-web-game workflow
5.1 Unit/Component Tests (Vitest)
أضف/حدّث حالات:

resolveWinner وفق المصفوفة الجديدة.
timeout في guess: عندما يصل guessEndsAt للصفر بدون اختيار → winner citizens (captured) أو spies (missed).
اختبار يضمن أن ResolutionScreen ينتقل للمرحلة الصحيحة حسب نتيجة التصويت.
5.2 E2E / Visual sanity (Playwright client)
استخدم سكريبت skill:

يزور: / → /play/setup → اختيار لاعبين → بدء → reveal لعدة لاعبين → بدء نقاش → resolution vote → result/summary
في كل مرحلة: screenshot + window.render_game_to_text
راجع console errors (أول خطأ جديد يتصلّح قبل الاستمرار)
ملحوظة: window.advanceTime(ms) موجود في clock.ts وهذا ممتاز لتثبيت الاختبارات.

5.3 Acceptance checklist ثابت
RTL على 390px: لا overflow في Players/Setup/Reveal/Resolution.
كل CTA قابل للنقر بدون مشاكل “element unstable” (خصوصًا animation على زر start في Home).
لا يوجد اختلاف بين نتيجة UI والنتيجة المسجلة في matches.
6) جدول التنفيذ (4–6 أسابيع) — خطوات بدون قرارات إضافية
الأسبوع 1: التوازن الأساسي + قواعد الفوز
تطبيق Winner Matrix + تعديل Resolution flow + تحديث الاختبارات.
Auto-recommend spy count حسب عدد اللاعبين.
تطبيق guess timeout فعلي.
الأسبوع 2: صقل العرض (Reveal/Resolution) + Accessibility
polish reveal card states + تطبيق إعدادات الرؤية per player داخل reveal.
polish StatusBanners ورسائل المراحل.
تحسين microcopy العربي (قصير/واضح/متناسق).
الأسبوع 3: بنك الكلمات — توحيد + QA tooling
تحديث generator/استيراد بيانات لضمان بنك كبير واقعي.
إضافة validate scripts + تقارير توزيع.
الأسبوع 4: Offline/Performance/PWA
self-host fonts + تحديث Workbox precache.
cache word pack في IndexedDB مع version.
تدقيق update flow في Settings.
الأسبوع 5: اختبار شامل + Playwright flows
سيناريوهات end-to-end متعددة (1 spy / 2 spies).
مراجعة screenshots على Mobile/Desktop + إصلاح أي regressions.
الأسبوع 6: تثبيت الإطلاق
تنظيف الحواف (edge cases) + إعداد notes للإصدار + توثيق تشغيل/بناء.
تغييرات واجهات/نماذج (APIs/Types) المتوقعة
تحديث semantics لـ resolveWinner(citizensIdentified, spyGuessCorrect) (نفس التوقيع، منطق مختلف).
قد نضيف حقول اختيارية في ActiveMatch:
voteOutcome?: 'captured' | 'missed' لتسهيل عرض الرسائل (اختياري، لكن يثبّت UI).
guessTimedOut?: boolean لتفسير النتيجة في الملخص (اختياري).
افتراضات
v1 هو PWA محلي بدون سيرفر (كل شيء local عبر Dexie).
Arabic-first: لا نضيف UI لتبديل اللغة الآن، لكن نضمن عدم كسر الـ i18n.
لا نضيف AI Mode في هذا المسار (يبقى teaser فقط).

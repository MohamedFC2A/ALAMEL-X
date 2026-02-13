import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const translation = {
  appName: 'العميل X',
  homeTagline: 'مرر الموبايل.. وخلي شكك صاحي.',
  play: 'ابدأ اللعب',
  startMission: 'ابدأ المهمة',
  continueMission: 'كمّل المهمة',
  resumeMission: 'استكمل المهمة',
  playAi: 'اللعب ضد الذكاء الاصطناعي',
  comingSoon: 'قريبًا',
  playersRecords: 'اللاعبون والسجل',
  globalSettings: 'إعدادات اللعبة',
  aiTeaserTitle: 'وضع الذكاء الاصطناعي قادم',
  aiTeaserBody: 'قريبًا تقدر تكمل أي جولة بلاعبين أذكياء بدل الأماكن الفاضية.',
  notifyMe: 'نبّهني على هذا الجهاز',
  close: 'إغلاق',
  noPlayersRedirect: 'لازم يكون عندك ٣ لاعبين مفعّلين على الأقل قبل بداية الجولة.',
  players: 'اللاعبون',
  addPlayer: 'إضافة لاعب',
  addAiPlayer: 'إضافة لاعب AI',
  editPlayer: 'تعديل اللاعب',
  deletePlayer: 'حذف اللاعب',
  confirmDeletePlayer: 'حذف {{name}} نهائيًا من القائمة؟',
  deletePlayerFailed: 'تعذّر حذف اللاعب. حاول مرة أخرى.',
  deletePlayerBlockedActiveMatch: 'لا يمكن حذف لاعب داخل جولة جارية. أنهِ الجولة أولًا.',
  disable: 'تعطيل',
  enable: 'تفعيل',
  save: 'حفظ',
  cancel: 'إلغاء',
  name: 'الاسم',
  avatar: 'الصورة',
  accessibility: 'إعدادات الرؤية',
  shortSighted: 'تكبير النص داخل الكشف',
  longSighted: 'تكبير للمسافات البعيدة',
  extraReadTime: 'وقت قراءة إضافي',
  blurReduction: 'تقليل الضبابية',
  highContrast: 'تباين أعلى',
  records: 'السجل',
  gamesPlayed: 'عدد الجولات',
  spyWins: 'مرات فوز الجاسوس',
  citizenWins: 'مرات فوز المواطنين',
  settings: 'الإعدادات',
  uiScale: 'حجم الواجهة',
  uiScaleAutoHint: 'يتم ضبط الحجم تلقائيًا حسب نوع الشاشة والمقاس الحالي ({{width}}×{{height}}).',
  animationSpeed: 'سرعة الحركة',
  sound: 'الصوت',
  gameSettings: 'إعدادات اللعب',
  displaySettings: 'إعدادات العرض',
  audioSettings: 'الصوت',
  discussionMinutes: 'مدة النقاش',
  guessSeconds: 'مدة التخمين',
  wordDifficulty: 'صعوبة الكلمات',
  difficultyAny: 'أي مستوى',
  difficultyEasy: 'سهل',
  difficultyMedium: 'متوسط',
  difficultyHard: 'صعب',
  hintMode: 'قوة التلميح',
  hintWeak: 'ضعيف',
  hintNormal: 'عادي',
  hintStrong: 'ذكي (AI)',
  hintOff: 'بدون تلميح',
  minutes: 'دقيقة',
  seconds: 'ثانية',
  settingsGameplayHint: 'اضبط مدة اللعب والصعوبة',
  settingsDisplayHint: 'تحكم في الشكل والحركة',
  language: 'اللغة',
  theme: 'شكل الألوان',
  on: 'تشغيل',
  off: 'إيقاف',
  setupMatch: 'إعداد الجولة',
  selectPlayers: 'اختَر من ٣ إلى ١٠ لاعبين (٢ جاسوس يحتاج ٤+).',
  spiesCount: 'عدد الجواسيس',
  startGame: 'ابدأ الجولة',
  selectedCount: 'المحدد',
  handoff: 'سلّم الموبايل إلى {{name}}',
  continue: 'متابعة',
  pressHoldReveal: 'اضغط مطولًا للكشف',
  holdSteady: 'ثبّت الضغط',
  holdAlmostThere: 'قربت... كمل',
  holdReleaseNow: 'جاهز - أكمل لمسة أخيرة',
  roleCitizen: 'أنت مواطن',
  roleSpy: 'أنت الجاسوس',
  secretWord: 'الكلمة السرية',
  category: 'الفئة',
  hint: 'تلميح',
  next: 'التالي',
  back: 'رجوع',
  closePhone: 'اقفل الشاشة وابدأ النقاش',
  startDiscussion: 'ابدأ النقاش',
  discussion: 'النقاش',
  skipTimer: 'تخطي المؤقت',
  votePhase: 'صوّت على الجاسوس',
  pickSuspects: 'اختَر {{count}} مشتبه',
  voteHandoff: 'سلّم الموبايل إلى {{name}} للتصويت',
  voteProgress: 'تصويت {{current}} / {{total}}',
  votePickOne: 'اختَر مشتبهًا واحدًا',
  voteRunoff: 'تعادل! إعادة تصويت بين المتعادلين.',
  voteTieBroken: 'تم كسر التعادل تلقائيًا.',
  submitVote: 'تأكيد التصويت',
  spiesRevealed: 'مرحلة الحسم',
  spyGuessPrompt: 'بعد التصويت، الجاسوس يخمّن الكلمة خلال ٣٠ ثانية.',
  spyGuessPromptTeam: 'بعد القبض على جاسوس، فريق الجواسيس يقدّم تخمينًا واحدًا خلال ٣٠ ثانية.',
  spyGuessPick: 'اختَر الكلمة التي تعتقد أن المواطنين شاهدوها.',
  spyGuessTeamInfo: 'هذه الجولة بها ٢ جاسوس: التخمين النهائي واحد لفريق الجواسيس.',
  submitGuess: 'تأكيد التخمين',
  guessPlaceholder: 'اكتب التخمين',
  correctWord: 'الكلمة الصحيحة',
  similarWords: 'كلمات قريبة',
  winnerCitizens: 'المواطنون كسبوا!',
  winnerSpies: 'الجواسيس انتصروا!',
  winnerSpySingle: 'الجاسوس {{name}} كسب!',
  winnerSpiesTeam: 'الجواسيس {{names}} انتصروا!',
  guessRequiredAlert: 'لازم تختار كلمة! التخمين إجباري.',
  finishRound: 'إنهاء الجولة',
  roundSummary: 'ملخص الجولة',
  quickReplay: 'جولة جديدة',
  returnHome: 'العودة للرئيسية',
  restartRound: 'إعادة اللعب',
  confirmRestartRound: 'هل تريد إنهاء الجولة الحالية والبدء من جديد؟ لن يتم حفظ نتيجة هذه الجولة.',
  restartRoundNote: 'زر إعادة اللعب ينهي الجولة الحالية بدون حفظ نتيجة.',
  wordsExhausted: 'الكلمات المتاحة خلصت. اعمل إعادة تعيين للكلمات المستخدمة.',
  resetWordLocks: 'إعادة تعيين الكلمات المستخدمة',
  confirmResetWords: 'هل تريد إعادة تعيين الكلمات المستخدمة؟ قد تظهر كلمات مكررة بعد ذلك.',
  pendingLanguage: 'سيتم تطبيق اللغة بعد انتهاء الجولة الحالية.',
  activeMatchResume: 'استكمال الجولة',
  history: 'السجل',
  emptyHistory: 'لا توجد جولات محفوظة حتى الآن.',
  voteFailed: 'التصويت لم يحدد الجاسوس بدقة، إذًا الجواسيس كسبوا.',
  voteSucceeded: 'تم تحديد الجاسوس، لديه محاولة أخيرة لخطف الجولة.',
  voteCapturedInfo: 'التصويت رصد الجاسوس بنجاح.',
  voteMissedInfo: 'التصويت لم يحدد الجاسوس بدقة.',
  playerDisabled: 'معطّل',
  playerEnabled: 'مفعّل',
  humanPlayerProfileHint: 'لاعب بشري',
  aiPlayerProfileHint: 'عميل AI',
  aiBadge: 'AI',
  extraSeconds: '{{seconds}} ثانية',
  revealReadyIn: 'متاح بعد {{seconds}} ث',
  roleHeader: 'كشف الدور',
  aiFeature1: 'أنماط شك مختلفة لكل لاعب',
  aiFeature2: 'محاكاة تردد وتفكير قبل التصويت',
  aiFeature3: 'سلوك تكيفي مع سير النقاش',
  home: 'الرئيسية',
  homeSubline: 'جهاز واحد.. توتر أعلى.. وجولة أسرع.',
  activeMatchResumeHint: 'يوجد جولة جارية بالفعل.',
  homeUtilities: 'أدوات القائمة',
  startRoundFast: 'ابدأ جولة محلية فورًا',
  manageProfiles: 'إدارة الملفات والإحصاءات',
  tuneExperience: 'الحركة، الحجم، التباين، والألوان',
  playersManagementSubtitle: 'إدارة اللاعبين والسجل وإعدادات الرؤية',
  settingsSubtitle: 'اضبط شكل اللعبة بما يناسب كل المجموعة',
  playersCountBadge: '{{count}} لاعب',
  historyCountBadge: '{{count}} سجل',
  recordsCountBadge: '{{count}} سجل',
  reducedMotion: 'تقليل الحركة',
  contrastPreset: 'مستوى التباين',
  contrastNormal: 'عادي',
  contrastHigh: 'مرتفع',
  uiDensity: 'كثافة الواجهة',
  densityComfortable: 'مريحة',
  densityCompact: 'مضغوطة',
  uiAutoFixEnabled: 'التصحيح التلقائي للواجهة',
  uiAutoFixHint: 'يراقب المقاسات أثناء التشغيل ويطبّق ضبطًا آمنًا عند اكتشاف تزاحم أو كسر في التخطيط.',
  uiSelfHealRun: 'تشغيل الإصلاح الذاتي الآن',
  uiSelfHealRunning: 'جاري التشخيص والإصلاح...',
  uiSelfHealDone: 'تمت مراجعة الواجهة. درجة الصحة: {{score}}/100',
  uiSelfHealApplied: 'الإعدادات التي تم ضبطها',
  uiSelfHealNoChanges: 'لا توجد مشاكل حرجة. لم يتم تعديل أي إعداد.',
  uiSelfHealFail: 'فشل تشغيل الإصلاح الذاتي للواجهة.',
  uiSelfHealLastRun: 'آخر فحص: {{time}} | الدرجة: {{score}}/100',
  uiSelfHealAiInsight: 'اقتراح DeepSeek',
  uiSelfHealAiInsightUnavailable: 'DeepSeek غير متاح الآن؛ تم تطبيق الإصلاحات المحلية فقط.',
  uiDebuggerTitle: 'مصحح الواجهة',
  uiDebuggerHint: 'شخّص مشاكل المقاسات والتخطيط وتتبّع أخطاء runtime.',
  uiDebuggerRun: 'تشغيل تشخيص',
  uiDebuggerCopy: 'نسخ تقرير JSON',
  uiDebuggerClear: 'مسح سجل الأخطاء',
  uiDebuggerRunHint: 'شغّل التشخيص لعرض تقرير الواجهة الحالي.',
  uiDebuggerCopyDone: 'تم نسخ التقرير.',
  uiDebuggerCopyFail: 'تعذّر نسخ التقرير.',
  uiDebuggerNoIssues: 'لا توجد مشاكل واجهة حرجة في الفحص الحالي.',
  uiDebuggerIssuesLabel: 'مشاكل الواجهة المكتشفة',
  uiDebuggerErrorsTitle: 'أخطاء Runtime',
  uiDebuggerErrorsLabel: 'سجل أخطاء Runtime',
  uiDebuggerNoErrors: 'لا توجد أخطاء Runtime مسجلة.',
  uiDebuggerLastRoute: 'المسار: {{route}}',
  uiDebuggerLastRunAt: 'وقت التشخيص: {{time}}',
  phaseSetup: 'الإعداد',
  phaseReveal: 'الكشف',
  phaseTalk: 'النقاش',
  phaseResolve: 'الحسم',
  phaseSetupEyebrow: 'قبل البداية',
  phaseRevealEyebrow: 'تسليم آمن',
  phaseTalkEyebrow: 'وقت النقاش',
  phaseResolveEyebrow: 'وقت الحسم',
  phaseSummaryEyebrow: 'نتيجة الجولة',
  wordsUsageLabel: 'استهلاك الكلمات',
  wordsRemainingLabel: 'المتبقي من الكلمات',
  discussionSubtitle: '٣ دقائق نقاش للوصول للجاسوس.',
  discussionStartHint: 'ابدأ عندما يكون كل اللاعبين جاهزين.',
  handoffSafetyNote: 'اتأكد أن اللاعب الحالي فقط هو الذي يرى الشاشة.',
  safeTransitionHint: 'اكشف الدور أولًا للمتابعة.',
  summarySubtitle: 'النتيجة النهائية ومراجعة كلمة الجولة.',
  summaryUnavailable: 'لا يوجد ملخص بعد لأن لا توجد جولات مكتملة.',
  roundAwardsTitle: 'جوائز الجولة',
  roundAwardsEmpty: 'لا توجد ميداليات جديدة في هذه الجولة.',
  roundAwardsNoMedals: 'لا توجد ميداليات جديدة.',
  roundAwardsLevelUp: 'ارتفع إلى ليفل {{level}}',
  emptyPlayersList: 'لا يوجد لاعبين مضافين حتى الآن.',
  quickAddPlayers: 'إضافة ٤ لاعبين بسرعة',
  quickAddHint: 'ينشئ ٤ لاعبين جاهزين للعب فورًا.',
  stageVote: 'تصويت',
  stageGuess: 'تخمين',
  stageResult: 'نتيجة',
  guessCorrectMessage: 'تخمين صحيح. الجاسوس خطف الجولة.',
  guessWrongMessage: 'غلط. الكلمة لم تكن هي.',
  guessTimeoutMessage: 'انتهى الوقت بدون تخمين.',
  guessRequired: 'التخمين إجباري. اختر كلمة لإكمال الجولة.',
  guessPending: 'لم يتم اختيار تخمين بعد.',
  spyRecommended: 'موصى به',
  confirmLocation: '{{location}}',
  voteMissedResult: 'التصويت لم يحدد الجاسوس — الجواسيس كسبوا تلقائيًا.',
  spyTeamLabel: 'فريقك',
  spyTeamNote: 'زميلك في الفريق: {{names}}',
  themeDreamland: 'Hello Kitty الحقيقي 🎀',
  themeAurora: 'شفق جليدي',
  themeSolar: 'غروب ذهبي',
  themeOnyx: 'أونيكس تكتيكي',
  aiSettings: 'إعدادات AI',
  aiSettingsHint: 'إعدادات الذكاء والصوت. مفتاح DeepSeek مُدار من الخادم (Vercel).',
  aiEnabled: 'تفعيل لاعب AI',
  aiApiKey: 'مفتاح DeepSeek',
  aiApiKeyPlaceholder: 'ضع المفتاح هنا',
  aiHumanMode: 'نمط الذكاء',
  aiHumanModeStrategic: 'تكتيكي',
  aiHumanModeNatural: 'طبيعي',
  aiHumanModeUltra: 'بشري جدًا',
  aiHumanSimulation: 'محاكاة البشر للـAI',
  aiHumanSimulationHint: 'نبرة بشرية مصرية أكثر واقعية مع خفة دم ذكية خفيفة داخل سياق اللعبة.',
  aiHumanSimulationRequiresUltra: 'تفعيل محاكاة البشر يتطلب وضع "بشري جدًا (Ultra)".',
  aiHumanSimulationEnabledBadge: 'محاكاة البشر مفعّلة',
  aiHumanSimulationToneLightComedy: 'خفة دم خفيفة ذكية',
  aiReasoningDepth: 'عمق التفكير',
  aiReplyLength: 'طول الرد',
  aiReplyLengthShort: 'قصير',
  aiReplyLengthBalanced: 'متوازن',
  aiReplyLengthDetailed: 'مفصل',
  aiInitiativeLevel: 'مستوى المبادرة',
  aiMemoryDepth: 'عمق الذاكرة',
  aiDepthLevel: 'مستوى {{level}}',
  aiInitiativeValue: '{{value}}%',
  aiMemoryTurns: '{{value}} رسالة',
  aiShowKey: 'إظهار',
  aiHideKey: 'إخفاء',
  aiKeyStoredNote: 'المفتاح يتخزن محليًا على هذا الجهاز فقط.',
  aiTestConnection: 'اختبار الاتصال',
  aiTesting: 'جاري الاختبار...',
  aiTestOk: 'الاتصال شغّال',
  aiTestFail: 'فشل الاتصال',
  aiClearKey: 'مسح المفتاح',
  aiMissingKey: 'ضع المفتاح أولًا.',
  aiVoiceInput: 'استقبال بالصوت',
  aiVoiceOutput: 'نطق ردود AI',
  aiVoiceNote: 'تحويل الصوت داخل الجولة يعتمد على ElevenLabs فقط.',
  aiVoiceProvider: 'مزود الصوت',
  aiVoiceProviderEleven: 'ElevenLabs (أساسي)',
  aiVoiceProviderBrowser: 'المتصفح (احتياطي)',
  aiVoiceProviderLocked: 'تم قفل مزود الصوت على ElevenLabs لضمان ثبات النطق.',
  aiAutoFacilitatorEnabled: 'AI يدير النقاش تلقائيًا',
  aiSilenceThreshold: 'حد الصمت قبل التدخل',
  aiInterventionRest: 'فترة راحة AI بين الأسئلة',
  elevenSettingsTitle: 'اختبار ElevenLabs',
  elevenSettingsHint: 'اختبر الاتصال والصوت الفعلي مع عرض تفاصيل الخطأ.',
  elevenConnectionTest: 'اختبار اتصال ElevenLabs',
  elevenConnectionOk: 'اتصال ElevenLabs شغال.',
  elevenConnectionOkDetailed: 'اتصال ElevenLabs شغال. الصوت المختار: {{voice}} | عدد الأصوات: {{count}} | الموديل: {{model}}',
  elevenConnectionFail: 'فشل اختبار اتصال ElevenLabs.',
  elevenUnknownVoice: 'صوت غير معروف',
  elevenTesting: 'جاري اختبار ElevenLabs...',
  elevenVoiceTest: 'اختبار نطق عشوائي',
  elevenVoiceTesting: 'جاري اختبار النطق...',
  elevenVoiceTestOk: 'اختبار النطق نجح.',
  elevenVoiceTestOkDetailed: 'اختبار النطق نجح. الصوت المستخدم: {{voice}} ({{voiceId}})',
  elevenVoiceTestFail: 'فشل اختبار النطق.',
  elevenVoiceTestNeedOutput: 'فعّل الصوت العام + نطق ردود AI عشان اختبار النطق يشتغل.',
  aiDisabled: 'وضع AI غير مفعّل.',
  aiSetupRequired: 'لازم تفعّل AI وتتأكد أن إعدادات الخادم على Vercel جاهزة.',
  configureAi: 'إعداد AI',
  aiInternetHint: 'تنبيه: AI يحتاج إنترنت أثناء الجولة.',
  aiMatchModeLabel: 'أسلوب مشاركة AI في الجولة',
  aiModeFullGameplay: 'لعب كامل مع AI',
  aiModeVoteOnly: 'AI للتصويت فقط',
  aiMatchModeHint: 'وضع "التصويت فقط" يخلي الـAI يتخطى النقاش ويدخل فقط وقت الحسم والتصويت.',
  aiModeVoteOnlyDiscussionHint: 'وضع هذه الجولة: AI للتصويت فقط. لن يتدخل في النقاش.',
  aiRevealSkipping: 'جارٍ تجهيز العميل...',
  aiRevealSkipHint: 'لا يوجد كشف لهذا اللاعب. الانتقال تلقائيًا.',
  aiAutoContinue: 'الانتقال تلقائيًا...',
  aiDeskButton: 'AI',
  aiDeskTitle: 'الغرفة الصوتية للـAI',
  aiChooseAgent: 'اختَر العميل',
  aiDeskEmpty: 'ابدأ بسؤال قصير…',
  aiSpeak: 'تحدّث',
  aiListening: 'يستمع...',
  aiTypeHere: 'اكتب سؤالك...',
  aiSend: 'إرسال',
  aiAskQuestion: 'خلّي AI يسأل',
  aiVoiceRoomHint: 'انطقي اسم العميل ثم طلبك مباشرة. العملاء المتاحين: {{names}}',
  aiVoiceRoomOnly: 'الوضع صوتي بالكامل: لا كتابة ولا شات.',
  aiVoiceTapToSpeak: 'ابدئي التسجيل',
  aiVoiceTapToStop: 'إيقاف التسجيل',
  aiVoiceStopPlayback: 'إيقاف الصوت',
  aiVoiceNoSpeech: 'لم يتم التقاط صوت واضح. جرّبي مرة ثانية.',
  aiVoiceNeedPrompt: 'قولي اسم العميل ثم طلب واضح.',
  aiVoiceInputDisabled: 'استقبال الصوت مقفول من الإعدادات.',
  aiVoiceOutputDisabled: 'نطق الردود مقفول. فعّلي الصوت من الإعدادات.',
  aiVoiceAgentLabel: 'العميل الذي يرد',
  aiVoiceStateIdle: 'جاهز',
  aiVoiceStateListening: 'يستمع الآن',
  aiVoiceStateProcessing: 'يفكّر',
  aiVoiceStateSpeaking: 'يتكلم الآن',
  aiThinking: 'AI يفكر...',
  retry: 'إعادة المحاولة',
  aiManualVote: 'تصويت يدوي بدل AI',
  aiManualGuess: 'تخمين يدوي بدل AI',
  aiVoteInProgress: 'AI يصوّت...',
  aiGuessInProgress: 'AI يخمّن...',
  aiAuthError: 'المفتاح غير صحيح أو مرفوض.',
  aiRateLimitError: 'تم الوصول للحد. جرّب لاحقًا.',
  aiNetworkError: 'مشكلة اتصال/إنترنت.',
  aiUnknownError: 'حدث خطأ غير معروف.',
  aiVoiceUnsupported: 'الصوت غير مدعوم في هذا المتصفح.',
  aiVoiceError: 'حدث خطأ أثناء الاستماع.',
  aiVoiceMicAccessError: 'تعذر الوصول للميكروفون. تأكد من السماح بالوصول للصوت من المتصفح.',
  aiVoiceFallbackTts: 'تعذّر نطق ElevenLabs، رجعنا لصوت المتصفح مؤقتًا.',
  aiVoiceFallbackStt: 'تعذّر تفريغ ElevenLabs، بنستخدم تفريغ المتصفح مؤقتًا.',
  aiUnknownSpeaker: 'لاعب',
  aiMonitorTitle: 'مراقبة AI التلقائي',
  aiMonitorHint: 'المساعد شغّال طول النقاش ويراقب الصمت تلقائيًا.',
  aiOrchestratorStatus: 'حالة AI',
  aiOrchestratorIdle: 'متوقف',
  aiOrchestratorListening: 'يسمع',
  aiOrchestratorProcessing: 'بيحلل',
  aiOrchestratorSpeaking: 'بيتكلم',
  aiOrchestratorWaitingAnswer: 'مستني رد',
  aiOrchestratorPendingTarget: 'مستني رد من {{name}}',
  aiOrchestratorNoPending: 'مفيش هدف حالياً',
  aiOrchestratorRuntimeOn: 'التشغيل التلقائي مفعّل',
  aiOrchestratorRuntimeOff: 'التشغيل التلقائي متوقف',
  aiOrchestratorPause: 'إيقاف مؤقت',
  aiOrchestratorResume: 'استئناف',
  aiMonitorActiveAgent: 'العميل النشط',
  aiMonitorLastSpeaker: 'آخر متكلم',
  aiMonitorLastTranscript: 'آخر كلام مسموع',
  aiMonitorLastIntervention: 'آخر تدخل من AI',
  aiMonitorSilence: 'الصمت الحالي',
  aiServerManaged: 'مفتاح DeepSeek غير ظاهر للمستخدم ومُدار تلقائيًا من بيئة Vercel.',
  systemSettings: 'النظام',
  checkForUpdates: 'تحديث اللعبة',
  updateAvailable: 'يتوفر تحديث جديد',
  upToDate: 'اللعبة محدّثة',
  checking: 'جاري الفحص...',
  aiVoteListening: 'AI يسمع النقاش...',
  aiVoteListeningHint: 'الميكروفون مفتوح عشان AI يسمع ويحلل النقاش للتصويت الذكي.',
  aiVoteCapturedPhrases: '{{count}} جملة مسموعة',
  aiVoteMicError: 'تعذّر فتح الميكروفون. تأكد من السماح بالوصول.',
  aiVoteMicNotSupported: 'متصفحك لا يدعم التعرف على الصوت.',
  aiVoteAnalyzing: 'AI يحلل النقاش للتصويت...',
  aiVoteSmartReason: 'تحليل AI',
};

const resources = {
  ar: { translation },
  en: { translation },
};

export async function setupI18n(initialLanguage: 'en' | 'ar'): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'ar',
    debug: false,
    showSupportNotice: false,
    interpolation: {
      escapeValue: false,
    },
  });
}

export function applyDocumentLanguage(language: 'en' | 'ar'): void {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
}

export default i18n;

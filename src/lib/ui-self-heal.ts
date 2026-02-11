import type { GlobalSettings } from '../types';

export type UiIssueSeverity = 'low' | 'medium' | 'high';

export interface UiDiagnosticsContext {
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  rootFontSizePx: number;
  prefersReducedMotion: boolean;
  horizontalOverflowPx: number;
  headerOverflowPx: number;
  headerTitleTruncated: boolean;
  actionBarBottomOverlapPx: number;
  touchTargetRiskCount: number;
}

export interface UiDiagnosticIssue {
  code: string;
  severity: UiIssueSeverity;
  weight: number;
  title: string;
  description: string;
}

export interface UiSelfHealReport {
  checkedAt: number;
  score: number;
  context: UiDiagnosticsContext;
  issues: UiDiagnosticIssue[];
}

export interface UiSelfHealResult {
  report: UiSelfHealReport;
  patch: Partial<GlobalSettings>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeScale(value: number): number {
  return Number(clamp(value, 0.85, 1.2).toFixed(2));
}

function normalizeAnimSpeed(value: number): number {
  return Number(clamp(value, 0.5, 1.5).toFixed(2));
}

interface AutoUiScaleInput {
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}

export function resolveAutoUiScale(
  input: AutoUiScaleInput,
  settings?: Pick<GlobalSettings, 'uiScale' | 'uiDensity'>,
): number {
  const viewportWidth = Number.isFinite(input.viewportWidth) ? input.viewportWidth : 390;
  const viewportHeight = Number.isFinite(input.viewportHeight) ? input.viewportHeight : 780;
  const devicePixelRatio = Number.isFinite(input.devicePixelRatio) ? input.devicePixelRatio : 1;

  let deviceScale = 1;

  if (viewportWidth <= 320) {
    deviceScale -= 0.12;
  } else if (viewportWidth <= 360) {
    deviceScale -= 0.09;
  } else if (viewportWidth <= 390) {
    deviceScale -= 0.055;
  } else if (viewportWidth <= 430) {
    deviceScale -= 0.02;
  } else if (viewportWidth >= 1440) {
    deviceScale += 0.04;
  } else if (viewportWidth >= 1024) {
    deviceScale += 0.02;
  }

  if (viewportHeight <= 600) {
    deviceScale -= 0.075;
  } else if (viewportHeight <= 690) {
    deviceScale -= 0.045;
  } else if (viewportHeight >= 920 && viewportWidth >= 430) {
    deviceScale += 0.02;
  }

  if (viewportWidth <= 390 && devicePixelRatio >= 3) {
    deviceScale -= 0.018;
  } else if (viewportWidth >= 1280 && devicePixelRatio <= 1.2) {
    deviceScale += 0.012;
  }

  if (settings?.uiDensity === 'compact') {
    deviceScale -= 0.01;
  }

  const baseScale = Number.isFinite(settings?.uiScale) ? (settings?.uiScale ?? 1) : 1;
  return Number(clamp(baseScale * deviceScale, 0.84, 1.12).toFixed(3));
}

function createFallbackContext(): UiDiagnosticsContext {
  return {
    viewportWidth: 390,
    viewportHeight: 780,
    devicePixelRatio: 1,
    rootFontSizePx: 16,
    prefersReducedMotion: false,
    horizontalOverflowPx: 0,
    headerOverflowPx: 0,
    headerTitleTruncated: false,
    actionBarBottomOverlapPx: 0,
    touchTargetRiskCount: 0,
  };
}

function collectTouchTargetRiskCount(): number {
  if (typeof document === 'undefined') {
    return 0;
  }

  const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, a, input[type="checkbox"]'));
  let riskCount = 0;

  for (const element of candidates) {
    if ((element as HTMLButtonElement).disabled) {
      continue;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    if (rect.width < 40 || rect.height < 40) {
      riskCount += 1;
    }
  }

  return riskCount;
}

export function collectUiDiagnosticsContext(): UiDiagnosticsContext {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return createFallbackContext();
  }

  const root = document.documentElement;
  const body = document.body;
  const header = document.querySelector<HTMLElement>('.screen-header');
  const headerTitle = document.querySelector<HTMLElement>('.header-grid__center h1');
  const actionBarNodes = Array.from(
    document.querySelectorAll<HTMLElement>('.sticky-action-bar, .reveal-action-bar'),
  );

  const viewportWidth = Math.max(0, Math.round(window.innerWidth || root.clientWidth || 0));
  const viewportHeight = Math.max(
    0,
    Math.round(window.visualViewport?.height ?? window.innerHeight ?? root.clientHeight ?? 0),
  );
  const rootFontSizePx = Number.parseFloat(window.getComputedStyle(root).fontSize || '16') || 16;
  const horizontalOverflowPx = Math.max(
    0,
    Math.round((root.scrollWidth || 0) - viewportWidth),
    Math.round((body?.scrollWidth || 0) - viewportWidth),
  );
  const headerOverflowPx = header ? Math.max(0, Math.round(header.scrollWidth - header.clientWidth)) : 0;
  const headerTitleTruncated = headerTitle ? headerTitle.scrollWidth - headerTitle.clientWidth > 2 : false;
  const actionBarBottomOverlapPx = actionBarNodes.reduce((maxValue, node) => {
    const rect = node.getBoundingClientRect();
    return Math.max(maxValue, Math.round(rect.bottom - viewportHeight));
  }, 0);
  const touchTargetRiskCount = collectTouchTargetRiskCount();

  return {
    viewportWidth,
    viewportHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    rootFontSizePx,
    prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    horizontalOverflowPx,
    headerOverflowPx,
    headerTitleTruncated,
    actionBarBottomOverlapPx: Math.max(0, actionBarBottomOverlapPx),
    touchTargetRiskCount,
  };
}

interface PatchComposer {
  patch: Partial<GlobalSettings>;
  setCompactDensity: () => void;
  setComfortableDensity: () => void;
  lowerScaleTo: (next: number) => void;
  raiseScaleTo: (next: number) => void;
  lowerAnimationSpeedTo: (next: number) => void;
  enableReducedMotion: () => void;
}

function createPatchComposer(settings: GlobalSettings): PatchComposer {
  const patch: Partial<GlobalSettings> = {};

  return {
    patch,
    setCompactDensity: () => {
      if (settings.uiDensity !== 'compact') {
        patch.uiDensity = 'compact';
      }
    },
    setComfortableDensity: () => {
      if (settings.uiDensity !== 'comfortable') {
        patch.uiDensity = 'comfortable';
      }
    },
    lowerScaleTo: (next: number) => {
      const currentBase = patch.uiScale ?? settings.uiScale;
      const target = normalizeScale(Math.min(currentBase, next));
      if (target < settings.uiScale || (patch.uiScale !== undefined && target < patch.uiScale)) {
        patch.uiScale = target;
      }
    },
    raiseScaleTo: (next: number) => {
      const currentBase = patch.uiScale ?? settings.uiScale;
      const target = normalizeScale(Math.max(currentBase, next));
      if (target > settings.uiScale || (patch.uiScale !== undefined && target > patch.uiScale)) {
        patch.uiScale = target;
      }
    },
    lowerAnimationSpeedTo: (next: number) => {
      const currentBase = patch.animationSpeed ?? settings.animationSpeed;
      const target = normalizeAnimSpeed(Math.min(currentBase, next));
      if (target < settings.animationSpeed || (patch.animationSpeed !== undefined && target < patch.animationSpeed)) {
        patch.animationSpeed = target;
      }
    },
    enableReducedMotion: () => {
      if (!settings.reducedMotionMode) {
        patch.reducedMotionMode = true;
      }
    },
  };
}

export function hasUiSelfHealPatch(patch: Partial<GlobalSettings>): boolean {
  return Object.keys(patch).length > 0;
}

export function analyzeUiHealth(settings: GlobalSettings, context: UiDiagnosticsContext): UiSelfHealResult {
  const issues: UiDiagnosticIssue[] = [];
  const patchComposer = createPatchComposer(settings);

  const addIssue = (
    code: string,
    severity: UiIssueSeverity,
    weight: number,
    title: string,
    description: string,
  ) => {
    issues.push({ code, severity, weight, title, description });
  };

  if (context.viewportWidth > 0 && context.viewportWidth <= 360) {
    addIssue(
      'narrow-width',
      'high',
      24,
      'شاشة ضيقة جدًا',
      'العرض أقل من 360px وقد يسبب تزاحمًا في البطاقات والأزرار.',
    );
    patchComposer.setCompactDensity();
    patchComposer.lowerScaleTo(0.9);
    patchComposer.lowerAnimationSpeedTo(0.9);
  } else if (context.viewportWidth > 0 && context.viewportWidth <= 390) {
    addIssue(
      'tight-width',
      'medium',
      14,
      'عرض ضيق',
      'العرض الحالي يحتاج كثافة واجهة أعلى لتجنب الكسر في بعض الشاشات.',
    );
    patchComposer.setCompactDensity();
    patchComposer.lowerScaleTo(0.94);
  }

  if (context.viewportHeight > 0 && context.viewportHeight <= 680) {
    addIssue(
      'short-height',
      'medium',
      12,
      'ارتفاع محدود',
      'الارتفاع الصغير يضغط عناصر الـHUD وأسفل الشاشة.',
    );
    patchComposer.setCompactDensity();
    patchComposer.lowerScaleTo(0.92);
  }

  if (context.viewportHeight > 0 && context.viewportHeight <= 600) {
    addIssue(
      'very-short-height',
      'high',
      16,
      'ارتفاع شديد القِصر',
      'الارتفاع أقل من 600px وقد يسبب تراكبًا في شريط الإجراءات السفلي.',
    );
    patchComposer.setCompactDensity();
    patchComposer.lowerScaleTo(0.9);
    patchComposer.lowerAnimationSpeedTo(0.85);
  }

  if (context.horizontalOverflowPx >= 8) {
    addIssue(
      'horizontal-overflow',
      'high',
      26,
      'تجاوز أفقي',
      `يوجد تجاوز أفقي بحوالي ${context.horizontalOverflowPx}px.`,
    );
    patchComposer.setCompactDensity();
    patchComposer.lowerScaleTo(0.9);
  }

  if (context.headerOverflowPx >= 6) {
    addIssue(
      'header-overflow',
      'medium',
      15,
      'ازدحام في الهيدر',
      `الهيدر يعاني من تجاوز أفقي بحوالي ${context.headerOverflowPx}px.`,
    );
    patchComposer.setCompactDensity();
    patchComposer.lowerScaleTo(0.93);
  }

  if (context.headerTitleTruncated) {
    addIssue(
      'header-title-truncation',
      'medium',
      11,
      'عنوان الصفحة مقصوص',
      'العنوان في الهيدر يتجاوز المساحة المتاحة ويحتاج تقليل كثافة الواجهة.',
    );
    patchComposer.setCompactDensity();
    patchComposer.lowerScaleTo(0.92);
  }

  if (context.actionBarBottomOverlapPx >= 6) {
    addIssue(
      'action-bar-overlap',
      'high',
      18,
      'تراكب في شريط الإجراءات',
      `شريط الإجراءات السفلي خارج حدود العرض بحوالي ${context.actionBarBottomOverlapPx}px.`,
    );
    patchComposer.setCompactDensity();
    patchComposer.lowerScaleTo(0.9);
  }

  if (
    context.touchTargetRiskCount >= 3 &&
    context.viewportWidth >= 400 &&
    context.horizontalOverflowPx === 0 &&
    context.headerOverflowPx === 0
  ) {
    addIssue(
      'touch-target-risk',
      'medium',
      9,
      'أهداف لمس صغيرة',
      `تم رصد ${context.touchTargetRiskCount} عنصر قابل للنقر أصغر من الحجم المريح للمس.`,
    );
    patchComposer.setComfortableDensity();
    patchComposer.raiseScaleTo(1);
  }

  if (context.rootFontSizePx >= 19 && settings.uiScale > 1) {
    addIssue(
      'large-root-font',
      'medium',
      10,
      'حجم خط جذري مرتفع',
      'تكبير الخط مع المقياس الحالي قد يسبب انزياحات في التخطيط.',
    );
    patchComposer.lowerScaleTo(0.98);
  }

  if (context.prefersReducedMotion && !settings.reducedMotionMode) {
    addIssue(
      'prefers-reduced-motion',
      'medium',
      10,
      'تفضيل النظام لتقليل الحركة',
      'النظام يفضّل تقليل الحركة بينما الخيار غير مفعل داخل اللعبة.',
    );
    patchComposer.enableReducedMotion();
    patchComposer.lowerAnimationSpeedTo(0.85);
  }

  const weightSum = issues.reduce((sum, issue) => sum + issue.weight, 0);
  const score = Math.max(0, 100 - Math.min(95, weightSum));

  return {
    report: {
      checkedAt: Date.now(),
      score,
      context,
      issues,
    },
    patch: patchComposer.patch,
  };
}

export function buildUiSelfHealPersistedPatch(result: UiSelfHealResult): Partial<GlobalSettings> {
  return {
    ...result.patch,
    uiSelfHealScore: result.report.score,
    uiSelfHealLastRunAt: result.report.checkedAt,
  };
}

interface PersistOptions {
  mode?: 'manual' | 'auto';
}

export function shouldPersistUiSelfHeal(
  settings: GlobalSettings,
  result: UiSelfHealResult,
  options: PersistOptions = {},
): boolean {
  const mode = options.mode ?? 'auto';
  if (mode === 'manual') {
    return true;
  }
  return hasUiSelfHealPatch(result.patch) || settings.uiSelfHealScore !== result.report.score;
}

export function buildUiSelfHealSummary(result: UiSelfHealResult): string {
  const { report, patch } = result;
  const applied: string[] = [];

  if (patch.uiScale !== undefined) {
    applied.push(`uiScale=${patch.uiScale.toFixed(2)}`);
  }
  if (patch.uiDensity) {
    applied.push(`uiDensity=${patch.uiDensity}`);
  }
  if (patch.animationSpeed !== undefined) {
    applied.push(`animationSpeed=${patch.animationSpeed.toFixed(2)}`);
  }
  if (patch.reducedMotionMode !== undefined) {
    applied.push(`reducedMotionMode=${String(patch.reducedMotionMode)}`);
  }

  const issuePart = report.issues.length
    ? `${report.issues.length} issues`
    : 'no issues';
  const patchPart = applied.length ? `patch: ${applied.join(', ')}` : 'patch: none';
  return `score=${report.score}, ${issuePart}, ${patchPart}`;
}

export function buildUiAuditPrompt(report: UiSelfHealReport): string {
  const issuesText = report.issues.length
    ? report.issues
        .map(
          (issue, index) =>
            `${index + 1}) [${issue.severity}] ${issue.title} - ${issue.description}`,
        )
        .join('\n')
    : 'No critical issues detected.';

  return [
    'أنت مهندس UI/UX خبير. أعطني خطة تحسين قصيرة وعملية للواجهة.',
    'القيود:',
    '- لا تغييرات جذرية للتصميم.',
    '- اقتراحات قابلة للتنفيذ داخل React + CSS فقط.',
    '- اكتب 3 نقاط كحد أقصى.',
    '',
    `Viewport: ${report.context.viewportWidth}x${report.context.viewportHeight}`,
    `Score: ${report.score}/100`,
    'Issues:',
    issuesText,
  ].join('\n');
}

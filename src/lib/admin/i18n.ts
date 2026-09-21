/**
 * Admin UI i18n layer.
 *
 * A deliberately tiny, dependency-free typed message dictionary: the English object is the
 * source of truth and `AdminMessages` is derived from it, so the Chinese object is checked
 * against it at compile time (missing or extra keys fail the build).
 *
 * Server-safe on purpose: this module must stay free of client-only imports, and it must NOT
 * carry a `'use client'` directive so server components and server actions can import it.
 *
 * Client components (the locale switcher) import the locale constants from here too, so
 * `next/headers` is pulled in lazily inside `getAdminLocale()` — a static import would drag the
 * server-only module into the client bundle and break the build.
 */
import {
  mediaMessagesEn,
  mediaMessagesZh,
  productCategoryMessagesEn,
  productCategoryMessagesZh,
  productMessagesEn,
  productMessagesZh,
} from './messages/catalog';

export const ADMIN_UI_LOCALES = ['en', 'zh'] as const;
export type AdminUiLocale = (typeof ADMIN_UI_LOCALES)[number];

export const ADMIN_LOCALE_COOKIE = 'mz_admin_locale';
export const DEFAULT_ADMIN_UI_LOCALE: AdminUiLocale = 'en';

/** `<html lang>` value to use for each admin UI locale */
export const ADMIN_HTML_LANG: Record<AdminUiLocale, string> = {
  en: 'en',
  zh: 'zh-CN',
};

/** Locale used when formatting dates/times in the admin UI */
export function adminDateLocale(locale: AdminUiLocale): string {
  return locale === 'zh' ? 'zh-CN' : 'en-US';
}

/**
 * English messages — the source of truth.
 *
 * NOTE: intentionally NOT `as const`. `as const` would narrow every leaf to a string literal
 * type ("Dashboard"), which would then make the Chinese object unassignable. Plain inference
 * keeps the leaf type `string` while still preserving the exact key structure, which is what
 * gives us compile-time key parity.
 */
const en = {
  common: {
    save: 'Save',
    saving: 'Saving…',
    saveChanges: 'Save changes',
    add: 'Add',
    cancel: 'Cancel',
    delete: 'Delete',
    deleting: 'Deleting…',
    confirmDelete: 'Confirm delete',
    deleteWarning: 'This cannot be undone — the product, its media, specifications and version history are all removed.',
    deleteConfirmDefault: 'Delete this item? This action cannot be undone.',
    edit: 'Edit',
    enabled: 'Enabled',
    disabled: 'Disabled',
    visible: 'Visible',
    hidden: 'Hidden',
    orderValue: 'Order {order}',
    untitled: '(Untitled)',
    processing: 'Processing…',
  },
  localeSwitcher: {
    label: 'Admin language',
  },
  nav: {
    ariaLabel: 'Admin navigation',
    dashboard: 'Dashboard',
    company: 'Company profile',
    contacts: 'Contacts',
    navigation: 'Navigation',
    pages: 'Pages & blocks',
    media: 'Media library',
    productCategories: 'Product categories',
    products: 'Products',
    audit: 'Audit log',
    translationSettings: 'Translation',
    sync: 'Language sync',
  },
  shell: {
    subtitle: 'Content Admin',
    headerTitle: 'Dashboard',
    viewPublicSite: 'View public site ↗',
    signOut: 'Sign out',
  },
  loginPage: {
    subtitle: 'Content Admin sign in',
    restrictedBefore: 'Authorized administrators only. Self-signup is disabled; accounts are created with',
    restrictedAfter: '.',
  },
  loginForm: {
    dbMissingBefore: 'The database is not configured (',
    dbMissingAfter: ' is missing), so sign in is unavailable. See the README to initialize the database.',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'An overview of site content and recent activity.',
    dbMissingBefore: 'The database is not configured (',
    dbMissingAfter:
      ' is missing). Stats and content management are unavailable; the public site falls back to its built-in copy and stays accessible. See the README to initialize the database.',
    dbUnavailable:
      'Could not connect to the database, so stats are unavailable. Please check the database service and connection string.',
    statistics: 'Statistics',
    totalPages: 'Total pages',
    publishedPages: 'Published pages',
    draftPages: 'Draft pages',
    products: 'Products',
    assets: 'Assets',
    inquiries: 'Inquiries',
    recentActivity: 'Recent activity',
    viewAll: 'View all',
    noActivity: 'No activity yet.',
  },
  company: {
    title: 'Company profile',
    subtitle:
      'Company name, description, positioning, address, business hours and default SEO in all three languages. Changes take effect on the public site as soon as you save.',
  },
  companyForm: {
    companyName: 'Company name',
    tagline: 'Tagline',
    about: 'About the company',
    positioning: 'Positioning',
    address: 'Address',
    businessHours: 'Business hours',
    seoTitle: 'Default SEO title',
    seoTitleHint: 'Leave blank to use "Company name — default title" automatically',
    seoDescription: 'Default SEO description',
    save: 'Save company profile',
  },
  contacts: {
    title: 'Contacts',
    subtitle:
      'Only contact methods that are enabled and have a value are shown on the public site. When none are filled in, no placeholder contact details are displayed.',
    dbUnavailable:
      'The database is unavailable, so contact methods could not be loaded. Please check DATABASE_URL and the database service.',
    existing: 'Existing contact methods ({count})',
    empty: 'No contact methods yet. They appear on the public site once added.',
    noSharedValue: '(no shared value)',
    addTitle: 'Add contact method',
    deleteConfirm: 'Delete this contact method? It will immediately stop showing on the public site.',
  },
  contactForm: {
    type: 'Type',
    displayOrder: 'Display order',
    displayOrderHint: 'Lower numbers come first',
    sharedValue: 'Shared value',
    sharedValueHint: 'Email address / phone number / WhatsApp number, etc. (shared across all languages)',
    customLink: 'Custom link (optional)',
    customLinkHint: 'Leave blank to auto-generate a mailto: / tel: / wa.me link based on the type',
    enabled: 'Enabled (shown on the public site only when enabled)',
    displayTextSection: ' · Display text',
    displayLabel: 'Display label (leave blank to use the type default)',
    valueForLocale: 'Value for this language (e.g. address text)',
    valueForLocaleHint: 'Leave blank to use the shared value above',
  },
  navigation: {
    title: 'Navigation',
    subtitle:
      "Manage the site's top navigation. When nothing is configured, the public site uses its built-in navigation (anchors to the home page sections).",
    dbUnavailable: 'The database is unavailable, so the navigation configuration could not be loaded.',
    existing: 'Existing nav items ({count})',
    empty: 'No custom navigation yet; the public site is using its built-in navigation. Add items below.',
    addTitle: 'Add nav item',
    deleteConfirm: 'Delete this nav item?',
  },
  navForm: {
    linkUrl: 'Link URL',
    linkUrlHint: 'A site path (starting with / or #) or a full http(s) URL',
    displayOrder: 'Display order',
    displayOrderHint: 'Lower numbers come first',
    enabled: 'Enabled (shown on the public site only when enabled)',
    external: 'External link (opens in a new window)',
    labelSection: ' · Nav label',
    label: 'Label',
  },
  pages: {
    title: 'Pages & blocks',
    subtitle:
      'Manage page information (title, slug, SEO) and the content of each home page block. While a page is a draft, the public site uses its built-in copy.',
    dbUnavailable: 'The database is unavailable, so pages could not be loaded.',
    noDataBefore: 'No page data yet. Run ',
    noDataAfter: ' to import the initial home page content.',
    colPage: 'Page',
    colSlug: 'slug',
    colBlocks: 'Blocks',
    colStatus: 'Status',
    home: 'Home',

    // 页面发布前会被拦下的三种情况，以及版本操作
    validationTitle: 'Please give the Chinese page title before publishing.',
    seoWithoutTitle:
      'A language has SEO text but no title. Fill in the title, or clear the SEO fields for that language.',
    duplicateKeys: 'Two blocks share the same key ({keys}). Block keys must be unique within a page.',
    versionSaved: 'Version saved.',
    versionRestored: 'Version restored into the draft. Review it, then publish.',
    versionMissing: 'That version no longer exists.',
    versionDeleted: 'Version deleted.',
  },
  pageDetail: {
    dbUnavailable: 'The database is unavailable, so this page could not be loaded.',
    back: '← Back to pages',
    publishStatus: 'Publish status',
    pageInformation: 'Page information',
    blocks: 'Page blocks ({count})',
    noBlocksBefore: 'This page has no blocks yet. Run ',
    noBlocksAfter: ' to import the default home page blocks.',

    // 草稿与同步
    pendingTitle: 'Unpublished changes',
    pendingHint: 'Saving writes to a draft. Visitors still see the last published version until you publish.',
    translateHint:
      'Saves every form above first, then translates the Chinese into {count} languages. Translations go into the draft — they go live on publish.',
    syncStatus: 'Language sync',
    syncPending: '{count} languages still need translating',
    syncReady: 'Every language is up to date',
    syncFailed: '{count} languages failed — see the Language sync page',
    revisionLabel: 'Chinese version',

    // 版本
    versions: 'Version history',
    versionNote: 'Note (optional)',
    versionNotePlaceholder: 'e.g. before the spring campaign rewrite',
    saveVersion: 'Save a version',
    noVersions: 'No versions yet. Publishing saves one automatically.',
    versionPublished: 'Published',
    versionManual: 'Manual',
    untitled: 'Untitled',
    restoreVersion: 'Restore',
    releaseHint: 'Versions sharing this id were published together as one release.',
    versionHint:
      'Restoring writes the version back into the draft, not straight to the live site. Review it, then publish — so a mis-click is always reversible. At most three versions are kept.',
  },
  pageForm: {
    slug: 'slug',
    slugHint: 'Lowercase letters, digits and hyphens only',
    pageTitle: 'Page title',
    seoTitle: 'SEO title',
    seoTitleHint: 'Leave blank to use the page title',
    seoDescription: 'SEO description',
    save: 'Save page information',
  },
  pageStatus: {
    currentStatus: 'Current status:',
    published: 'Published',
    draft: 'Draft',
    moveToDraft: 'Move to draft',
    publish: 'Publish',
    publishChanges: 'Publish changes',
  },
  blockForm: {
    enabled: 'Enable this block (hidden from the public site when off)',
    title: 'Title',
    subtitle: 'Subtitle / description',
    body: 'Body (optional)',
    buttonLabel: 'Button label',
    buttonLink: 'Button link',
    buttonLinkHint: 'e.g. #inquiry or /zh/products',
    save: 'Save block',
  },
  audit: {
    title: 'Audit log',
    subtitle: 'Records sign-ins, sign-outs, creates, updates, publishes and deletes, most recent 200 entries.',
    dbUnavailable: 'The database is unavailable, so the audit log could not be loaded.',
    empty: 'No audit entries yet.',
    colTime: 'Time',
    colActor: 'Actor',
    colAction: 'Action',
    colTarget: 'Target',
    colSummary: 'Summary',
    colIp: 'IP',
  },
  labels: {
    // Content locale codes — the language being *edited*, not the admin UI language.
    contentLocales: {
      zh: 'Chinese (zh)',
      en: 'English (en)',
      vi: 'Vietnamese (vi)',
      es: 'Spanish (es)',
      ja: 'Japanese (ja)',
      ru: 'Russian (ru)',
      ar: 'Arabic (ar)',
      fr: 'French (fr)',
      ko: 'Korean (ko)',
      pt: 'Portuguese (pt)',
      hi: 'Hindi (hi)',
    },
    contactTypes: {
      EMAIL: 'Email',
      WHATSAPP: 'WhatsApp',
      PHONE: 'Phone',
      WECHAT: 'WeChat',
      ADDRESS: 'Address',
    },
    auditActions: {
      LOGIN: 'Sign in',
      LOGIN_FAILED: 'Failed sign in',
      LOGOUT: 'Sign out',
      CREATE: 'Create',
      UPDATE: 'Update',
      DELETE: 'Delete',
      PUBLISH: 'Publish',
      UNPUBLISH: 'Unpublish',
    },
    pageStatuses: {
      DRAFT: 'Draft',
      PUBLISHED: 'Published',
    },
    blocks: {
      hero: 'Hero',
      capabilities: 'Capabilities',
      products: 'Products',
      supply: 'Supply chain',
      quality: 'Quality & trust',
      inquiry: 'Inquiry CTA',
    },
  },
  validation: {
    invalidInput: 'Invalid input',
    emailInvalid: 'Please enter a valid email address',
    passwordMin: 'Password must be at least 8 characters',
    companyNameRequired: 'Please enter the company name',
    linkRequired: 'Please enter the link URL',
    linkFormat: 'The link must be a site path (starting with / or #) or an http(s) URL',
    pageTitleRequired: 'Please enter the page title',
    slugRequired: 'Please enter the slug',
    slugFormat: 'The slug may only contain lowercase letters, digits and hyphens',
  },
  actions: {
    sessionExpired: 'Your session has expired. Please sign in again and retry.',
    dbUnavailable:
      'The database is unavailable, so the change was not applied. Please check DATABASE_URL and the database service.',
    saveFailed: 'Save failed. Please try again later.',
    networkFailed:
      'The request did not reach the server. Check your connection and try again — nothing was changed.',
    deleteFailed: 'Delete failed. The record may no longer exist.',
    operationFailed: 'Operation failed. Please try again later.',
    // Sign in
    dbNotConfiguredLogin:
      'The database is not configured yet, so sign in is unavailable. Please contact your system administrator.',
    tooManyAttempts: 'Too many sign-in attempts. Please try again in about {minutes} minutes.',
    signInUnavailable: 'The sign-in service is temporarily unavailable. Please try again later.',
    incorrectCredentials: 'Incorrect email or password.',
    // Company profile
    companySaved: 'Company profile saved. The public site is now updated.',
    // Contacts
    contactNeedsValue: 'Please enter a value for at least one contact method (the shared value or any locale value).',
    contactSaved: 'Contact method saved. The public site is now updated.',
    contactDeleted: 'Contact method deleted.',
    // Navigation
    navNeedsLabel: 'Please enter a navigation label for at least one language.',
    navSaved: 'Navigation saved. The public site is now updated.',
    navDeleted: 'Nav item deleted.',
    // Pages & blocks
    pageMissing: 'The page does not exist.',
    slugTaken: 'That slug is already used by another page.',
    pageSaved: 'Page saved.',
    blockMissing: 'The block does not exist.',
    blockSaved: 'Block saved.',
    pagePublished: 'Page published. The public site is now updated.',
    pageDrafted: 'Page moved to draft. The public site has reverted.',
  },
  auditSummaries: {
    signedIn: 'Admin signed in',
    signedOut: 'Admin signed out',
    loginFailed: 'Failed sign in',
    companyProfileUpdated: 'Updated company profile',
    contactCreated: 'Created contact method',
    contactUpdated: 'Updated contact method',
    contactDeleted: 'Deleted contact method',
    navCreated: 'Created nav item',
    navUpdated: 'Updated nav item',
    navDeleted: 'Deleted nav item',
    pageUpdated: 'Updated page "{slug}"',
    blockUpdated: 'Updated block "{key}"',
    pagePublished: 'Published page "{slug}"',
    pageDrafted: 'Moved page "{slug}" to draft',
  },
    slug: {
      regenerate: 'Regenerate from the English name',
      regenerating: 'Generating…',
      nothingToUse: 'Fill in the product name first.',
      needsEnglishName:
        'There is no English name yet, and no API key is configured to generate one. Enter an English name, or configure DeepSeek under Translation settings.',
      englishNameFailed: 'Could not generate an English name. Please type one yourself.',
      generated: 'Generated "{slug}" from the English name.',
      generatedWithName: 'Generated the English name "{name}" and the web address "{slug}".',
    },
  translation: {
    settingsTitle: 'Machine translation',
    settingsSubtitle:
      'DeepSeek translates Chinese product content into the other languages. The key is stored on the server and is never sent to the browser.',
    apiKey: 'DeepSeek API key',
    apiKeyHint: 'Leave this empty to keep the current key unchanged.',
    apiKeyPlaceholder: 'sk-…',
    apiKeyCurrent: 'Current key: {masked}',
    apiKeyFromEnv: 'The key currently comes from the DEEPSEEK_API_KEY environment variable.',
    apiKeyMissing: 'No API key configured yet, so translation is unavailable.',
    keyUnreadable:
      'A key is stored, but the server cannot decrypt it — TRANSLATION_ENCRYPTION_KEY is missing or has changed. Translation is disabled so no failing calls are made. Restore the original key, or enter the API key again below.',
    baseUrl: 'API base URL',
    baseUrlHint:
      'Defaults to https://api.deepseek.com/v1. Change it only when going through a proxy or a compatible gateway.',
    model: 'Model',
    modelHint: 'Defaults to deepseek-chat.',
    settingsSaved: 'Translation settings saved.',

    button: 'Translate from Chinese',
    buttonHint: 'Into {count} languages: {languages}',
    translating: 'Translating…',
    overwrite: 'Overwrite existing translations',
    overwriteHint: 'Off by default: fields that already have content are left untouched.',

    success: 'Translated {fields} fields into {languages} languages.',
    partial: 'These languages could not be translated: {locales}',
    skipped: '{count} fields already had content and were left unchanged.',
    nothingApplied: 'Nothing was written — every target field already had content.',
    nothingToTranslate:
      'No empty fields need translating. Tick “Overwrite existing translations” if you want to translate them again.',
    highlightHint: 'Highlighted fields were filled by this translation. Review them, then publish when ready.',

    emptySource: 'Please fill in the Chinese content first.',
    tooLarge: 'The Chinese content is too long for a single request. Translate fewer fields at a time.',

    notConfigured: 'DeepSeek is not configured yet. Add an API key under Translation settings.',
    errorAuth: 'DeepSeek rejected the API key. Check it under Translation settings.',
    errorRateLimit: 'DeepSeek is rate limiting. Wait a moment and try again.',
    errorTimeout: 'DeepSeek did not respond in time. Try again, or translate fewer fields at once.',
    errorServer: 'DeepSeek returned an error. Please try again shortly.',
    errorNetwork: 'Could not reach DeepSeek. Check the server network.',
    errorBadResponse: 'DeepSeek returned something unexpected, so nothing was written.',
    auditSummary: 'Machine-translated product content',
    errorRateLimited: 'Too many translation requests just now. Wait a minute and try again.',
    errorBusy: 'Another translation is already running. Wait for it to finish and try again.',
    encryptionMissing:
      'Refused to save: TRANSLATION_ENCRYPTION_KEY is not set on the server, and storing the key in plain text is not allowed.',

    // ---- 发布时自带的同步保险 ----
    publishSyncing:
      'Translating the latest Chinese into the other languages… {completed} of {total} done.',
    publishSyncFailed:
      'Not published: some languages could not be translated, so the live site was left untouched. Fix the cause, then press publish again.',
    publishSyncNotConfigured:
      'Publishing now requires every language to be up to date, but DeepSeek is not configured. Add an API key under Translation settings.',
    publishSyncChanged:
      'The Chinese content changed while it was being translated. Press publish again to sync from the latest version.',
    publishSyncStillPending: 'Some fields are still waiting to be translated. Press publish again to continue.',
  },

  // ---------------------------------------------------------------------------
  // 应急发布
  // ---------------------------------------------------------------------------
  emergency: {
    button: 'Emergency publish Chinese only, sync other languages later',
    title: 'Emergency publish',
    hint:
      'Only the Chinese content goes live now. Every other language keeps showing its last published version — nothing is cleared, and no translation is invented. Use this only while the translation service is down.',
    reasonLabel: 'Why are you publishing without translations?',
    reasonPlaceholder: 'e.g. DeepSeek is timing out and the price change cannot wait',
    reasonRequired: 'Please give a short reason — it is recorded in the audit log.',
    confirm: 'Publish Chinese only',
    cancel: 'Cancel',

    failureTimeout: 'The translation service timed out.',
    failureNetwork: 'The translation service could not be reached.',
    failureRateLimit: 'The translation service is rate limiting us (429).',
    failureServer: 'The translation service returned an error (5xx).',
    failureUnknown: 'The translation service is unavailable.',

    blockedConfig:
      'This is a configuration problem, not an outage. Fix the translation settings, then publish again.',
    blockedContent:
      'This failure is about the content, not the service. Fix the reported problem, then publish again.',
    blockedNoneNeeded: 'Every language is already up to date — just publish normally.',
    blockedUnknown: 'This failure cannot be attributed to the translation service, so emergency publish is not offered.',

    staleWarning:
      'These languages stay on their previous published version until the translation catches up: {locales}.',
    missingWarning: 'These languages have no content at all and remain unavailable: {locales}.',

    statusPending: 'Translations outstanding',
    pendingBarOne: '1 piece of content was published in Chinese only — its other languages are still catching up.',
    pendingBarMany: '{count} pieces of content were published in Chinese only — their other languages are still catching up.',
    pendingBarAction: 'Open language sync',
    statusPendingHint:
      'Chinese was published without translations. A catch-up job has been queued and will run automatically once the translation service recovers.',
    retryNow: 'Retry now',
    queued: 'Catch-up job queued. It will finish on its own once translations succeed.',
    allDone: 'All languages are up to date.',

    auditSummary: 'Emergency publish (Chinese only)',
    releaseNote: 'Chinese published without translations',
    publishFailed: 'Emergency publish failed.',
  },
  // ---------------------------------------------------------------------------
  // 语言同步中心
  // ---------------------------------------------------------------------------
  sync: {
    title: 'Language sync',
    subtitle:
      'Chinese is the only source. This page shows, for every piece of published content, how far the other languages have been brought up to date.',
    navLabel: 'Language sync',

    contentTypeProduct: 'Product',
    contentTypePage: 'Page',
    contentTypeCompany: 'Company profile',
    contentTypeContact: 'Contact method',
    contentTypeNav: 'Navigation',
    contentTypeCategory: 'Category',
    contentTypeAsset: 'Media',

    colContent: 'Content',
    colType: 'Type',
    colRevision: 'Chinese version',
    colSynced: 'Synced',
    colPending: 'Pending',
    colFailed: 'Failed',
    colStatus: 'Status',
    colLastSynced: 'Last synced',

    stateSynced: 'Up to date',
    statePartial: 'Partly out of date',
    stateStale: 'Out of date',
    stateFailed: 'Failed',
    stateEmpty: 'Nothing to translate',

    countOf: '{done} / {total} languages',
    revisionValue: 'v{revision}',
    revisionChanged: 'Chinese changed — translations are out of date',
    neverSynced: 'Never',

    syncOne: 'Sync',
    syncAll: 'Sync all published content',
    forceAll: 'Re-translate every language',
    forceHint:
      'Regenerates every field, including translations that are already up to date. Existing wording written by hand will be overwritten. Only use it when you believe the translations are wrong.',
    retryFailed: 'Retry failed only',
    viewErrors: 'View errors',
    hideErrors: 'Hide errors',
    refresh: 'Refresh',

    running: 'Syncing…',
    done: 'Sync finished.',
    nothingToDo: 'Everything is already up to date — no request was sent.',

    jobSummary: '{completed} of {total} done, {failed} failed',
    jobRequests: '{count} requests',
    jobTokens: '≈{count} tokens',
    jobStatusPending: 'Queued',
    jobStatusRunning: 'Running',
    jobStatusSucceeded: 'Succeeded',
    jobStatusPartial: 'Partly succeeded',
    jobStatusFailed: 'Failed',
    jobStatusCancelled: 'Cancelled',

    recentJobs: 'Recent jobs',
    noJobs: 'No sync jobs yet.',

    empty: 'No published Chinese content yet.',
    errorsTitle: 'Failed items',
    errorNotConfigured: 'DeepSeek is not configured.',
    errorAuth: 'The API key was rejected.',
    errorRateLimit: 'Rate limited by DeepSeek.',
    errorTimeout: 'The request timed out.',
    errorNetwork: 'Could not reach DeepSeek.',
    errorServer: 'DeepSeek returned an error.',
    errorBadResponse: 'The response was not in the expected shape.',
    errorIncomplete: 'Some fields were not returned.',
    errorUnknown: 'Unknown error.',
    errorSourceChanged: 'The Chinese content changed during the sync.',
    errorStillPending: 'Some fields are still out of date.',

    dbUnavailable: 'The database is not reachable right now.',
    notFound: 'That content no longer exists.',
  },
  media: mediaMessagesEn,
  productCategories: productCategoryMessagesEn,
  products: productMessagesEn,
};

export type AdminMessages = typeof en;

const zh: AdminMessages = {
  common: {
    save: '保存',
    saving: '保存中…',
    saveChanges: '保存修改',
    add: '添加',
    cancel: '取消',
    delete: '删除',
    deleting: '删除中…',
    confirmDelete: '确认删除',
    deleteWarning: '此操作无法撤销 —— 商品、图片、规格参数与版本历史都会一并删除。',
    deleteConfirmDefault: '确定删除此项？该操作无法撤销。',
    edit: '编辑',
    enabled: '已启用',
    disabled: '已停用',
    visible: '显示中',
    hidden: '已隐藏',
    orderValue: '排序 {order}',
    untitled: '（未命名）',
    processing: '处理中…',
  },
  localeSwitcher: {
    label: '后台语言',
  },
  nav: {
    ariaLabel: '后台导航',
    dashboard: '仪表盘',
    company: '公司资料',
    contacts: '联系方式',
    navigation: '导航菜单',
    pages: '页面与区块',
    media: '媒体库',
    productCategories: '商品分类',
    products: '商品',
    audit: '操作日志',
    translationSettings: '翻译设置',
    sync: '语言同步',
  },
  shell: {
    subtitle: '内容管理后台',
    headerTitle: '仪表盘',
    viewPublicSite: '查看官网 ↗',
    signOut: '退出登录',
  },
  loginPage: {
    subtitle: '内容管理后台登录',
    restrictedBefore: '仅限授权管理员访问。系统不开放自助注册，账号通过命令',
    restrictedAfter: '创建。',
  },
  loginForm: {
    dbMissingBefore: '数据库尚未配置（缺少 ',
    dbMissingAfter: '），暂时无法登录。请参阅 README 完成数据库初始化。',
    email: '邮箱',
    password: '密码',
    signIn: '登录',
    signingIn: '登录中…',
  },
  dashboard: {
    title: '仪表盘',
    subtitle: '站点内容与近期操作概览。',
    dbMissingBefore: '数据库尚未配置（缺少 ',
    dbMissingAfter:
      '）。统计与内容管理暂不可用；官网将回退到内置文案并保持正常访问。请参阅 README 完成数据库初始化。',
    dbUnavailable: '无法连接数据库，统计信息暂不可用。请检查数据库服务与连接字符串。',
    statistics: '统计',
    totalPages: '页面总数',
    publishedPages: '已发布页面',
    draftPages: '草稿页面',
    products: '产品',
    assets: '素材',
    inquiries: '询盘',
    recentActivity: '近期操作',
    viewAll: '查看全部',
    noActivity: '暂无操作记录。',
  },
  company: {
    title: '公司资料',
    subtitle: '三种语言下的公司名称、简介、定位、地址、营业时间与默认 SEO。保存后立即在官网生效。',
  },
  companyForm: {
    companyName: '公司名称',
    tagline: '一句话简介',
    about: '公司简介',
    positioning: '市场定位',
    address: '地址',
    businessHours: '营业时间',
    seoTitle: '默认 SEO 标题',
    seoTitleHint: '留空将自动使用「公司名称 — 默认标题」',
    seoDescription: '默认 SEO 描述',
    save: '保存公司资料',
  },
  contacts: {
    title: '联系方式',
    subtitle: '仅「已启用」且填写了值的联系方式会展示在官网。若均未填写，官网不会显示任何占位联系方式。',
    dbUnavailable: '数据库不可用，无法加载联系方式。请检查 DATABASE_URL 与数据库服务。',
    existing: '现有联系方式（{count}）',
    empty: '暂无联系方式。添加后将展示在官网。',
    noSharedValue: '（无共享值）',
    addTitle: '添加联系方式',
    deleteConfirm: '确定删除该联系方式？删除后将立即从官网移除。',
  },
  contactForm: {
    type: '类型',
    displayOrder: '展示顺序',
    displayOrderHint: '数字越小越靠前',
    sharedValue: '共享值',
    sharedValueHint: '邮箱地址 / 电话 / WhatsApp 号码等（所有语言共用）',
    customLink: '自定义链接（可选）',
    customLinkHint: '留空将根据类型自动生成 mailto: / tel: / wa.me 链接',
    enabled: '已启用（仅在启用时展示于官网）',
    displayTextSection: ' · 展示文案',
    displayLabel: '展示名称（留空则使用类型默认值）',
    valueForLocale: '该语言的展示值（例如地址文本）',
    valueForLocaleHint: '留空则使用上方的共享值',
  },
  navigation: {
    title: '导航菜单',
    subtitle: '管理官网顶部导航。若未配置，官网将使用内置导航（指向首页各板块的锚点）。',
    dbUnavailable: '数据库不可用，无法加载导航配置。',
    existing: '现有导航项（{count}）',
    empty: '暂无自定义导航，官网正在使用内置导航。请在下方添加。',
    addTitle: '添加导航项',
    deleteConfirm: '确定删除该导航项？',
  },
  navForm: {
    linkUrl: '链接地址',
    linkUrlHint: '站内路径（以 / 或 # 开头）或完整的 http(s) 链接',
    displayOrder: '展示顺序',
    displayOrderHint: '数字越小越靠前',
    enabled: '已启用（仅在启用时展示于官网）',
    external: '外部链接（在新窗口打开）',
    labelSection: ' · 导航名称',
    label: '名称',
  },
  pages: {
    title: '页面与区块',
    subtitle: '管理页面信息（标题、slug、SEO）以及首页各区块的内容。页面处于草稿状态时，官网使用内置文案。',
    dbUnavailable: '数据库不可用，无法加载页面。',
    noDataBefore: '暂无页面数据。运行 ',
    noDataAfter: ' 可导入首页初始内容。',
    colPage: '页面',
    colSlug: 'slug',
    colBlocks: '区块数',
    colStatus: '状态',
    home: '首页',

    // 页面发布前会被拦下的三种情况，以及版本操作
    validationTitle: '发布前请先填写中文页面标题。',
    seoWithoutTitle: '某种语言只填了 SEO 而没有标题。请补上标题，或清掉该语言的 SEO 字段。',
    duplicateKeys: '有两个区块用了同一个 key（{keys}）。同一页面内区块 key 必须唯一。',
    versionSaved: '已存档一个版本。',
    versionRestored: '已把该版本恢复到草稿。确认无误后再发布。',
    versionMissing: '该版本已不存在。',
    versionDeleted: '已删除该版本。',
  },
  pageDetail: {
    dbUnavailable: '数据库不可用，无法加载该页面。',
    back: '← 返回页面列表',
    publishStatus: '发布状态',
    pageInformation: '页面信息',
    blocks: '页面区块（{count}）',
    noBlocksBefore: '该页面暂无区块。运行 ',
    noBlocksAfter: ' 可导入首页默认区块。',

    // 草稿与同步
    pendingTitle: '有未发布的改动',
    pendingHint: '保存只写草稿。在你点发布之前，访客看到的仍是上一版已发布的内容。',
    translateHint:
      '先保存上面每一个表单，再把这些中文翻译成 {count} 种语言。译文写进草稿，发布时才对外生效。',
    syncStatus: '语言同步',
    syncPending: '还有 {count} 种语言待翻译',
    syncReady: '所有语言都已是最新',
    syncFailed: '{count} 种语言失败，详见「语言同步」页',
    revisionLabel: '中文版本',

    // 版本
    versions: '版本历史',
    versionNote: '备注（可填）',
    versionNotePlaceholder: '例如：春季改版之前',
    saveVersion: '存档一版',
    noVersions: '还没有版本。发布时会自动留一版。',
    versionPublished: '发布',
    versionManual: '手动存档',
    untitled: '未命名',
    restoreVersion: '恢复',
    releaseHint: 'releaseId 相同的版本是同一次发布一起上线的。',
    versionHint:
      '「恢复」是把该版本写回草稿，不会直接改线上。确认无误后再点发布 —— 所以误点也能再退回去。最多保留三个版本。',
  },
  pageForm: {
    slug: 'slug',
    slugHint: '仅可包含小写字母、数字与连字符',
    pageTitle: '页面标题',
    seoTitle: 'SEO 标题',
    seoTitleHint: '留空则使用页面标题',
    seoDescription: 'SEO 描述',
    save: '保存页面信息',
  },
  pageStatus: {
    currentStatus: '当前状态：',
    published: '已发布',
    draft: '草稿',
    moveToDraft: '转为草稿',
    publish: '发布',
    publishChanges: '发布更改',
  },
  blockForm: {
    enabled: '启用该区块（关闭后不在官网显示）',
    title: '标题',
    subtitle: '副标题 / 描述',
    body: '正文（可选）',
    buttonLabel: '按钮文字',
    buttonLink: '按钮链接',
    buttonLinkHint: '例如 #inquiry 或 /zh/products',
    save: '保存区块',
  },
  audit: {
    title: '操作日志',
    subtitle: '记录登录、退出、创建、更新、发布与删除操作，最多显示最近 200 条。',
    dbUnavailable: '数据库不可用，无法加载操作日志。',
    empty: '暂无操作记录。',
    colTime: '时间',
    colActor: '操作人',
    colAction: '操作',
    colTarget: '对象',
    colSummary: '摘要',
    colIp: 'IP',
  },
  labels: {
    contentLocales: {
      zh: '中文 (zh)',
      en: '英语 (en)',
      vi: '越南语 (vi)',
      es: '西班牙语 (es)',
      ja: '日语 (ja)',
      ru: '俄语 (ru)',
      ar: '阿拉伯语 (ar)',
      fr: '法语 (fr)',
      ko: '韩语 (ko)',
      pt: '葡萄牙语 (pt)',
      hi: '印地语 (hi)',
    },
    contactTypes: {
      EMAIL: '邮箱',
      WHATSAPP: 'WhatsApp',
      PHONE: '电话',
      WECHAT: '微信',
      ADDRESS: '地址',
    },
    auditActions: {
      LOGIN: '登录',
      LOGIN_FAILED: '登录失败',
      LOGOUT: '退出登录',
      CREATE: '创建',
      UPDATE: '更新',
      DELETE: '删除',
      PUBLISH: '发布',
      UNPUBLISH: '取消发布',
    },
    pageStatuses: {
      DRAFT: '草稿',
      PUBLISHED: '已发布',
    },
    blocks: {
      hero: '首屏',
      capabilities: '能力介绍',
      products: '产品',
      supply: '供应链',
      quality: '质量与信任',
      inquiry: '询盘引导',
    },
  },
  validation: {
    invalidInput: '输入有误',
    emailInvalid: '请输入有效的邮箱地址',
    passwordMin: '密码至少需要 8 个字符',
    companyNameRequired: '请输入公司名称',
    linkRequired: '请输入链接地址',
    linkFormat: '链接必须是以 / 或 # 开头的站内路径，或 http(s) 链接',
    pageTitleRequired: '请输入页面标题',
    slugRequired: '请输入 slug',
    slugFormat: 'slug 只能包含小写字母、数字与连字符',
  },
  actions: {
    sessionExpired: '登录状态已过期，请重新登录后再试。',
    dbUnavailable: '数据库不可用，本次修改未生效。请检查 DATABASE_URL 与数据库服务。',
    saveFailed: '保存失败，请稍后重试。',
    networkFailed: '请求没有送到服务器。请检查网络后重试 —— 当前内容没有被改动。',
    deleteFailed: '删除失败，记录可能已不存在。',
    operationFailed: '操作失败，请稍后重试。',
    dbNotConfiguredLogin: '数据库尚未配置，暂时无法登录。请联系系统管理员。',
    tooManyAttempts: '登录尝试过于频繁。请约 {minutes} 分钟后重试。',
    signInUnavailable: '登录服务暂时不可用，请稍后重试。',
    incorrectCredentials: '邮箱或密码不正确。',
    companySaved: '公司资料已保存，官网已更新。',
    contactNeedsValue: '请至少为一种联系方式填写值（共享值或任一语言的值）。',
    contactSaved: '联系方式已保存，官网已更新。',
    contactDeleted: '联系方式已删除。',
    navNeedsLabel: '请至少为一种语言填写导航名称。',
    navSaved: '导航已保存，官网已更新。',
    navDeleted: '导航项已删除。',
    pageMissing: '该页面不存在。',
    slugTaken: '该 slug 已被其他页面占用。',
    pageSaved: '页面已保存。',
    blockMissing: '该区块不存在。',
    blockSaved: '区块已保存。',
    pagePublished: '页面已发布，官网已更新。',
    pageDrafted: '页面已转为草稿，官网已还原。',
  },
  auditSummaries: {
    signedIn: '管理员已登录',
    signedOut: '管理员已退出登录',
    loginFailed: '登录失败',
    companyProfileUpdated: '更新了公司资料',
    contactCreated: '创建了联系方式',
    contactUpdated: '更新了联系方式',
    contactDeleted: '删除了联系方式',
    navCreated: '创建了导航项',
    navUpdated: '更新了导航项',
    navDeleted: '删除了导航项',
    pageUpdated: '更新了页面「{slug}」',
    blockUpdated: '更新了区块「{key}」',
    pagePublished: '发布了页面「{slug}」',
    pageDrafted: '将页面「{slug}」转为草稿',
  },
    slug: {
      regenerate: '根据英文名称重新生成',
      regenerating: '生成中…',
      nothingToUse: '请先填写商品名称。',
      needsEnglishName:
        '还没有英文名称，而且没有配置 API Key 来生成英文名。请先手填一个英文名，或到「翻译设置」里配置 DeepSeek。',
      englishNameFailed: '没能生成英文名称，请手动填写一个。',
      generated: '已根据英文名称生成「{slug}」。',
      generatedWithName: '已生成英文名称「{name}」与网址后缀「{slug}」。',
    },
  translation: {
    settingsTitle: '机器翻译',
    settingsSubtitle:
      '使用 DeepSeek 把商品的中文内容翻译成其它语言。密钥保存在服务端，绝不会下发到浏览器。',
    apiKey: 'DeepSeek API Key',
    apiKeyHint: '留空表示不修改当前密钥。',
    apiKeyPlaceholder: 'sk-…',
    apiKeyCurrent: '当前密钥：{masked}',
    apiKeyFromEnv: '当前密钥来自环境变量 DEEPSEEK_API_KEY。',
    apiKeyMissing: '还没有配置 API Key，翻译功能暂时不可用。',
    keyUnreadable:
      '库里存了密钥，但服务器解不开 —— TRANSLATION_ENCRYPTION_KEY 缺失或已被更换。翻译已停用，不会反复发起无效调用。请恢复原密钥，或在下方重新填入 API Key。',
    baseUrl: 'API 地址',
    baseUrlHint: '默认 https://api.deepseek.com/v1。只有走代理或兼容网关时才需要改。',
    model: '模型',
    modelHint: '默认 deepseek-chat。',
    settingsSaved: '翻译设置已保存。',

    button: '一键翻译',
    buttonHint: '将翻译为 {count} 种语言：{languages}',
    translating: '正在翻译…',
    overwrite: '覆盖已有翻译',
    overwriteHint: '默认关闭：已经有内容的字段保持不动。',

    success: '已把 {fields} 个字段翻译成 {languages} 种语言。',
    partial: '以下语言没有翻译成功：{locales}',
    skipped: '有 {count} 个字段已有内容，已跳过。',
    nothingApplied: '没有写入任何内容 —— 所有目标字段都已经有内容了。',
    nothingToTranslate: '没有需要翻译的空白字段；如需重新翻译，请勾选「覆盖已有翻译」。',
    highlightHint: '带高亮的字段是本次翻译填入的。请先检查，确认后点「发布」才会对外生效。',

    emptySource: '请先填写需要翻译的中文内容。',
    tooLarge: '中文内容太长，一次请求装不下。请分几次翻译。',

    notConfigured: 'DeepSeek 还没有配置。请先在「翻译设置」里填入 API Key。',
    errorAuth: 'DeepSeek 拒绝了这把 API Key，请在「翻译设置」里检查。',
    errorRateLimit: 'DeepSeek 触发了限流，稍等片刻再试。',
    errorTimeout: 'DeepSeek 响应超时。可以重试，或一次少翻译几个字段。',
    errorServer: 'DeepSeek 返回了错误，请稍后重试。',
    errorNetwork: '连不上 DeepSeek，请检查服务器网络。',
    errorBadResponse: 'DeepSeek 返回的内容不是预期结构，本次没有写入任何内容。',
    auditSummary: '机器翻译了商品内容',
    errorRateLimited: '刚刚发起的翻译太多了，请等一分钟再试。',
    errorBusy: '已经有一个翻译在进行中，请等它结束后再试。',
    encryptionMissing:
      '已拒绝保存：服务器没有配置 TRANSLATION_ENCRYPTION_KEY，而明文存储密钥是不允许的。',

    // ---- 发布时自带的同步保险 ----
    publishSyncing: '正在把最新中文同步到其它语言……已完成 {completed} / {total}。',
    publishSyncFailed:
      '未发布：部分语言没能翻译成功，线上内容保持原样。处理原因后再点一次发布。',
    publishSyncNotConfigured:
      '现在发布要求所有语言都是最新的，但 DeepSeek 还没有配置。请先在「翻译设置」里填入 API Key。',
    publishSyncChanged: '翻译过程中中文被修改过。请再点一次发布，从最新版本重新同步。',
    publishSyncStillPending: '还有字段在等待翻译。请再点一次发布继续。',
  },

  // ---------------------------------------------------------------------------
  // 应急发布
  // ---------------------------------------------------------------------------
  emergency: {
    button: '应急发布中文，其他语言稍后同步',
    title: '应急发布',
    hint:
      '现在只有中文会上线。其它语言继续显示各自上一次成功发布的版本 —— 不会被清空，也不会生成任何虚假译文。只在翻译服务不可用时使用。',
    reasonLabel: '为什么不等译文一起发布？',
    reasonPlaceholder: '例如：DeepSeek 一直超时，价格改动不能再等',
    reasonRequired: '请填写一句简短原因 —— 它会记进审计日志。',
    confirm: '仅发布中文',
    cancel: '取消',

    failureTimeout: '翻译服务请求超时。',
    failureNetwork: '连不上翻译服务。',
    failureRateLimit: '翻译服务触发了限流（429）。',
    failureServer: '翻译服务返回错误（5xx）。',
    failureUnknown: '翻译服务暂时不可用。',

    blockedConfig: '这是配置问题，不是服务故障。请先修好翻译设置再发布。',
    blockedContent: '这次失败与内容有关，不是服务故障。请先解决报出的问题再发布。',
    blockedNoneNeeded: '所有语言都已经是最新的，正常发布即可。',
    blockedUnknown: '这次失败无法归因到翻译服务，因此不提供应急发布。',

    staleWarning: '在译文补齐之前，这些语言继续显示上一次成功发布的版本：{locales}。',
    missingWarning: '这些语言完全没有内容，暂时不可用：{locales}。',

    statusPending: '多语言待同步',
    pendingBarOne: '有 1 条内容只发布了中文 —— 其它语言还在补齐。',
    pendingBarMany: '有 {count} 条内容只发布了中文 —— 其它语言还在补齐。',
    pendingBarAction: '打开语言同步',
    statusPendingHint:
      '中文已在没有译文的情况下发布。补齐任务已经排好，翻译服务恢复后会自动跑完。',
    retryNow: '立即重试',
    queued: '补齐任务已排好。译文成功之后它会自己跑完。',
    allDone: '所有语言都已是最新。',

    auditSummary: '应急发布（仅中文）',
    releaseNote: '中文在没有译文的情况下发布',
    publishFailed: '应急发布失败。',
  },
  // ---------------------------------------------------------------------------
  // 语言同步中心
  // ---------------------------------------------------------------------------
  sync: {
    title: '语言同步',
    subtitle:
      '中文是唯一母版。这里显示每一条已发布内容的中文改动，在各语言上同步到了什么程度。',
    navLabel: '语言同步',

    contentTypeProduct: '商品',
    contentTypePage: '页面',
    contentTypeCompany: '公司资料',
    contentTypeContact: '联系方式',
    contentTypeNav: '导航',
    contentTypeCategory: '类目',
    contentTypeAsset: '素材',

    colContent: '内容',
    colType: '类型',
    colRevision: '中文版本',
    colSynced: '已同步',
    colPending: '待同步',
    colFailed: '失败',
    colStatus: '状态',
    colLastSynced: '最后同步',

    stateSynced: '已是最新',
    statePartial: '部分过期',
    stateStale: '已过期',
    stateFailed: '失败',
    stateEmpty: '无需翻译',

    countOf: '{done} / {total} 种语言',
    revisionValue: '第 {revision} 版',
    revisionChanged: '中文已改动，译文待更新',
    neverSynced: '从未',

    syncOne: '同步',
    syncAll: '同步全部已发布中文内容',
    forceAll: '重新翻译全部语言',
    forceHint:
      '把所有字段重新生成一遍，包括已经是最新的译文。人工写过的措辞会被覆盖。只在你确信译文有问题时使用。',
    retryFailed: '只重试失败内容',
    viewErrors: '查看错误',
    hideErrors: '收起错误',
    refresh: '刷新',

    running: '正在同步……',
    done: '同步完成。',
    nothingToDo: '全部都已是最新，没有发起任何请求。',

    jobSummary: '已完成 {completed} / {total}，失败 {failed}',
    jobRequests: '{count} 次请求',
    jobTokens: '约 {count} tokens',
    jobStatusPending: '排队中',
    jobStatusRunning: '进行中',
    jobStatusSucceeded: '成功',
    jobStatusPartial: '部分成功',
    jobStatusFailed: '失败',
    jobStatusCancelled: '已取消',

    recentJobs: '最近任务',
    noJobs: '还没有同步任务。',

    empty: '还没有已发布的中文内容。',
    errorsTitle: '失败明细',
    errorNotConfigured: 'DeepSeek 还没有配置。',
    errorAuth: 'API Key 被拒绝。',
    errorRateLimit: '被 DeepSeek 限流。',
    errorTimeout: '请求超时。',
    errorNetwork: '连不上 DeepSeek。',
    errorServer: 'DeepSeek 返回了错误。',
    errorBadResponse: '返回内容不是预期结构。',
    errorIncomplete: '有字段没有翻出来。',
    errorUnknown: '未知错误。',
    errorSourceChanged: '同步过程中中文被修改过。',
    errorStillPending: '仍有字段处于待同步状态。',

    dbUnavailable: '数据库暂时连不上。',
    notFound: '这条内容已经不存在了。',
  },
  media: mediaMessagesZh,
  productCategories: productCategoryMessagesZh,
  products: productMessagesZh,
};

const MESSAGES: Record<AdminUiLocale, AdminMessages> = { en, zh };

export function getAdminMessages(locale: AdminUiLocale): AdminMessages {
  return MESSAGES[locale] ?? en;
}

export function isAdminUiLocale(value: string): value is AdminUiLocale {
  return (ADMIN_UI_LOCALES as readonly string[]).includes(value);
}

/** Fill `{token}` placeholders in a message, leaving unknown tokens untouched. */
export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

/** Read the admin UI locale from the cookie. Never throws. */
export async function getAdminLocale(): Promise<AdminUiLocale> {
  try {
    // Lazy so this module stays importable from client components (see the note at the top).
    const { cookies } = await import('next/headers');
    const store = await cookies();
    const value = store.get(ADMIN_LOCALE_COOKIE)?.value;
    if (value && isAdminUiLocale(value)) return value;
  } catch {
    // `cookies()` is unavailable outside a request scope — fall back to the default.
  }
  return DEFAULT_ADMIN_UI_LOCALE;
}

/** Locale + messages for the current request (server components and server actions). */
export async function getAdminMessagesForRequest(): Promise<{
  locale: AdminUiLocale;
  t: AdminMessages;
}> {
  const locale = await getAdminLocale();
  return { locale, t: getAdminMessages(locale) };
}

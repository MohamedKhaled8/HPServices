# Graph Report - hp_services  (2026-11-22)

## Corpus Check
- 135 files · ~407,890 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1758 nodes · 4141 edges · 146 communities (94 shown, 52 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Assignment Modals and Viewing (1)
- Telemetry and Audit Logging (1)
- Telemetry and Audit Logging (2)
- Media Assets and Cloudinary Storage (1)
- Assignment Management and Workflows (1)
- Assignment Modals and Viewing (2)
- Telemetry and Audit Logging (3)
- Admin AI Assistant and FAQ (1)
- Assignment Management and Workflows (2)
- Firebase Data and Storage Services (1)
- Assignment Management and Workflows (3)
- Telemetry and Audit Logging (4)
- Assignment Modals and Viewing (3)
- Admin Dashboard Config Tabs (1)
- Telemetry and Audit Logging (5)
- Drive API and IP Ingestion (1)
- Admin AI Assistant and FAQ (2)
- Telemetry and Audit Logging (6)
- Telemetry and Audit Logging (7)
- Assignment Modals and Viewing (4)
- Admin AI Assistant and FAQ (3)
- Telemetry and Audit Logging (8)
- Firebase Data and Storage Services (2)
- Firebase Data and Storage Services (3)
- Assignment Management and Workflows (4)
- services / AdminStatisticsTab
- Firebase Data and Storage Services (4)
- Assignment Management and Workflows (5)
- Firebase Data and Storage Services (5)
- tsconfig / tsconfigjson
- automationSetupAll / automationSetupAllc
- Application Shell and Routing (1)
- Assignment Modals and Viewing (5)
- package / packagejson
- Telemetry and Audit Logging (9)
- Telemetry and Audit Logging (10)
- Shared UI Modals and Controls (1)
- Shared UI Modals and Controls (2)
- runVercelEnvAddPs / provisionAutomationC
- spawnVercelEnvAdd / pushAutomationPublic
- Firebase Data and Storage Services (6)
- Backend Services and Automation (1)
- Telemetry and Audit Logging (11)
- Application Shell and Routing (2)
- Admin AI Assistant and FAQ (4)
- Admin AI Assistant and FAQ (5)
- Backend Services and Automation (2)
- compareVercelPulledPublic / compareVerce
- adminNavigation / AdminSidebarNav
- Telemetry and Audit Logging (12)
- Telemetry and Audit Logging (13)
- Assignment Modals and Viewing (6)
- package / devDependencies
- restoreAutomationPublicToEnvLocal / upse
- Admin AI Assistant and FAQ (6)
- Backend Services and Automation (3)
- Firebase Data and Storage Services (7)
- Media Assets and Cloudinary Storage (2)
- Firebase Data and Storage Services (8)
- Assignment Management and Workflows (6)
- Assignment Modals and Viewing (7)
- Backend Services and Automation (4)
- Backend Services and Automation (5)
- Firebase Data and Storage Services (9)
- verifyAutomationKeyPair / verifyAutomati
- Admin Dashboard Config Tabs (2)
- Telemetry and Audit Logging (14)
- Telemetry and Audit Logging (15)
- Drive API and IP Ingestion (2)
- AdminWhatsAppTab / package
- setVercelAutomationApiUrl / setVercelAut
- Assignment Management and Workflows (7)
- FILE_UPLOAD_IMPROVEMENTS / FILE_UPLOAD_I
- Telemetry and Audit Logging (16)
- Firebase Data and Storage Services (10)
- Drive API and IP Ingestion (3)
- tsconfig.node / tsconfignodejson
- Shared UI Modals and Controls (3)
- Firebase Data and Storage Services (11)
- Firebase Data and Storage Services (12)
- Firebase Data and Storage Services (13)
- ServiceCard / ServiceCardtsx
- Application Shell and Routing (3)
- Firebase Data and Storage Services (14)
- Backend Services and Automation (6)
- Media Assets and Cloudinary Storage (3)
- Firebase Data and Storage Services (15)
- README_ADMIN_FIX / README_ADMIN_FIXmd
- Firebase Data and Storage Services (16)
- Backend Services and Automation (7)
- Backend Services and Automation (8)
- Backend Services and Automation (9)
- Application Shell and Routing (4)
- Authentication and Access Control
- Assignment Management and Workflows (8)
- SideNav / SideNavtsx
- Application Shell and Routing (5)
- vite-env.d / vite-envdts
- vercel / verceljson
- Backend Services and Automation (10)
- 0T8A9628 / HP University Center Graduati
- 0T8A9638 / HP Graduation Group Photo wit
- 4W3A0163 / HP University Center Graduati
- 4W3A0388 / HP University Center HP Ballo
- 0T8A9887 / HP University Center Large Gr
- 0T8A9970 / HP Graduation Outdoor Smiling
- 4W3A0167 / HP University Center Arms Rai
- 4W3A0215 / HP University Center Mixed St
- 4W3A0410 / HP University Center Portrait
- REFACTOR_REPORT / useAdminConfigs Hook A
- REFACTOR_REPORT / useAdminRowFlags Hook 
- REFACTOR_REPORT / useAdminStatsLock Hook
- Admin User Management

## God Nodes (most connected - your core abstractions)
1. `react` - 117 edges
2. `lucide-react` - 86 edges
3. `AssignmentsManagementPage()` - 41 edges
4. `StudentData` - 40 edges
5. `ServiceRequest` - 30 edges
6. `AdminRequestsTab()` - 28 edges
7. `TrackKey` - 26 edges
8. `logger` - 22 edges
9. `TelemetrySession` - 22 edges
10. `App()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `AdminWhatsAppTabProps` --references--> `StudentData`  [EXTRACTED]
  src/components/admin/AdminWhatsAppTab.tsx → src/types/index.ts
- `RowItemData` --references--> `StudentData`  [EXTRACTED]
  src/page/AllUsersPage.tsx → src/types/index.ts
- `AdminStatisticsTabProps` --references--> `ServiceRequest`  [EXTRACTED]
  src/components/admin/AdminStatisticsTab.tsx → src/types/index.ts
- `HP University Center Graduation Celebration Crowd` --semantically_similar_to--> `HP University Center Staff and Students Group Outdoor`  [INFERRED] [semantically similar]
  public/images/optimized/0T8A9628.webp → public/images/optimized/0T8A9717.webp
- `HP Graduation Group Photo with Congratulations Frame 2025` --semantically_similar_to--> `HP Graduation Backdrop Group Photo`  [INFERRED] [semantically similar]
  public/images/optimized/0T8A9638.webp → public/images/optimized/0T8A9748.webp

## Import Cycles
- 2-file cycle: `src/services/firebaseService.ts -> src/services/studentTrackSyncService.ts -> src/services/firebaseService.ts`

## Hyperedges (group relationships)
- **HP University Center Graduation Event Photos** — public_images_optimized_0t8a9628_hp_celebration_crowd, public_images_optimized_0t8a9638_graduation_group_indoor, public_images_optimized_0t8a9717_hp_group_outdoor, public_images_optimized_0t8a9748_graduation_backdrop, public_images_optimized_0t8a9887_large_group_outdoor, public_images_optimized_0t8a9970_graduation_smile_group, public_images_optimized_4w3a0163_hp_celebration_confetti, public_images_optimized_4w3a0166_hp_banner_group, public_images_optimized_4w3a0167_hp_arms_raised, public_images_optimized_4w3a0215_hp_mixed_group, public_images_optimized_4w3a0388_hp_balloons_group, public_images_optimized_4w3a0410_hp_portrait_group, public_images_optimized_4w3a0434_hp_waving_group [EXTRACTED 1.00]

## Communities (146 total, 52 thin omitted)

### Community 0 - "Assignment Modals and Viewing (1)"
Cohesion: 0.05
Nodes (66): react-dom, AssignedFilesViewerModal(), AssignedFilesViewerModalProps, AdminRequestsBulkActions(), AdminRequestsTab(), AdminRequestsTable(), AdminRequestsToolbar(), AdminRequestsToolbarProps (+58 more)

### Community 1 - "Telemetry and Audit Logging (1)"
Cohesion: 0.08
Nodes (48): handler(), checkIpIngestRate(), clampFinite(), handler(), ipRateStore, handler(), VALID_GRANULARITIES, verifyAuditChainIntegrity() (+40 more)

### Community 2 - "Telemetry and Audit Logging (2)"
Cohesion: 0.06
Nodes (36): lenis, react-router-dom, AdminDashboardPage, AdminDashboardWrapper(), AdminRoute(), AllUsersPage, AllUsersWrapper(), App() (+28 more)

### Community 3 - "Media Assets and Cloudinary Storage (1)"
Cohesion: 0.09
Nodes (36): AdminBackgroundImagesTab(), AdminBackgroundImagesTabProps, CLOUDINARY_CONFIG, UPLOAD_PRESET, USE_SIGNED_UPLOAD, deleteHeroBackgroundImage(), persistHeroBackgroundImages(), resizeImageIfNeeded() (+28 more)

### Community 4 - "Assignment Management and Workflows (1)"
Cohesion: 0.06
Nodes (24): addServiceRequest(), AssignmentFileMeta, buildAdminProfilePlaceholder(), calculateDocumentSize(), compressImageForUpload(), convertArabicIndicToAscii(), fetchAllServiceRequestsForService(), fetchAllServicesRequestsOnce() (+16 more)

### Community 5 - "Assignment Modals and Viewing (2)"
Cohesion: 0.08
Nodes (30): react, AssignmentsSnackbar(), AssignmentsSnackbarProps, DistributionProgressInfo, DistributionProgressToast(), DistributionProgressToastProps, PaperPlaneAnimation(), PaperPlaneAnimationProps (+22 more)

### Community 6 - "Telemetry and Audit Logging (3)"
Cohesion: 0.12
Nodes (38): admin, appendAuditLog(), appendNdjson(), auditChainTail, cache, checkIpIngestRate(), clampFinite(), computeDeterministicAuditHash() (+30 more)

### Community 7 - "Admin AI Assistant and FAQ (1)"
Cohesion: 0.12
Nodes (36): FAQ_CATEGORIES, FAQ_ITEMS, FaqCategory, FaqItem, AssistantContext, AssistantDetailRow, buildGreetingReply(), buildNewRequestReply() (+28 more)

### Community 8 - "Assignment Management and Workflows (2)"
Cohesion: 0.13
Nodes (28): FullscreenLoadingOverlays(), FullscreenLoadingOverlaysProps, AssignmentsNavigationTabs(), AssignmentsNavigationTabsProps, TracksManagementTab(), TracksManagementTabProps, Unified130Tab(), Unified130TabProps (+20 more)

### Community 9 - "Firebase Data and Storage Services (1)"
Cohesion: 0.08
Nodes (34): dotenv, admin, args, buildRequestData(), dotenv, fetchCloudinaryGrouped(), getStudentWithRetry(), initFirebase() (+26 more)

### Community 10 - "Assignment Management and Workflows (3)"
Cohesion: 0.12
Nodes (24): AdminServicesFilesGrid, AdminServicesFilesGridProps, ServiceIcon(), ServiceRequestStats, CertificatesConfigTabProps, AdminRequestsTabProps, FileUploadProps, UseAdminUsersProps (+16 more)

### Community 11 - "Telemetry and Audit Logging (4)"
Cohesion: 0.07
Nodes (19): admin, app, automationCrypto, { chromium }, clickPortalLoginButton(), cors, DT_SERVER_META_BASE, electronicPaymentQueue (+11 more)

### Community 12 - "Assignment Modals and Viewing (3)"
Cohesion: 0.17
Nodes (20): lucide-react, ConfirmRevokeAllModal(), ConfirmRevokeAllModalProps, ConfirmRevokeDateModal(), ConfirmRevokeDateModalProps, ConfirmRevokeStudentAllModal(), ConfirmRevokeStudentAllModalProps, RecallByFileTab() (+12 more)

### Community 13 - "Admin Dashboard Config Tabs (1)"
Cohesion: 0.12
Nodes (22): AdminDashboardContent(), BooksConfigTab(), BooksConfigTabProps, CertificatesConfigTab(), FeesConfigTab(), FeesConfigTabProps, FinalReviewConfigTab(), FinalReviewConfigTabProps (+14 more)

### Community 14 - "Telemetry and Audit Logging (5)"
Cohesion: 0.17
Nodes (19): LogCategory, LogSeverity, ChainIntegrityStatus, MetricEventKind, TimeBucketPoint, TimeGranularity, AggregateTimeSeriesUseCase, GranularityMeta (+11 more)

### Community 15 - "Drive API and IP Ingestion (1)"
Cohesion: 0.07
Nodes (26): 🚀 دليل التشغيل الكامل - نظام التحول الرقمي, 1. **بحث ذكي عن العناصر**, الإصدار 1.0, 1. **تشغيل Backend دائماً أولاً**, 1. اختبار Backend, 1. تفعيل Headless Mode (اختياري), 1. Python, 2. **زيادة أوقات الانتظار** (+18 more)

### Community 16 - "Admin AI Assistant and FAQ (2)"
Cohesion: 0.13
Nodes (19): AdminAssistantTab(), AdminAssistantTabProps, AdminChatMessage, AdminUsersTabProps, ServicesManagementTabProps, ViewingStudentRequestsModalProps, AdminRequestsBulkActionsProps, AdminRequestsTableProps (+11 more)

### Community 17 - "Telemetry and Audit Logging (6)"
Cohesion: 0.15
Nodes (17): TelemetryContext, TelemetryContextValue, TelemetryProvider(), initialTelemetryState, now, TelemetryAction, TelemetryDashboardState, telemetryReducer() (+9 more)

### Community 18 - "Telemetry and Audit Logging (7)"
Cohesion: 0.16
Nodes (20): authenticateTelemetryAdmin(), TelemetryLoginPage(), TelemetryLoginPageProps, LoginPage(), LoginPageProps, changeUserPassword(), checkAdminRole(), sendResetPasswordEmail() (+12 more)

### Community 19 - "Assignment Modals and Viewing (4)"
Cohesion: 0.15
Nodes (21): TierSelectionModal(), TierSelectionModalProps, useAssignmentsConfig(), UseAssignmentsConfigOptions, useAssignmentsDistribution(), UseAssignmentsDistributionOptions, distribute130UnifiedFiles(), distributeAssignmentsForTrack() (+13 more)

### Community 20 - "Admin AI Assistant and FAQ (3)"
Cohesion: 0.21
Nodes (22): AdminBotTrainingTab(), AdminBotTrainingTabProps, CATEGORIES, matchTrainedQA(), addTrainedQA(), deleteTrainedQA(), deleteUnansweredQuestion(), extractKeywords() (+14 more)

### Community 21 - "Telemetry and Audit Logging (8)"
Cohesion: 0.16
Nodes (8): TelemetrySession, ISessionRepository, ManageSessionUseCase, HttpSessionRepository, deviceTypeAr(), renderDeviceIcon(), SessionMonitorTable(), SessionMonitorTableProps

### Community 22 - "Firebase Data and Storage Services (2)"
Cohesion: 0.15
Nodes (16): StudentPhonePromptModal(), useStudent(), DashboardPage(), DashboardPageProps, DashboardPage(), DashboardPageProps, HeroSlideshow, ICON_MAP (+8 more)

### Community 23 - "Firebase Data and Storage Services (3)"
Cohesion: 0.19
Nodes (15): getStrength(), RegisterPage(), STEPS, incrementPlatformStudentsCount(), registerUser(), ValidationError, calculateTrack(), getAvailableTracks() (+7 more)

### Community 24 - "Assignment Management and Workflows (4)"
Cohesion: 0.18
Nodes (18): react-virtualized-auto-sizer, react-window, ADMIN_USERS_PAGE_SIZE, useAdminUsers(), AllUsersPage(), AllUsersPageProps, AutoSizer, List (+10 more)

### Community 25 - "services / AdminStatisticsTab"
Cohesion: 0.13
Nodes (15): AdminStatisticsTabProps, COLLEGES, COURSES, DEPARTMENTS, DIPLOMA_TYPES, DIPLOMA_YEARS, GOVERNORATES, GRADES (+7 more)

### Community 26 - "Firebase Data and Storage Services (4)"
Cohesion: 0.10
Nodes (21): dependencies, cloudinary, dotenv, file-saver, firebase, firebase-admin, framer-motion, googleapis (+13 more)

### Community 27 - "Assignment Management and Workflows (5)"
Cohesion: 0.21
Nodes (18): AdminBackupTab(), AdminBackupTabProps, db, ASSIGNMENTS_BUCKET, supabase, BackupCollectionSummary, CANDIDATE_BUCKETS, deleteSupabaseBackup() (+10 more)

### Community 28 - "Firebase Data and Storage Services (5)"
Cohesion: 0.19
Nodes (19): ServicesManagementTab(), buildRestoredDocument(), buildRestoredRequestData(), CloudinaryAsset, dedupeRequestsByStudent(), fetchAllServiceRequestImages(), getAuthHeader(), groupAssetsByStudentService() (+11 more)

### Community 29 - "tsconfig / tsconfigjson"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, isolatedModules, jsx, lib, module (+12 more)

### Community 30 - "automationSetupAll / automationSetupAllc"
Cohesion: 0.10
Nodes (17): argv, crypto, deployProd, ENV_LOCAL, forceRegenerate, fs, HF_SECRET_FILE, lines (+9 more)

### Community 31 - "Application Shell and Routing (1)"
Cohesion: 0.18
Nodes (15): AdminAlertConfig, AdminAlertModalProps, useAdminDashboard(), UseAdminDashboardOptions, RowFlags, useAdminRowFlags(), useAdminStatsLock(), UseAdminStatsLockOptions (+7 more)

### Community 32 - "Assignment Modals and Viewing (5)"
Cohesion: 0.23
Nodes (17): useAssignmentsRecall(), UseAssignmentsRecallOptions, StudentAssignmentsPageProps, fetchCandidatesForDistributedInspection(), get130UnifiedFiles(), getAssignmentFilesForTrack(), getDistributedFilesForTrack(), getDistributedFoldersForTrack() (+9 more)

### Community 33 - "package / packagejson"
Cohesion: 0.11
Nodes (17): name, private, type, version, file-saver, framer-motion, googleapis, imagemin (+9 more)

### Community 34 - "Telemetry and Audit Logging (9)"
Cohesion: 0.16
Nodes (15): computeAuditHash(), crypto, fs, generateHighEntropyPassword(), generateSecureEmail(), { getAuth }, { getDatabase }, { getFirestore, FieldValue } (+7 more)

### Community 35 - "Telemetry and Audit Logging (10)"
Cohesion: 0.24
Nodes (14): clearTrackedSessionId(), getCurrentTrackedSessionId(), getOrCreateSessionId(), inFlightRegistrations, useAdminSessionGuard(), AuditLogStreamPanel(), buildSmoothWavePath(), DashBoardFlowChart() (+6 more)

### Community 36 - "Shared UI Modals and Controls (1)"
Cohesion: 0.12
Nodes (16): ✨ ما تم إنجازه, 1. تصميم عصري, 1. امسح الكاش (Ctrl+Shift+Delete), 1. تحقق من console للأخطاء, الخطوة 1: إضافة State, 1. افحص console (F12), 2. سهولة الاستخدام, الخطوة 2: حذف Modal Code (+8 more)

### Community 37 - "Shared UI Modals and Controls (2)"
Cohesion: 0.12
Nodes (15): ✨ نظرة عامة, 1. الصفوف لا تظهر, الخطوة 1: تحديث State, 2. التنسيق غير صحيح, الخطوة 2: حذف Modal Code, الخطوة 3: استبدال العرض, الخطوة 4: حفظ وتحديث, احفظ الملف (Ctrl+S) (+7 more)

### Community 38 - "runVercelEnvAddPs / provisionAutomationC"
Cohesion: 0.13
Nodes (11): child, path, { spawnSync }, exe, fs, path, ps1, psArgs (+3 more)

### Community 39 - "spawnVercelEnvAdd / pushAutomationPublic"
Cohesion: 0.15
Nodes (13): crypto, noGenerate, path, root, { spawnVercelEnvAdd }, targets, fs, npxExecutable() (+5 more)

### Community 40 - "Firebase Data and Storage Services (6)"
Cohesion: 0.13
Nodes (14): author, description, dotenv, firebase-admin, keywords, license, main, name (+6 more)

### Community 41 - "Backend Services and Automation (1)"
Cohesion: 0.13
Nodes (15): scripts, automation:restore-local-env, automation:set-api-url, automation:setup, automation:vercel-env-ps, automation:verify-keys, build, crypto:provision (+7 more)

### Community 42 - "Telemetry and Audit Logging (11)"
Cohesion: 0.25
Nodes (11): jszip, DataExtractionService(), FileItem, PlatformTelemetryEmitter, analyzeImage(), ExtractedDocument, ExtractedField, fileToBase64() (+3 more)

### Community 43 - "Application Shell and Routing (2)"
Cohesion: 0.18
Nodes (8): AdminDashboardHeader(), AdminDashboardHeaderProps, AdminSidebarNav(), readCollapsed(), CustomToast(), CustomToastProps, AdminDashboardPage(), AdminDashboardPageProps

### Community 44 - "Admin AI Assistant and FAQ (4)"
Cohesion: 0.20
Nodes (11): HIDDEN_PREFIXES, StudentSupportAssistant(), ChatMessage, SupportAssistant(), AssistantTurnResult, ConversationContext, DtCodeRow, EpCodeRow (+3 more)

### Community 45 - "Admin AI Assistant and FAQ (5)"
Cohesion: 0.26
Nodes (14): buildRequestCard(), buildStatusChangeReply(), buildWelcomeReply(), findDtCodeForRequest(), findEpCodeForRequest(), handleNationalIdInput(), nationalIdMatchesStudentOrRequest(), normalizeNationalId() (+6 more)

### Community 46 - "Backend Services and Automation (2)"
Cohesion: 0.15
Nodes (12): ملخص سريع, 1. استراتيجية الاستضافة (Architecture), 2. خطوات تجهيز الكود (Frontend Prepare), 3. خطوات رفع السيرفر (Backend Deployment) - الخطوة الأصعب, 4. إعدادات بديلة (VPS / Ubuntu Server), دليل نشر تطبيق AI Automation Service (Production Deployment Guide), ب. إعداد ملف `.env` في الإنتاج, أ. استخدام متغيرات البيئة (Environment Variables) (+4 more)

### Community 47 - "compareVercelPulledPublic / compareVerce"
Cohesion: 0.15
Nodes (10): apiUrl, crypto, derived, fromVercel, fs, HF_FILE, path, priv (+2 more)

### Community 48 - "adminNavigation / AdminSidebarNav"
Cohesion: 0.23
Nodes (10): AdminSidebarNavProps, ADMIN_NAV_OPEN_GROUPS_KEY, ADMIN_NAVIGATION, ADMIN_SIDEBAR_COLLAPSED_KEY, AdminNavGroup, AdminNavItem, AdminNavItemId, AdminTabId (+2 more)

### Community 49 - "Telemetry and Audit Logging (12)"
Cohesion: 0.27
Nodes (10): AuditLogEntry, SystemHealthSnapshot, TelemetrySummaryKPIs, TelemetryDashboardSnapshot, ACTION_LABELS_AR, AuditLogRow(), AuditLogStreamPanelProps, AuditRowProps (+2 more)

### Community 50 - "Telemetry and Audit Logging (13)"
Cohesion: 0.27
Nodes (6): AdminAccountRole, DeviceMetadata, DeviceType, GeoLocationInfo, SessionStatus, DeviceTelemetryParser

### Community 51 - "Assignment Modals and Viewing (6)"
Cohesion: 0.44
Nodes (10): TrackSyncResult, AssignedFile, AssignmentFileMeta, TrackKey, AssignmentUnit, computeSynchronizedAssignedFiles(), ComputeSyncOptions, ComputeSyncResult (+2 more)

### Community 52 - "package / devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, imagemin, imagemin-mozjpeg, imagemin-pngquant, @types/file-saver, @types/react, @types/react-dom, typescript (+4 more)

### Community 53 - "restoreAutomationPublicToEnvLocal / upse"
Cohesion: 0.20
Nodes (9): DEFAULT_PASTE, ENV_LOCAL, fs, path, pubB64, root, { upsertEnvLine }, fs (+1 more)

### Community 54 - "Admin AI Assistant and FAQ (6)"
Cohesion: 0.24
Nodes (11): AssistantMessageBody(), ChipGroups(), renderMarkdownLite(), RequestCard(), STATUS_CONFIG, StatusBadge(), SummaryBar(), AssistantChip (+3 more)

### Community 55 - "Backend Services and Automation (3)"
Cohesion: 0.18
Nodes (10): حل مشكلة التسجيل في موقع التحول الرقمي, 1. تحسين البحث عن العناصر, الحل 1: تشغيل بدون Headless Mode, الحل 2: زيادة أوقات الانتظار, الخطوة 2: تشغيل Backend, 2. إضافة Screenshots للتشخيص, 3. تحسين اكتشاف الموقع, الخطوة 3: تشغيل Frontend (+2 more)

### Community 56 - "Firebase Data and Storage Services (7)"
Cohesion: 0.18
Nodes (10): الخطوات المطلوبة:, 1. إنشاء مشروع Firebase, 2. تفعيل Authentication, 3. إنشاء Firestore Database, 4. الحصول على Firebase Config, 5. تحديث ملف Firebase Config, 6. تثبيت Firebase Package, 7. قواعد Firestore (Security Rules) (+2 more)

### Community 57 - "Media Assets and Cloudinary Storage (2)"
Cohesion: 0.18
Nodes (10): الأمان والأداء - ملخص التحسينات, 1. **تحسين الصور تلقائياً في Cloudinary**, 1. إنشاء Unsigned Upload Preset في Cloudinary:, 1. **Unsigned Upload Preset**, 2. **التحقق من نوع الملف**, 2. **Links فقط في Firestore**, 3. **عدم حفظ معلومات حساسة**, 3. **Debug قبل الحفظ** (+2 more)

### Community 58 - "Firebase Data and Storage Services (8)"
Cohesion: 0.29
Nodes (10): StudentContext, StudentContextType, StudentProvider(), AdminRole, ensureStudentDocExists(), logoutUser(), migrateStudentOrders(), onAuthStateChange() (+2 more)

### Community 59 - "Assignment Management and Workflows (6)"
Cohesion: 0.38
Nodes (10): useAdminConfigs(), UseAdminConfigsProps, ServiceDetailsPage(), subscribeToAdminPreferences(), subscribeToAssignmentsServiceConfig(), subscribeToBookServiceConfig(), subscribeToCertificatesServiceConfig(), subscribeToSharedConfig() (+2 more)

### Community 60 - "Assignment Modals and Viewing (7)"
Cohesion: 0.25
Nodes (9): DeleteActionMode, DeleteConfirmationModal(), DeleteConfirmationModalProps, useAssignmentsDeletion(), UseAssignmentsDeletionOptions, DeleteConfirmModalState, delete130UnifiedFiles(), deleteAssignmentFilesForTrack() (+1 more)

### Community 61 - "Backend Services and Automation (4)"
Cohesion: 0.31
Nodes (8): crypto, decryptAutomationBodyMiddleware(), decryptEnvelopeToPayload(), encryptAutomationResponseWithSessionKey(), initFromEnv(), isEnabled(), normalizeBase64OneLine(), stripOuterQuotes()

### Community 62 - "Backend Services and Automation (5)"
Cohesion: 0.33
Nodes (8): buildHealingReport(), healingButton(), healingInput(), healingReports, healingSelect(), normalizeForMatch(), scoreCandidateElement(), selfHealingLocator()

### Community 63 - "Firebase Data and Storage Services (9)"
Cohesion: 0.20
Nodes (9): ملاحظات مهمة:, الخطوة 1: إنشاء مشروع Firebase, الخطوة 2: إضافة تطبيق ويب, الخطوة 3: نسخ بيانات التكوين (Config), الخطوة 4: تفعيل Authentication, الخطوة 5: إنشاء Firestore Database, الخطوة 6: تحديث ملف Firebase Config, إذا نسيت Config: (+1 more)

### Community 64 - "verifyAutomationKeyPair / verifyAutomati"
Cohesion: 0.24
Nodes (9): crypto, derivePubB64FromPrivB64(), ENV_LOCAL, fs, HF_FILE, main(), path, readEnvLocalValue() (+1 more)

### Community 65 - "Admin Dashboard Config Tabs (2)"
Cohesion: 0.31
Nodes (8): AdminDashboardContentProps, AdminDashboardModals(), AdminDashboardModalsProps, AdminAlertModal(), EditStudentModal(), EditStudentModalProps, ViewingStudentRequestsModal(), AdminDashboardContextType

### Community 66 - "Telemetry and Audit Logging (14)"
Cohesion: 0.29
Nodes (3): auth, SessionHeartbeatResult, TelemetryApiClient

### Community 67 - "Telemetry and Audit Logging (15)"
Cohesion: 0.42
Nodes (4): useTelemetryContext(), useTelemetryDashboard(), ServiceLeaderboardItem, RankServiceLeaderboardsUseCase

### Community 68 - "Drive API and IP Ingestion (2)"
Cohesion: 0.22
Nodes (8): ✅ تم الإصلاح! - دليل التشغيل السريع, 1️⃣ تشغيل Backend, 2️⃣ تشغيل Frontend (في terminal جديد), 🚀 التشغيل السريع (3 خطوات فقط!), اختبار Backend:, المشكلة: Chrome Driver, 📸 Screenshots تلقائية, المشكلة: لا يزال timeout

### Community 69 - "AdminWhatsAppTab / package"
Cohesion: 0.28
Nodes (8): xlsx, AdminWhatsAppTab(), AdminWhatsAppTabProps, getStudentDetailsForRequest(), PLACEHOLDER_TAGS, STATUS_OPTIONS, TemplateField(), TemplateFieldProps

### Community 70 - "setVercelAutomationApiUrl / setVercelAut"
Cohesion: 0.22
Nodes (7): baseUrl, defaultUrl, fs, path, root, { spawnVercelEnvAdd }, targets

### Community 71 - "Assignment Management and Workflows (7)"
Cohesion: 0.33
Nodes (7): useTrackFiles(), UseTrackFilesOptions, useUnified130Files(), UseUnified130FilesOptions, getCurrentUser(), upload130UnifiedFile(), uploadAssignmentFilesForTrack()

### Community 72 - "FILE_UPLOAD_IMPROVEMENTS / FILE_UPLOAD_I"
Cohesion: 0.25
Nodes (7): تحسينات صفحة رفع الملفات وإدارة التكليفات, 1. زيادة حجم الملفات المسموح به, 2. تحسين سرعة رفع الملفات, 3. تحسين تصميم جدول الملفات (Excel Style), 4. تبسيط واجهة رفع الملفات, 5. تحسين عرض الملفات المرفوعة, 6. تحسين أداء تحميل الصفحة

### Community 73 - "Telemetry and Audit Logging (16)"
Cohesion: 0.29
Nodes (5): vite, vite-plugin-node-polyfills, @vitejs/plugin-react, require, telemetryDevMiddlewarePlugin()

### Community 74 - "Firebase Data and Storage Services (10)"
Cohesion: 0.39
Nodes (6): formatNumber(), LivePlatformStats(), LivePlatformStatsProps, useAnimatedCounter(), getStudentsCollectionCount(), subscribeToPlatformStats()

### Community 75 - "Drive API and IP Ingestion (3)"
Cohesion: 0.36
Nodes (6): CloudProvider, getGoogleDriveAccessToken(), uploadMultipleToCloudStorage(), UploadResult, uploadToCloudStorage(), uploadToGoogleDrive()

### Community 76 - "tsconfig.node / tsconfignodejson"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 77 - "Shared UI Modals and Controls (3)"
Cohesion: 0.29
Nodes (6): إصلاح شامل لمشاكل العرض في صفحة الأدمن, 1. إصلاح المودال (Modal), التاريخ: 2026-01-31, 2. تحسينات Responsive Design, 3. تحسين العناصر الداخلية, 4. تحسينات عامة

### Community 78 - "Firebase Data and Storage Services (11)"
Cohesion: 0.29
Nodes (5): firebase, app, firebaseConfig, storage, firebaseConfig

### Community 79 - "Firebase Data and Storage Services (12)"
Cohesion: 0.48
Nodes (6): AdminNewsTab(), AdminNewsTabProps, clearLatestNews(), clearQuickNotification(), sendQuickNotification(), updateLatestNews()

### Community 80 - "Firebase Data and Storage Services (13)"
Cohesion: 0.38
Nodes (6): ElectronicPaymentCode, ElectronicPaymentCodesTab(), ElectronicPaymentCodesTabProps, RowFlags, deleteElectronicPaymentCode(), subscribeToElectronicPaymentCodes()

### Community 81 - "ServiceCard / ServiceCardtsx"
Cohesion: 0.43
Nodes (5): ensureLottiePlayerLoaded(), getServiceIcon(), ServiceCard(), ServiceCardProps, Service

### Community 82 - "Application Shell and Routing (3)"
Cohesion: 0.33
Nodes (6): دليل الاستخدام السريع - صفحة الأدمن المحسنة, 1. التحديث الأولي, الخطوة 1: تحديث ملف AdminDashboardPage.tsx, 2. التحقق من التحسينات, دليل تطبيق التصميم الجديد - Expandable Rows, 📱 Responsive

### Community 83 - "Firebase Data and Storage Services (14)"
Cohesion: 0.33
Nodes (6): dependencies, cors, dotenv, express, firebase-admin, playwright

### Community 85 - "Media Assets and Cloudinary Storage (3)"
Cohesion: 0.33
Nodes (5): خطوات الإعداد المطلوبة:, 1. إنشاء Unsigned Upload Preset في Cloudinary Dashboard:, 2. استخدام Preset:, 3. اختبار الرفع:, إعداد Cloudinary

### Community 86 - "Firebase Data and Storage Services (15)"
Cohesion: 0.33
Nodes (5): حل مشكلة "الأذونات مفقودة أو غير كافية", ✅ الحل 1: تفعيل Email/Password Authentication, ✅ الحل 2: إعداد Firestore Security Rules, ✅ الحل 3: التحقق من إنشاء Firestore Database, ✅ الحل 4: التحقق من البيانات

### Community 87 - "README_ADMIN_FIX / README_ADMIN_FIXmd"
Cohesion: 0.33
Nodes (5): ✅ الحل النهائي لمشاكل العرض في صفحة الأدمن, الخطوة 1: تحديث الصفحة, الخطوة 2: التحقق, الخطوة 3: الاستمتاع!, ملفات CSS

### Community 88 - "Firebase Data and Storage Services (16)"
Cohesion: 0.47
Nodes (5): DigitalTransformationConfigTab(), DigitalTransformationConfigTabProps, subscribeToDigitalTransformationConfig(), updateDigitalTransformationConfig(), DigitalTransformationType

### Community 89 - "Backend Services and Automation (7)"
Cohesion: 0.70
Nodes (5): extractLikelyFawryCodeFromDtResult(), getFinalFawryCodeFromDtResult(), isBadFawryCell(), runAutomation(), waitForFdtcCreateFormReady()

### Community 90 - "Backend Services and Automation (8)"
Cohesion: 0.83
Nodes (4): isValidFawryRef(), lookupReceiptsFromPortal(), runElectronicPaymentAutomation(), triggerFawryModalConfirm()

### Community 92 - "Application Shell and Routing (4)"
Cohesion: 0.83
Nodes (4): AdminDashboardPage CSS Updates, Admin Page Fixes Summary, Modal Centering and Backdrop Fix, Responsive Design Improvements

### Community 93 - "Authentication and Access Control"
Cohesion: 0.50
Nodes (3): Allow public pages, Disallow authenticated-only pages (no value for AdSense crawlers), Sitemap

### Community 94 - "Assignment Management and Workflows (8)"
Cohesion: 0.50
Nodes (3): @supabase/supabase-js, ASSIGNMENTS_BUCKET, supabase

### Community 96 - "Application Shell and Routing (5)"
Cohesion: 0.67
Nodes (3): adminAutoFixService Architecture, AdminDashboardPage Refactoring, useAdminDashboard Hook Architecture

## Knowledge Gaps
- **184 isolated node(s):** `dotenv`, `firebase-admin`, `HP University Center Mixed Students Staff Group Photo`, `HP University Center Portrait Small Group Photo`, `✨ ما تم إنجازه` (+179 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 666 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **52 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Assignment Modals and Viewing (2)` to `Assignment Modals and Viewing (1)`, `Telemetry and Audit Logging (2)`, `Media Assets and Cloudinary Storage (1)`, `Assignment Management and Workflows (2)`, `Assignment Management and Workflows (3)`, `Assignment Modals and Viewing (3)`, `Admin Dashboard Config Tabs (1)`, `Telemetry and Audit Logging (5)`, `Admin AI Assistant and FAQ (2)`, `Telemetry and Audit Logging (6)`, `Telemetry and Audit Logging (7)`, `Assignment Modals and Viewing (4)`, `Admin AI Assistant and FAQ (3)`, `Telemetry and Audit Logging (8)`, `Firebase Data and Storage Services (2)`, `Firebase Data and Storage Services (3)`, `Assignment Management and Workflows (4)`, `services / AdminStatisticsTab`, `Assignment Management and Workflows (5)`, `Firebase Data and Storage Services (5)`, `Application Shell and Routing (1)`, `Assignment Modals and Viewing (5)`, `package / packagejson`, `Telemetry and Audit Logging (10)`, `Telemetry and Audit Logging (11)`, `Application Shell and Routing (2)`, `Admin AI Assistant and FAQ (4)`, `adminNavigation / AdminSidebarNav`, `Telemetry and Audit Logging (12)`, `Admin AI Assistant and FAQ (6)`, `Firebase Data and Storage Services (8)`, `Assignment Management and Workflows (6)`, `Assignment Modals and Viewing (7)`, `Admin Dashboard Config Tabs (2)`, `Telemetry and Audit Logging (15)`, `AdminWhatsAppTab / package`, `Assignment Management and Workflows (7)`, `Firebase Data and Storage Services (10)`, `Firebase Data and Storage Services (12)`, `Firebase Data and Storage Services (13)`, `ServiceCard / ServiceCardtsx`, `Firebase Data and Storage Services (16)`, `SideNav / SideNavtsx`?**
  _High betweenness centrality (0.218) - this node is a cross-community bridge._
- **What connects `dotenv`, `firebase-admin`, `HP University Center Mixed Students Staff Group Photo` to the rest of the system?**
  _184 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Assignment Modals and Viewing (1)` be split into smaller, more focused modules?**
  _Cohesion score 0.05132317562149158 - nodes in this community are weakly interconnected._
- **Why does `firebase-admin` connect `Telemetry and Audit Logging (1)` to `package / packagejson`, `Telemetry and Audit Logging (9)`, `Telemetry and Audit Logging (3)`, `Firebase Data and Storage Services (1)`, `Telemetry and Audit Logging (4)`?**
  _High betweenness centrality (0.208) - this node is a cross-community bridge._
- **Should `Telemetry and Audit Logging (1)` be split into smaller, more focused modules?**
  _Cohesion score 0.08360655737704918 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Assignment Modals and Viewing (3)` to `Assignment Modals and Viewing (1)`, `Telemetry and Audit Logging (2)`, `Media Assets and Cloudinary Storage (1)`, `Assignment Modals and Viewing (2)`, `Assignment Management and Workflows (2)`, `Assignment Management and Workflows (3)`, `Admin Dashboard Config Tabs (1)`, `Telemetry and Audit Logging (5)`, `Admin AI Assistant and FAQ (2)`, `Telemetry and Audit Logging (7)`, `Assignment Modals and Viewing (4)`, `Admin AI Assistant and FAQ (3)`, `Telemetry and Audit Logging (8)`, `Firebase Data and Storage Services (2)`, `Firebase Data and Storage Services (3)`, `Assignment Management and Workflows (4)`, `services / AdminStatisticsTab`, `Assignment Management and Workflows (5)`, `Firebase Data and Storage Services (5)`, `Application Shell and Routing (1)`, `Assignment Modals and Viewing (5)`, `package / packagejson`, `Telemetry and Audit Logging (10)`, `Telemetry and Audit Logging (11)`, `Application Shell and Routing (2)`, `Admin AI Assistant and FAQ (4)`, `adminNavigation / AdminSidebarNav`, `Telemetry and Audit Logging (12)`, `Admin AI Assistant and FAQ (6)`, `Assignment Modals and Viewing (7)`, `Admin Dashboard Config Tabs (2)`, `AdminWhatsAppTab / package`, `Firebase Data and Storage Services (10)`, `Firebase Data and Storage Services (12)`, `Firebase Data and Storage Services (13)`, `ServiceCard / ServiceCardtsx`, `Firebase Data and Storage Services (16)`, `SideNav / SideNavtsx`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Should `Telemetry and Audit Logging (2)` be split into smaller, more focused modules?**
  _Cohesion score 0.05868118572292801 - nodes in this community are weakly interconnected._
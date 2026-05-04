# Legacy Module Source Map

This file maps currently discovered legacy module packages to rewrite scope so no module is forgotten.

## Legacy package modules found

- AiAssistant
- BehaviourRecords
- BulkPrint
- Chat
- DownloadCenter
- ExamPlan
- Fees
- Lesson
- MenuManage
- RolePermission
- StudentAbsentNotification
- TemplateSettings
- TwoFactorAuth
- VideoWatch
- Wallet

## Enabled module flags from legacy configuration

Enabled in current system:

- TemplateSettings
- RolePermission
- Saas
- Lesson
- MenuManage
- Wallet
- StudentAbsentNotification
- Chat
- BulkPrint
- Fees
- ExamPlan
- TwoFactorAuth
- BehaviourRecords
- DownloadCenter

Disabled in current system but must be considered for full parity:

- InfixBiometrics
- FeesCollection
- ResultReports
- RazorPay
- Zoom
- ParentRegistration
- SaasSubscription
- Inventory
- SaasRolePermission
- OnlineExam
- BBB
- XenditPayment
- HimalayaSms
- Lms
- KhaltiPayment
- AWSS3
- Lead
- University
- Alumni
- MercadoPago
- CcAveune
- Certificate
- Gmeet
- AiContent
- WhatsappSupport
- InAppLiveClass
- Raudhahpay
- AppSlider

## Rewrite mapping notes

- Enabled modules are first-class deliverables in phase-1 to phase-3.
- Disabled modules become optional deliverables and can be parked behind feature flags.
- Cross-cutting modules (RolePermission, TwoFactorAuth, Saas) should be implemented as platform capabilities rather than isolated apps.

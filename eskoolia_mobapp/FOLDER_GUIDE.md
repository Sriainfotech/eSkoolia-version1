# Eskoolia Mobile - Quick Folder Reference Guide

## 📁 Top-Level Folders

| Folder | Purpose | When to Use |
|--------|---------|-------------|
| `/lib` | All Flutter source code | Always |
| `/test` | All test files | When writing tests |
| `/android` | Android platform code | Platform-specific Android features |
| `/ios` | iOS platform code | Platform-specific iOS features |
| `/assets` | Static assets | (Organized inside `/lib/assets`) |

---

## 📁 Core Structure (`/lib`)

### `/config` - Configuration
| Subfolder | Purpose | Example Files |
|-----------|---------|---------------|
| `di/` | Dependency Injection | `app_providers.dart`, `service_locator.dart` |
| `environment/` | Environment configs | `app_environment.dart`, `env_config.dart` |
| `router/` | Navigation setup | `app_router.dart`, `route_guards.dart` |

**Use when**: Setting up app-wide configuration, DI container, or routing

---

### `/core` - Core Utilities
| Subfolder | Purpose | Example Files |
|-----------|---------|---------------|
| `constants/` | App constants | `api_constants.dart`, `app_strings.dart`, `app_colors.dart` |
| `theme/` | Theme configuration | `app_theme.dart`, `text_styles.dart`, `color_palette.dart` |
| `utils/` | Helper functions | `date_utils.dart`, `string_utils.dart`, `validators.dart` |
| `validators/` | Input validators | `email_validator.dart`, `phone_validator.dart` |
| `extensions/` | Dart extensions | `string_extensions.dart`, `context_extensions.dart` |
| `exceptions/` | Custom exceptions | `network_exception.dart`, `auth_exception.dart` |

**Use when**: Creating reusable utilities, constants, or theme definitions

---

### `/data` - Global Data Infrastructure
| Subfolder | Purpose | Example Files |
|-----------|---------|---------------|
| `network/` | Network setup | `dio_client.dart`, `api_interceptors.dart`, `api_endpoints.dart` |
| `local/` | Local database | `hive_setup.dart`, `database_helper.dart` |
| `cache/` | Caching logic | `cache_manager.dart`, `cache_policy.dart` |

**Use when**: Setting up Dio, database, or caching infrastructure

---

### `/features` - Feature Modules

Each feature has the same structure:

```
feature_name/
├── data/
│   ├── datasources/      # API calls, DB queries
│   ├── models/           # DTOs with JSON serialization
│   └── repositories/     # Repository implementations
├── domain/
│   ├── entities/         # Business objects
│   ├── repositories/     # Repository interfaces
│   └── usecases/         # Business logic
└── presentation/
    ├── pages/            # Full screens
    ├── widgets/          # Feature-specific widgets
    └── providers/        # Riverpod state management
```

#### Feature List

| Feature | Purpose |
|---------|---------|
| `auth/` | Authentication & authorization |
| `dashboard/` | Home dashboard for all roles |
| `student/` | Student portal features |
| `parent/` | Parent portal features |
| `teacher/` | Teacher portal features |
| `staff/` | Staff portal features |
| `attendance/` | Attendance marking & viewing |
| `fees/` | Fee payment & management |
| `academics/` | Academic activities & curriculum |
| `exams/` | Exam scheduling & results |
| `timetable/` | Class schedules & timetables |
| `chat/` | In-app messaging |
| `notifications/` | Push & in-app notifications |
| `profile/` | User profile management |
| `settings/` | App settings & preferences |
| `admissions/` | Student admissions |
| `behaviour/` | Behaviour tracking |
| `library/` | Library management |
| `reports/` | Reports & analytics |
| `hr/` | HR management |

**Use when**: Implementing a specific business feature

---

### `/services` - Platform Services
| Service | Purpose | Example Files |
|---------|---------|---------------|
| `storage/` | Secure storage | `secure_storage_service.dart`, `preferences_service.dart` |
| `notification/` | Push notifications | `fcm_service.dart`, `local_notification_service.dart` |
| `analytics/` | Analytics tracking | `analytics_service.dart`, `event_tracker.dart` |
| `crash_reporting/` | Crash reporting | `crashlytics_service.dart` |
| `file/` | File operations | `file_service.dart`, `image_service.dart` |
| `location/` | Location services | `location_service.dart` |
| `network/` | Network monitoring | `network_service.dart`, `connectivity_service.dart` |

**Use when**: Wrapping platform-specific functionality or third-party services

---

### `/shared` - Shared Across Features
| Subfolder | Purpose | Example Files |
|-----------|---------|---------------|
| `data/models/` | Shared DTOs | `user_model.dart`, `school_model.dart` |
| `data/repositories/` | Shared repo implementations | `user_repository_impl.dart` |
| `domain/entities/` | Shared entities | `user_entity.dart`, `role_entity.dart` |
| `domain/repositories/` | Shared repo interfaces | `user_repository.dart` |
| `presentation/widgets/` | Reusable widgets | `custom_button.dart`, `loading_indicator.dart` |
| `presentation/providers/` | Global providers | `user_provider.dart`, `theme_provider.dart` |

**Use when**: Creating components used by multiple features

---

### `/l10n` - Localization
Contains translation files for multiple languages.

**Example files**: `app_en.arb`, `app_ar.arb`, `app_hi.arb`

**Use when**: Adding translations or supporting new languages

---

### `/assets` - Static Assets
| Subfolder | Purpose | File Types |
|-----------|---------|------------|
| `images/` | Images & graphics | PNG, JPG, WebP |
| `icons/` | Icons & logos | SVG, PNG |
| `fonts/` | Custom fonts | TTF, OTF |
| `animations/` | Animations | JSON (Lottie), Rive |

**Use when**: Adding static assets to the app

---

## 📁 Test Structure (`/test`)

| Folder | Purpose | What to Test |
|--------|---------|--------------|
| `unit/` | Unit tests | UseCases, Repositories, Utils |
| `widget/` | Widget tests | UI components, Pages |
| `integration/` | Integration tests | Full user flows |
| `fixtures/` | Test data | Mock JSON, fixtures |
| `mocks/` | Mock classes | Mock repositories, services |

**Test folder mirrors lib structure**:
```
test/
└── unit/
    └── features/
        └── auth/
            └── domain/
                └── usecases/
                    └── login_usecase_test.dart
```

---

## 🎯 Quick Decision Tree

### Where do I put...?

**A new screen?**
→ `/features/{feature_name}/presentation/pages/`

**A reusable widget used in multiple features?**
→ `/shared/presentation/widgets/`

**A widget specific to one feature?**
→ `/features/{feature_name}/presentation/widgets/`

**Business logic?**
→ `/features/{feature_name}/domain/usecases/`

**API calls?**
→ `/features/{feature_name}/data/datasources/`

**Data models (DTOs)?**
→ `/features/{feature_name}/data/models/`

**Business entities?**
→ `/features/{feature_name}/domain/entities/`

**State management?**
→ `/features/{feature_name}/presentation/providers/`

**App constants?**
→ `/core/constants/`

**Helper functions?**
→ `/core/utils/`

**Theme definitions?**
→ `/core/theme/`

**Navigation routes?**
→ `/config/router/`

**Platform services?**
→ `/services/{service_name}/`

**Translations?**
→ `/l10n/`

**Images/Icons?**
→ `/assets/{images|icons}/`

---

## 📝 File Naming Conventions

| Type | Example |
|------|---------|
| Page | `login_page.dart` |
| Widget | `custom_button.dart` |
| Provider | `auth_provider.dart` |
| State | `auth_state.dart` |
| Model | `user_model.dart` |
| Entity | `user_entity.dart` |
| UseCase | `login_usecase.dart` |
| Repository (interface) | `auth_repository.dart` |
| Repository (impl) | `auth_repository_impl.dart` |
| DataSource | `auth_remote_datasource.dart` |
| Service | `storage_service.dart` |
| Util | `date_utils.dart` |
| Constant | `api_constants.dart` |

---

## 🔄 Data Flow Visualization

```
User Taps Login Button
         ↓
LoginPage (presentation/pages/)
         ↓
AuthProvider (presentation/providers/)
         ↓
LoginUseCase (domain/usecases/)
         ↓
AuthRepository Interface (domain/repositories/)
         ↓
AuthRepositoryImpl (data/repositories/)
         ↓
AuthRemoteDataSource (data/datasources/)
         ↓
Dio API Call (data/network/)
         ↓
Backend API
         ↓
Response → Model → Entity
         ↓
Back to Provider → Update State
         ↓
UI Rebuilds
```

---

## ✅ Best Practices

1. **One feature, one folder**: Keep all related code together
2. **Shared vs Feature**: If used by 2+ features → `/shared`, else → `/features/{name}`
3. **Clean Architecture**: Always follow Data → Domain → Presentation
4. **No direct dependencies**: Presentation depends on Domain, not Data
5. **Repository pattern**: Always use repositories, never call DataSources directly
6. **Single Responsibility**: Each file/class does one thing
7. **Consistent naming**: Follow the naming conventions
8. **Test mirror structure**: Test files mirror lib structure

---

## 🚀 Getting Started Workflow

For a new developer:

1. **Read** `ARCHITECTURE.md` for detailed concepts
2. **Reference** this `FOLDER_GUIDE.md` for quick lookups
3. **Start** with a simple feature to understand the pattern
4. **Follow** the existing structure - don't create new patterns
5. **Ask** when unsure - consistency is key

---

## 📞 Need Help?

- Read a similar feature implementation as reference
- Check the `ARCHITECTURE.md` for detailed explanations
- Follow the patterns already established
- Maintain consistency across all features

---

**Remember**: This structure is designed for long-term maintainability. Take time to place files correctly the first time!

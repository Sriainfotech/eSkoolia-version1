# Eskoolia Mobile App - Enterprise Flutter Architecture

## Overview

This document outlines the enterprise-grade Flutter architecture designed for the Eskoolia Mobile Application. The architecture follows Clean Architecture principles, SOLID principles, and is designed to support a large development team working simultaneously with minimal merge conflicts.

---

## Architecture Pattern

### Clean Architecture + Feature-First + MVVM

This architecture combines:
- **Clean Architecture**: Separation of concerns with distinct layers (Data, Domain, Presentation)
- **Feature-First**: Organization by business features rather than technical layers
- **MVVM**: Model-View-ViewModel pattern for the presentation layer
- **Repository Pattern**: Abstraction of data sources
- **Dependency Injection**: Loose coupling and testability
- **Riverpod**: State management and dependency injection

---

## Why This Architecture?

### 1. **Scalability**
- Feature-first structure allows horizontal scaling
- Each feature is self-contained with its own layers
- New features can be added without affecting existing ones
- Supports large teams working on different modules simultaneously

### 2. **Maintainability**
- Clear separation of concerns
- Each layer has a single responsibility
- Easy to locate and modify code
- Consistent structure across all features

### 3. **Testability**
- Clean Architecture enables easy unit testing
- Repository pattern allows mocking data sources
- Each layer can be tested independently
- Test folder structure mirrors lib structure

### 4. **Team Collaboration**
- Minimal merge conflicts due to feature isolation
- Clear boundaries between modules
- Standardized structure - new developers can onboard quickly
- Multiple developers can work on different features simultaneously

### 5. **Flexibility**
- Easy to swap implementations (e.g., local vs remote data sources)
- Business logic independent of UI and frameworks
- Can easily add new features or modify existing ones
- Framework-agnostic domain layer

### 6. **Enterprise-Ready**
- Supports multi-tenant architecture
- Role-based access control ready
- Centralized configuration and environment management
- Proper error handling and logging infrastructure
- Security best practices with secure storage

---

## Folder Structure

```
lib/
├── main.dart                          # Application entry point
├── assets/                            # Asset organization
│   ├── animations/                    # Lottie/Rive animations
│   ├── fonts/                         # Custom fonts
│   ├── icons/                         # App icons and SVGs
│   └── images/                        # Images and graphics
├── config/                            # App-level configuration
│   ├── di/                           # Dependency Injection setup
│   ├── environment/                   # Environment configs (dev, staging, prod)
│   └── router/                        # Go Router configuration
├── core/                              # Core utilities and shared code
│   ├── constants/                     # App constants (API URLs, keys, etc.)
│   ├── exceptions/                    # Custom exceptions
│   ├── extensions/                    # Dart extensions
│   ├── theme/                         # App theme (colors, text styles, etc.)
│   ├── utils/                         # Utility functions
│   └── validators/                    # Input validators
├── data/                              # Global data infrastructure
│   ├── cache/                         # Caching logic
│   ├── local/                         # Local database (Hive/SQLite)
│   └── network/                       # Dio setup, interceptors, API client
├── features/                          # Feature modules
│   ├── auth/                         # Authentication & Authorization
│   │   ├── data/
│   │   │   ├── datasources/          # Remote & Local data sources
│   │   │   ├── models/               # DTOs & JSON serialization
│   │   │   └── repositories/         # Repository implementations
│   │   ├── domain/
│   │   │   ├── entities/             # Business objects
│   │   │   ├── repositories/         # Repository contracts
│   │   │   └── usecases/             # Business logic
│   │   └── presentation/
│   │       ├── pages/                # Screens
│   │       ├── providers/            # Riverpod providers
│   │       └── widgets/              # Feature-specific widgets
│   ├── dashboard/                    # Dashboard module
│   ├── student/                      # Student portal
│   ├── parent/                       # Parent portal
│   ├── teacher/                      # Teacher portal
│   ├── staff/                        # Staff portal
│   ├── attendance/                   # Attendance management
│   ├── fees/                         # Fees & payments
│   ├── academics/                    # Academic activities
│   ├── exams/                        # Examination module
│   ├── timetable/                    # Schedule & timetable
│   ├── chat/                         # Messaging & chat
│   ├── notifications/                # Push notifications
│   ├── profile/                      # User profile
│   ├── settings/                     # App settings
│   ├── admissions/                   # Admissions module
│   ├── behaviour/                    # Behaviour tracking
│   ├── library/                      # Library management
│   ├── reports/                      # Reports & analytics
│   └── hr/                           # HR management
├── l10n/                             # Localization files
├── services/                          # Platform services
│   ├── analytics/                    # Analytics service
│   ├── crash_reporting/              # Crash reporting
│   ├── file/                         # File operations
│   ├── location/                     # Location services
│   ├── network/                      # Network info
│   ├── notification/                 # Push notifications
│   └── storage/                      # Secure storage
└── shared/                            # Shared across features
    ├── data/
    │   ├── models/                   # Shared models
    │   └── repositories/             # Shared repositories
    ├── domain/
    │   ├── entities/                 # Shared entities
    │   └── repositories/             # Shared repository contracts
    └── presentation/
        ├── providers/                # Shared providers
        └── widgets/                  # Reusable widgets
```

---

## Layer Responsibilities

### 1. **Presentation Layer** (`presentation/`)
**Responsibility**: UI and user interaction
- **pages/**: Full screen widgets (routes)
- **widgets/**: Reusable UI components specific to the feature
- **providers/**: Riverpod providers for state management and business logic

**Characteristics**:
- Uses Riverpod for state management
- Consumes UseCases from domain layer
- Only contains UI logic
- No direct dependency on data sources
- Observes state changes and rebuilds UI

### 2. **Domain Layer** (`domain/`)
**Responsibility**: Business logic and rules
- **entities/**: Pure business objects (no JSON, no framework dependencies)
- **repositories/**: Abstract repository contracts (interfaces)
- **usecases/**: Single-responsibility business operations

**Characteristics**:
- Framework-agnostic
- Contains business rules
- No dependencies on external frameworks
- Depends on abstractions, not implementations
- Highly testable

### 3. **Data Layer** (`data/`)
**Responsibility**: Data fetching and persistence
- **datasources/**: Concrete implementations (API calls, local DB queries)
- **models/**: DTOs with JSON serialization (using json_serializable)
- **repositories/**: Repository implementations (implements domain contracts)

**Characteristics**:
- Implements repository interfaces from domain
- Handles data transformation (Model ↔ Entity)
- Manages data sources (remote & local)
- Handles caching logic
- Error handling and mapping

---

## Directory Purpose Breakdown

### `/config` - Application Configuration
- **environment/**: Dev, staging, production configurations
- **router/**: GoRouter setup with route guards and deep linking
- **di/**: Dependency injection container setup (Riverpod providers)

### `/core` - Core Utilities
- **constants/**: API endpoints, API keys, app constants
- **theme/**: ThemeData, color schemes, text styles
- **utils/**: Helper functions, formatters, date utilities
- **validators/**: Email, phone, form validators
- **extensions/**: String, DateTime, BuildContext extensions
- **exceptions/**: Custom exceptions (NetworkException, CacheException, etc.)

### `/data` - Global Data Infrastructure
- **network/**: Dio setup, interceptors (auth, logging, error), API client base
- **local/**: Hive/SQLite setup, database helpers
- **cache/**: Cache manager, cache policies

### `/services` - Platform Services
- **storage/**: Flutter Secure Storage, Shared Preferences wrappers
- **notification/**: Firebase Cloud Messaging, local notifications
- **analytics/**: Firebase Analytics, custom event tracking
- **crash_reporting/**: Firebase Crashlytics
- **file/**: File picker, image picker, file upload/download
- **location/**: Location services
- **network/**: Network connectivity monitoring

### `/shared` - Shared Across Features
- Reusable components used by multiple features
- Common domain entities (User, School, Role, etc.)
- Shared repositories
- Global widgets (buttons, cards, dialogs, etc.)

### `/l10n` - Localization
- App translations
- Language files (en.arb, ar.arb, etc.)
- Generated localization classes

### `/assets` - Static Assets
- Images, icons, fonts, animations
- Organized by type

---

## Feature Module Structure

Each feature follows the same clean architecture pattern:

```
feature_name/
├── data/
│   ├── datasources/
│   │   ├── feature_remote_datasource.dart
│   │   └── feature_local_datasource.dart
│   ├── models/
│   │   └── feature_model.dart (with .g.dart and .freezed.dart)
│   └── repositories/
│       └── feature_repository_impl.dart
├── domain/
│   ├── entities/
│   │   └── feature_entity.dart
│   ├── repositories/
│   │   └── feature_repository.dart (abstract)
│   └── usecases/
│       ├── get_feature_usecase.dart
│       ├── create_feature_usecase.dart
│       └── update_feature_usecase.dart
└── presentation/
    ├── pages/
    │   ├── feature_list_page.dart
    │   └── feature_detail_page.dart
    ├── widgets/
    │   ├── feature_card.dart
    │   └── feature_form.dart
    └── providers/
        ├── feature_provider.dart
        └── feature_state.dart
```

---

## Data Flow

```
User Interaction
      ↓
  [Presentation Layer]
  - Widget triggers event
  - Provider handles event
      ↓
  [Domain Layer]
  - Provider calls UseCase
  - UseCase executes business logic
  - UseCase calls Repository (interface)
      ↓
  [Data Layer]
  - Repository implementation
  - Fetches from DataSource (Remote/Local)
  - Maps Model → Entity
      ↓
  [Domain Layer]
  - Returns Entity to UseCase
      ↓
  [Presentation Layer]
  - Provider updates state
  - Widget rebuilds with new data
```

---

## Technology Stack

### State Management & DI
- **flutter_riverpod**: State management and dependency injection

### Code Generation
- **freezed**: Immutable classes and union types
- **json_serializable**: JSON serialization
- **build_runner**: Code generation

### Networking
- **dio**: HTTP client
- **retrofit** (optional): Type-safe API client
- **connectivity_plus**: Network connectivity

### Local Storage
- **flutter_secure_storage**: Secure token storage
- **shared_preferences**: Simple key-value storage
- **hive** or **sqflite**: Local database

### Navigation
- **go_router**: Declarative routing with deep links

### UI/UX
- **cached_network_image**: Image caching
- **shimmer**: Loading placeholders
- **flutter_svg**: SVG support
- **lottie**: Animations

### Platform Services
- **firebase_messaging**: Push notifications
- **firebase_analytics**: Analytics
- **firebase_crashlytics**: Crash reporting
- **image_picker**: Image selection
- **file_picker**: File selection
- **permission_handler**: Runtime permissions

### Utilities
- **intl**: Internationalization
- **equatable**: Value equality
- **dartz** or **fpdart**: Functional programming (Either, Option)
- **logger**: Logging

### Testing
- **mocktail**: Mocking
- **flutter_test**: Widget testing
- **integration_test**: Integration testing

---

## Testing Structure

```
test/
├── unit/                             # Unit tests
│   ├── features/
│   │   └── auth/
│   │       ├── domain/
│   │       │   └── usecases/
│   │       └── data/
│   │           └── repositories/
│   └── core/
├── widget/                           # Widget tests
│   └── features/
│       └── auth/
│           └── presentation/
│               └── pages/
├── integration/                      # Integration tests
│   └── auth_flow_test.dart
├── fixtures/                         # Test data
│   └── auth_fixtures.dart
└── mocks/                           # Mock classes
    └── mock_repositories.dart
```

---

## Naming Conventions

### Files
- **Snake case**: `feature_list_page.dart`
- **Suffixes**: 
  - Pages: `_page.dart`
  - Widgets: `_widget.dart` or `_card.dart`
  - Providers: `_provider.dart`
  - Models: `_model.dart`
  - Entities: `_entity.dart`
  - UseCases: `_usecase.dart`
  - Repositories: `_repository.dart`
  - DataSources: `_datasource.dart`

### Classes
- **Pascal case**: `FeatureListPage`
- **Suffixes match file suffixes**

### Variables & Functions
- **Camel case**: `getUserProfile`, `isLoading`

---

## Best Practices

### 1. **Separation of Concerns**
- Each layer has a single responsibility
- Domain layer is framework-agnostic
- Presentation layer only handles UI

### 2. **Dependency Inversion**
- Depend on abstractions, not concretions
- Use repository interfaces in domain layer
- Inject dependencies via Riverpod

### 3. **Immutability**
- Use `@freezed` for immutable classes
- Use `const` constructors where possible

### 4. **Error Handling**
- Use `Either<Failure, Success>` pattern (from dartz/fpdart)
- Custom exceptions in core/exceptions
- Meaningful error messages

### 5. **Code Generation**
- Use json_serializable for models
- Use freezed for data classes
- Keep generated files in version control

### 6. **Testing**
- Aim for high test coverage
- Test business logic (usecases) thoroughly
- Mock external dependencies

### 7. **Documentation**
- Document complex business logic
- Add comments for public APIs
- Keep README updated

### 8. **Git Workflow**
- Feature branches
- Meaningful commit messages
- Pull request reviews

---

## Environment Configuration

Support for multiple environments:

```dart
// lib/config/environment/app_environment.dart
enum Environment { development, staging, production }

class AppEnvironment {
  static Environment current = Environment.development;
  
  static String get apiBaseUrl {
    switch (current) {
      case Environment.development:
        return 'https://dev-api.eskoolia.com';
      case Environment.staging:
        return 'https://staging-api.eskoolia.com';
      case Environment.production:
        return 'https://api.eskoolia.com';
    }
  }
}
```

---

## Security Considerations

1. **Token Storage**: Use Flutter Secure Storage for auth tokens
2. **API Keys**: Never commit API keys; use environment variables
3. **Certificate Pinning**: Implement for production
4. **ProGuard/R8**: Enable code obfuscation for release builds
5. **Root Detection**: Implement for sensitive operations
6. **Biometric Auth**: Use local_auth for biometric authentication

---

## Performance Optimization

1. **Lazy Loading**: Load features on demand
2. **Image Optimization**: Use cached_network_image
3. **Code Splitting**: Use deferred imports for large features
4. **List Performance**: Use ListView.builder for long lists
5. **State Management**: Use Riverpod's autoDispose for memory management
6. **Build Optimization**: Use const constructors

---

## Deployment Pipeline

1. **Development**: Local testing and development
2. **Staging**: QA testing environment
3. **Production**: Live environment

Use flavors for different environments:
```bash
flutter run --flavor development -t lib/main_dev.dart
flutter run --flavor staging -t lib/main_staging.dart
flutter run --flavor production -t lib/main_prod.dart
```

---

## Conclusion

This architecture provides a solid foundation for building a scalable, maintainable, and testable enterprise Flutter application. The feature-first approach combined with clean architecture ensures that the codebase remains organized as the application grows, and multiple developers can work efficiently with minimal conflicts.

The structure supports:
- ✅ Multi-tenant architecture
- ✅ Role-based access control
- ✅ Real-time features
- ✅ Offline-first capabilities
- ✅ Comprehensive testing
- ✅ Easy onboarding for new developers
- ✅ Parallel development by multiple teams

---

**Next Steps**: 
1. Review and approve this architecture
2. Set up dependencies in pubspec.yaml
3. Configure environment files
4. Set up CI/CD pipeline
5. Begin feature implementation

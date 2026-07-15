# 🎓 Eskoolia Mobile App

> Enterprise-Grade Flutter Application for School Management

[![Flutter](https://img.shields.io/badge/Flutter-3.x-blue.svg)](https://flutter.dev/)
[![Dart](https://img.shields.io/badge/Dart-3.12.1+-0175C2.svg)](https://dart.dev/)
[![Architecture](https://img.shields.io/badge/Architecture-Clean%20Architecture-green.svg)]()
[![State Management](https://img.shields.io/badge/State%20Management-Riverpod-purple.svg)]()

---

## 📱 About

Eskoolia Mobile is a comprehensive school management system built with Flutter, designed to serve **Students, Parents, Teachers, and Staff** with a unified, intuitive mobile experience.

### Key Features
- 🔐 **Multi-Role Authentication**: Student, Parent, Teacher, Staff portals
- 📊 **Role-Based Dashboards**: Customized experience for each user type
- 📅 **Attendance Management**: Real-time attendance tracking
- 💰 **Fee Management**: Payment tracking and history
- 📚 **Academic Module**: Assignments, grades, curriculum
- 📝 **Exam Management**: Scheduling, results, analytics
- ⏰ **Timetable**: Class schedules and teacher timetables
- 💬 **In-App Chat**: Real-time messaging
- 🔔 **Push Notifications**: Stay updated with instant alerts
- 👤 **Profile Management**: Complete user profile control
- ⚙️ **Settings & Preferences**: Customizable app experience
- 📖 **Library Management**: Book tracking and borrowing
- 📈 **Reports & Analytics**: Comprehensive insights
- 🎯 **Behaviour Tracking**: Student discipline management
- 🎓 **Admissions**: New student enrollment
- 👔 **HR Management**: Staff and employee management

---

## 🏗️ Architecture

This project follows **Enterprise-Grade Clean Architecture** with:

- ✅ **Clean Architecture**: Separation of Data, Domain, and Presentation layers
- ✅ **Feature-First**: Modular, feature-based organization
- ✅ **MVVM Pattern**: Model-View-ViewModel for presentation
- ✅ **Repository Pattern**: Abstraction over data sources
- ✅ **SOLID Principles**: Maintainable and scalable code
- ✅ **Dependency Injection**: Using Riverpod
- ✅ **Riverpod**: State management and DI

### Architecture Layers

```
┌─────────────────────────────────────┐
│     PRESENTATION LAYER              │
│  (UI, Widgets, State Management)    │
│         ↓ Uses ↓                    │
│      DOMAIN LAYER                   │
│  (Business Logic, Use Cases)        │
│         ↓ Uses ↓                    │
│       DATA LAYER                    │
│  (API, Database, Cache)             │
└─────────────────────────────────────┘
```

**Read more**: [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 📁 Project Structure

```
eskoolia_mobapp/
├── lib/
│   ├── config/           # App configuration (DI, Router, Environment)
│   ├── core/             # Core utilities (Theme, Constants, Utils)
│   ├── data/             # Global data infrastructure
│   ├── features/         # 19+ Feature modules
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── student/
│   │   ├── parent/
│   │   ├── teacher/
│   │   ├── attendance/
│   │   ├── fees/
│   │   └── ... (16 more features)
│   ├── services/         # Platform services
│   ├── shared/           # Shared components
│   ├── l10n/             # Localization
│   └── assets/           # Static assets
└── test/                 # Test infrastructure
```

**Detailed guide**: [FOLDER_GUIDE.md](FOLDER_GUIDE.md)

---

## 🚀 Getting Started

### Prerequisites

- Flutter SDK: `^3.12.1`
- Dart SDK: `^3.12.1`
- Android Studio / VS Code
- Xcode (for iOS development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd eskoolia_mobapp
   ```

2. **Install dependencies**
   ```bash
   flutter pub get
   ```

3. **Run code generation** (after adding models)
   ```bash
   flutter pub run build_runner build --delete-conflicting-outputs
   ```

4. **Run the app**
   ```bash
   # Development
   flutter run --flavor development -t lib/main_dev.dart

   # Staging
   flutter run --flavor staging -t lib/main_staging.dart

   # Production
   flutter run --flavor production -t lib/main_prod.dart
   ```

---

## 🛠️ Tech Stack

### Core
- **Flutter**: UI framework
- **Dart**: Programming language

### State Management
- **Riverpod**: State management + Dependency Injection

### Code Generation
- **Freezed**: Immutable classes and union types
- **json_serializable**: JSON serialization
- **build_runner**: Code generation tool

### Networking
- **Dio**: HTTP client
- **Retrofit** (optional): Type-safe REST client

### Local Storage
- **flutter_secure_storage**: Secure token storage
- **shared_preferences**: Key-value storage
- **Hive** or **Sqflite**: Local database

### Navigation
- **go_router**: Declarative routing

### UI Components
- **cached_network_image**: Image caching
- **shimmer**: Loading animations
- **flutter_svg**: SVG support
- **lottie**: Animations

### Firebase
- **firebase_messaging**: Push notifications
- **firebase_analytics**: Analytics
- **firebase_crashlytics**: Crash reporting

### Testing
- **mocktail**: Mocking
- **flutter_test**: Unit & Widget testing
- **integration_test**: E2E testing

---

## 📚 Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Complete architecture guide
- **[FOLDER_GUIDE.md](FOLDER_GUIDE.md)** - Quick reference for folder structure
- **[SUMMARY.md](SUMMARY.md)** - Implementation summary

---

## 🧪 Testing

### Run Tests

```bash
# All tests
flutter test

# Unit tests only
flutter test test/unit

# Widget tests only
flutter test test/widget

# Integration tests
flutter test integration_test
```

---

## 📱 Build & Release

### Android

```bash
# Debug
flutter build apk --flavor development

# Release
flutter build appbundle --flavor production --release
```

### iOS

```bash
# Debug
flutter build ios --flavor development

# Release
flutter build ios --flavor production --release
```

---

## 💡 Tips for Developers

1. **Always read the documentation first** (ARCHITECTURE.md, FOLDER_GUIDE.md)
2. **Follow the existing patterns** - Don't create new ones
3. **Test your code** - Write unit tests for business logic
4. **Use the decision tree** in FOLDER_GUIDE.md when unsure
5. **Keep features isolated** - Minimal cross-feature dependencies

---

## ⚡ Quick Commands

```bash
# Install dependencies
flutter pub get

# Run code generation
flutter pub run build_runner watch

# Run app (dev)
flutter run

# Run tests
flutter test

# Check for issues
flutter analyze

# Format code
flutter format .

# Clean build
flutter clean && flutter pub get
```

---

## 🏆 Status

**Current Status**: ✅ **Architecture Complete - Ready for Implementation**

**Next Step**: Setup dependencies and begin feature implementation

---

**Built with ❤️ using Flutter**

*Eskoolia - Empowering Education Through Technology*

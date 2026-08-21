import type { BotModuleManifest } from '@/types/bot';

export const studentsManifest: BotModuleManifest = {
  id: 'students',
  label: 'Students',
  entity: {
    endpoint: '/api/v1/students/students/',
    searchFields: ['search'],
    displayFields: ['fullName', 'admissionNo', 'rollNo', 'className', 'section', 'status'],
  },
  keywords: [
    'student', 'students', 'find student', 'search student', 'who is',
    'admission no', 'roll no', 'student list',
  ],
  actions: [],
  // No requiredFeatureFlag: student records are foundational, available on
  // every plan (not in apps/tenancy/feature_flags.py's DEFAULT_FEATURES).
};

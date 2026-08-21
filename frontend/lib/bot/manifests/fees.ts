import type { BotModuleManifest } from '@/types/bot';

export const feesManifest: BotModuleManifest = {
  id: 'fees',
  label: 'Fees',
  entity: {
    // FeeAssignmentListCreateAPIView filters by student id, not free text —
    // this manifest resolves against context.lastViewedEntity (a student
    // just looked up in the same conversation), not a fuzzy text search.
    endpoint: '/api/v1/fees/assignments/',
    searchFields: ['student'],
    displayFields: ['fees_type_name', 'amount', 'due_date', 'status', 'net_due'],
  },
  keywords: [
    'fee', 'fees', 'fees due', 'fee status', 'how much fee', 'outstanding fee',
    'due amount', 'fee payment',
  ],
  actions: [],
  requiredFeatureFlag: 'fees_enabled',
};

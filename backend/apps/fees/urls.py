from django.urls import path
from .views import (
    FeesGroupListCreateAPIView,
    FeesGroupDetailAPIView,
    FeesTypeListCreateAPIView,
    FeesTypeDetailAPIView,
    FeeAssignmentListCreateAPIView,
    FeeAssignmentDetailAPIView,
    PaymentListCreateAPIView,
    PaymentDetailAPIView,
    FeeAssignmentSummaryAPIView,
    FeeAssignmentOverdueAPIView,
    FeeAssignmentCarryForwardAPIView,
    PaymentReceiptAPIView,
    PaymentTransitionAPIView,
    TermSettingsListCreateAPIView,
    TermSettingsDetailAPIView,
    FeeScheduleListCreateAPIView,
    FeeScheduleDetailAPIView,
    ConcessionRuleListCreateAPIView,
    ConcessionRuleDetailAPIView,
    LateFeeRuleListCreateAPIView,
    LateFeeRuleDetailAPIView,
    PaymentReconciliationListCreateAPIView,
    PaymentReconciliationDetailAPIView,
    DuesSummaryAPIView,
    DuesByClassAPIView,
    DueInteractionListCreateAPIView,
    DuesResolveAPIView,
    DuesSendReminderAPIView,
    DuesExportCSVAPIView,
    YearEndReportCSVAPIView,
    YearEndGroupAmountsAPIView,
)

app_name = 'fees'

urlpatterns = [
    # Fee Groups
    path('groups/', FeesGroupListCreateAPIView.as_view(), name='fees-group-list-create'),
    path('groups/<int:pk>/', FeesGroupDetailAPIView.as_view(), name='fees-group-detail'),

    # Fee Types
    path('types/', FeesTypeListCreateAPIView.as_view(), name='fees-type-list-create'),
    path('types/<int:pk>/', FeesTypeDetailAPIView.as_view(), name='fees-type-detail'),

    # Term Settings
    path('term-settings/', TermSettingsListCreateAPIView.as_view(), name='term-settings-list-create'),
    path('term-settings/<int:pk>/', TermSettingsDetailAPIView.as_view(), name='term-settings-detail'),

    # Fee Schedules
    path('schedules/', FeeScheduleListCreateAPIView.as_view(), name='fee-schedule-list-create'),
    path('schedules/<int:pk>/', FeeScheduleDetailAPIView.as_view(), name='fee-schedule-detail'),

    # Concession Rules
    path('concession-rules/', ConcessionRuleListCreateAPIView.as_view(), name='concession-rule-list-create'),
    path('concession-rules/<int:pk>/', ConcessionRuleDetailAPIView.as_view(), name='concession-rule-detail'),

    # Late Fee Rules
    path('late-fee-rules/', LateFeeRuleListCreateAPIView.as_view(), name='late-fee-rule-list-create'),
    path('late-fee-rules/<int:pk>/', LateFeeRuleDetailAPIView.as_view(), name='late-fee-rule-detail'),

    # Fee Assignments
    path('assignments/', FeeAssignmentListCreateAPIView.as_view(), name='fee-assignment-list-create'),
    path('assignments/<int:pk>/', FeeAssignmentDetailAPIView.as_view(), name='fee-assignment-detail'),
    
    # Custom Assignment Actions
    path('assignments/summary/', FeeAssignmentSummaryAPIView.as_view(), name='fee-assignment-summary'),
    path('assignments/overdue/', FeeAssignmentOverdueAPIView.as_view(), name='fee-assignment-overdue'),
    path('assignments/carry-forward/', FeeAssignmentCarryForwardAPIView.as_view(), name='fee-assignment-carry-forward'),

    # Payments
    path('payments/', PaymentListCreateAPIView.as_view(), name='payment-list-create'),
    path('payments/<int:pk>/', PaymentDetailAPIView.as_view(), name='payment-detail'),

    # Custom Payment Actions
    path('payments/<int:pk>/receipt/', PaymentReceiptAPIView.as_view(), name='payment-receipt'),
    path('payments/<int:pk>/transition/', PaymentTransitionAPIView.as_view(), name='payment-transition'),

    # Payment Reconciliation
    path('reconciliations/', PaymentReconciliationListCreateAPIView.as_view(), name='reconciliation-list-create'),
    path('reconciliations/<int:pk>/', PaymentReconciliationDetailAPIView.as_view(), name='reconciliation-detail'),

    # Dues & Reminders
    path('dues/summary/', DuesSummaryAPIView.as_view(), name='dues-summary'),
    path('dues/by-class/', DuesByClassAPIView.as_view(), name='dues-by-class'),
    path('dues/interactions/', DueInteractionListCreateAPIView.as_view(), name='dues-interactions'),
    path('dues/resolve/', DuesResolveAPIView.as_view(), name='dues-resolve'),
    path('dues/send-reminder/', DuesSendReminderAPIView.as_view(), name='dues-send-reminder'),
    path('dues/export-csv/', DuesExportCSVAPIView.as_view(), name='dues-export-csv'),

    # Year-End
    path('year-end/report/', YearEndReportCSVAPIView.as_view(), name='year-end-report'),
    path('year-end/group-amounts/', YearEndGroupAmountsAPIView.as_view(), name='year-end-group-amounts'),
]

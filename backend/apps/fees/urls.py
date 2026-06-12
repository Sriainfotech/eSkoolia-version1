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
]

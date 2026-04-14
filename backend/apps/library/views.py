from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, viewsets
from config.pagination import ApiPageNumberPagination
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import Book, BookCategory, BookIssue, LibraryMember
from .serializers import BookCategorySerializer, BookIssueSerializer, BookSerializer, LibraryMemberSerializer


class SchoolScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ApiPageNumberPagination
    permission_codes = {}

    def get_required_permission_code(self):
        action = getattr(self, "action", None)
        if action and action in self.permission_codes:
            return self.permission_codes[action]
        return self.permission_codes.get("*")

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        code = self.get_required_permission_code()
        if not code:
            return
        user = request.user
        if user.is_superuser:
            return
        if not hasattr(user, "has_permission_code") or not user.has_permission_code(code):
            raise PermissionDenied("You do not have permission to perform this action.")

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return queryset
        if user.school_id:
            return queryset.filter(school_id=user.school_id)
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        serializer.save(school=school)


class BookCategoryViewSet(SchoolScopedModelViewSet):
    queryset = BookCategory.objects.select_related("school").all()
    serializer_class = BookCategorySerializer
    pagination_class = ApiPageNumberPagination
    filterset_fields = ["is_active"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    permission_codes = {"*": "library.book_categories.view"}


class BookViewSet(SchoolScopedModelViewSet):
    queryset = Book.objects.select_related("school", "category").all()
    serializer_class = BookSerializer
    pagination_class = ApiPageNumberPagination
    filterset_fields = ["category", "rack"]
    search_fields = ["title", "author", "isbn", "publisher"]
    ordering_fields = ["title", "available_quantity", "created_at"]
    permission_codes = {"*": "library.books.view"}


class LibraryMemberViewSet(SchoolScopedModelViewSet):
    queryset = LibraryMember.objects.select_related("school", "student", "staff").all()
    serializer_class = LibraryMemberSerializer
    pagination_class = ApiPageNumberPagination
    filterset_fields = ["member_type", "is_active"]
    search_fields = ["card_no", "student__first_name", "student__last_name", "staff__first_name", "staff__last_name"]
    ordering_fields = ["created_at", "card_no"]
    permission_codes = {"*": "library.library_members.view"}


class BookIssueViewSet(SchoolScopedModelViewSet):
    queryset = BookIssue.objects.select_related("school", "book", "member", "issued_by").all()
    serializer_class = BookIssueSerializer
    pagination_class = ApiPageNumberPagination
    filterset_fields = ["book", "member", "status", "issue_date", "due_date"]
    search_fields = ["book__title", "member__card_no"]
    ordering_fields = ["issue_date", "due_date", "created_at"]
    permission_codes = {
        "*": "library.book_issues.view",
        "mark_returned": "library.book_issues.view",
        "overdue": "library.book_issues.view",
    }

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")

        issue = serializer.save(school=school, issued_by=user)
        if issue.status == BookIssue.STATUS_ISSUED:
            issue.book.available_quantity = max(issue.book.available_quantity - 1, 0)
            issue.book.save(update_fields=["available_quantity", "updated_at"])

    @transaction.atomic
    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_status = old_instance.status
        old_book_id = old_instance.book_id

        instance = serializer.save()

        if old_status == BookIssue.STATUS_ISSUED and (instance.status != BookIssue.STATUS_ISSUED or instance.book_id != old_book_id):
            old_book = Book.objects.get(id=old_book_id)
            old_book.available_quantity = old_book.available_quantity + 1
            old_book.save(update_fields=["available_quantity", "updated_at"])

        if instance.status == BookIssue.STATUS_ISSUED and (old_status != BookIssue.STATUS_ISSUED or instance.book_id != old_book_id):
            if instance.book.available_quantity <= 0:
                raise ValidationError({"book": "No available copies for this book."})
            instance.book.available_quantity = instance.book.available_quantity - 1
            instance.book.save(update_fields=["available_quantity", "updated_at"])

    @action(detail=True, methods=["post"], url_path="return")
    @transaction.atomic
    def mark_returned(self, request, pk=None):
        issue = self.get_object()
        if issue.status != BookIssue.STATUS_ISSUED:
            raise ValidationError("Only issued books can be returned.")

        issue.status = BookIssue.STATUS_RETURNED
        issue.return_date = request.data.get("return_date") or timezone.localdate()
        issue.fine_amount = request.data.get("fine_amount", issue.fine_amount)
        issue.save(update_fields=["status", "return_date", "fine_amount", "updated_at"])

        issue.book.available_quantity = issue.book.available_quantity + 1
        issue.book.save(update_fields=["available_quantity", "updated_at"])

        return Response({"id": issue.id, "status": issue.status, "return_date": issue.return_date})

    @action(detail=False, methods=["get"], url_path="overdue")
    def overdue(self, request):
        today = timezone.localdate()
        queryset = self.filter_queryset(
            self.get_queryset().filter(status=BookIssue.STATUS_ISSUED, due_date__lt=today)
        )
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

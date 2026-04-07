"""
Base ViewSet classes with common functionality for the API.
Provides filtering, pagination, error handling, and tenant scoping.
"""

from django.db.models import Q, QuerySet
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError

from .exceptions import SchoolNotFound, InvalidQueryParams
from .responses import APIResponseMixin


class PaginatedModelViewSet(APIResponseMixin, viewsets.ModelViewSet):
    """
    Base ViewSet with pagination, filtering, and standardized responses.
    Automatically handles school tenant scoping.
    """
    
    permission_classes = [IsAuthenticated]
    model = None
    filterset_fields = []
    search_fields = []
    ordering_fields = []
    default_ordering = ['-created_at']

    def get_queryset(self):
        """Get filtered queryset based on user's school and permissions."""
        user = self.request.user
        
        if not self.model:
            raise ValueError(f"{self.__class__.__name__} must define 'model' attribute")
        
        queryset = self.model.objects.all()
        
        # Apply tenant scoping
        if hasattr(self.model, 'school'):
            if not user.is_superuser:
                if not user.school_id:
                    return queryset.none()
                queryset = queryset.filter(school_id=user.school_id)
        
        # Apply search filtering
        search_query = self.request.query_params.get('search', '').strip()
        if search_query and self.search_fields:
            search_filters = Q()
            for field in self.search_fields:
                search_filters |= Q(**{f'{field}__icontains': search_query})
            queryset = queryset.filter(search_filters)
        
        # Apply ordering
        ordering = self.request.query_params.get('ordering', '').strip()
        if ordering:
            if ordering.lstrip('-') in self.ordering_fields or not self.ordering_fields:
                queryset = queryset.order_by(ordering)
        elif self.default_ordering:
            queryset = queryset.order_by(*self.default_ordering)
        
        return queryset

    def filter_queryset(self, queryset):
        """Apply additional filtering based on query parameters."""
        queryset = super().filter_queryset(queryset)
        
        # Custom filtering for specific fields
        for field in self.filterset_fields:
            param_value = self.request.query_params.get(field)
            if param_value:
                try:
                    queryset = queryset.filter(**{field: param_value})
                except (ValueError, TypeError) as e:
                    raise InvalidQueryParams(f"Invalid value for filter '{field}': {str(e)}")
        
        return queryset

    def perform_create(self, serializer):
        """
        Create instance with school context.
        Override this method if additional logic is needed.
        """
        user = self.request.user
        school = user.school
        
        if not school and hasattr(self.request, 'school'):
            school = self.request.school
        
        # If model has school field and user has school, set it
        if hasattr(self.model, 'school') and school:
            serializer.save(school=school)
        else:
            serializer.save()

    def perform_update(self, serializer):
        """Update instance. Can be overridden for custom logic."""
        serializer.save()

    def perform_destroy(self, instance):
        """Soft delete or hard delete. Override for custom behavior."""
        instance.delete()

    def create(self, request, *args, **kwargs):
        """Override to provide standardized response on creation."""
        try:
            response = super().create(request, *args, **kwargs)
            return Response(
                {
                    "success": True,
                    "message": "Resource created successfully",
                    "data": response.data,
                },
                status=status.HTTP_201_CREATED,
            )
        except ValidationError as e:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "validation_error",
                        "message": "Validation failed",
                        "details": e.detail,
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "create_error",
                        "message": str(e),
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    def list(self, request, *args, **kwargs):
        """Override to provide standardized paginated response on list."""
        try:
            response = super().list(request, *args, **kwargs)
            if isinstance(response.data, dict) and "results" in response.data:
                payload = dict(response.data)
                payload.update(
                    {
                        "success": True,
                        "message": "Data retrieved successfully",
                        "data": payload.get("results", []),
                    }
                )
                return Response(payload, status=status.HTTP_200_OK)
            return Response(
                {
                    "success": True,
                    "message": "Data retrieved successfully",
                    "count": response.data.get('count', 0) if isinstance(response.data, dict) else len(response.data),
                    "next": response.data.get('next') if isinstance(response.data, dict) else None,
                    "previous": response.data.get('previous') if isinstance(response.data, dict) else None,
                    "results": response.data.get('results', response.data) if isinstance(response.data, dict) else response.data,
                    "data": response.data.get('results', response.data) if isinstance(response.data, dict) else response.data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "list_error",
                        "message": str(e),
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    def retrieve(self, request, *args, **kwargs):
        """Override to provide standardized response on retrieve."""
        try:
            response = super().retrieve(request, *args, **kwargs)
            return Response(
                {
                    "success": True,
                    "message": "Resource retrieved successfully",
                    "data": response.data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "retrieve_error",
                        "message": str(e),
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    def update(self, request, *args, **kwargs):
        """Override to provide standardized response on update."""
        try:
            response = super().update(request, *args, **kwargs)
            return Response(
                {
                    "success": True,
                    "message": "Resource updated successfully",
                    "data": response.data,
                },
                status=status.HTTP_200_OK,
            )
        except ValidationError as e:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "validation_error",
                        "message": "Validation failed",
                        "details": e.detail,
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "update_error",
                        "message": str(e),
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    def destroy(self, request, *args, **kwargs):
        """Override to provide standardized response on destroy."""
        try:
            instance = self.get_object()
            self.perform_destroy(instance)
            return Response(
                {
                    "success": True,
                    "message": "Resource deleted successfully",
                    "data": {},
                },
                status=status.HTTP_204_NO_CONTENT,
            )
        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "delete_error",
                        "message": str(e),
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary statistics for the resource."""
        queryset = self.get_queryset()
        return Response(
            {
                "success": True,
                "message": "Summary retrieved successfully",
                "data": {
                    "total_count": queryset.count(),
                    "active_count": queryset.filter(active_status=True).count() if hasattr(self.model, 'active_status') else None,
                },
            },
            status=status.HTTP_200_OK,
        )


class ReadOnlyPaginatedViewSet(PaginatedModelViewSet):
    """Read-only version of PaginatedModelViewSet."""
    
    http_method_names = ['get', 'head', 'options']

    def get_queryset(self):
        """Restrict to read-only access."""
        return super().get_queryset()

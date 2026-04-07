"""
Standardized API response utilities and mixins.
Ensures consistent response format across all endpoints.
"""

from rest_framework.response import Response
from rest_framework import status


class StandardizedResponse:
    """Provides methods for standardized API responses."""

    @staticmethod
    def success(data=None, message="Success", status_code=status.HTTP_200_OK):
        """Return a successful response with standardized format."""
        return Response(
            {
                "success": True,
                "message": message,
                "data": data,
            },
            status=status_code,
        )

    @staticmethod
    def error(message="An error occurred", code="error", status_code=status.HTTP_400_BAD_REQUEST, extra_data=None):
        """Return an error response with standardized format."""
        response_data = {
            "success": False,
            "error": {
                "code": code,
                "message": message,
            },
        }
        if extra_data:
            response_data["error"].update(extra_data)
        return Response(response_data, status=status_code)

    @staticmethod
    def paginated(page_obj, serializer_data, message="Data retrieved successfully", status_code=status.HTTP_200_OK):
        """Return a paginated response with metadata."""
        count = page_obj.paginator.count if hasattr(page_obj, 'paginator') else len(serializer_data)
        next_link = page_obj.get_next_link() if hasattr(page_obj, 'get_next_link') else None
        previous_link = page_obj.get_previous_link() if hasattr(page_obj, 'get_previous_link') else None
        return Response(
            {
                "success": True,
                "message": message,
                "count": count,
                "next": next_link,
                "previous": previous_link,
                "results": serializer_data,
                "data": serializer_data,
            },
            status=status_code,
        )


class APIResponseMixin:
    """Mixin for ViewSets to provide standardized responses."""

    def success_response(self, data=None, message="Success", status_code=status.HTTP_200_OK):
        """Helper method for success responses."""
        return StandardizedResponse.success(data, message, status_code)

    def error_response(self, message="An error occurred", code="error", status_code=status.HTTP_400_BAD_REQUEST, extra_data=None):
        """Helper method for error responses."""
        return StandardizedResponse.error(message, code, status_code, extra_data)

    def paginated_response(self, page_obj, serializer_data, message="Data retrieved successfully", status_code=status.HTTP_200_OK):
        """Helper method for paginated responses."""
        return StandardizedResponse.paginated(page_obj, serializer_data, message, status_code)

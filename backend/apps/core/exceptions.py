"""
Centralized exception handling for the API.
Provides consistent error responses across all endpoints.
"""

from rest_framework import status
from rest_framework.exceptions import APIException


class APIError(APIException):
    """Base API Exception with standardized response format."""
    
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = "An error occurred."
    default_code = "error"

    def __init__(self, detail=None, code=None, status_code=None, extra_data=None):
        self.detail = detail or self.default_detail
        self.code = code or self.default_code
        if status_code:
            self.status_code = status_code
        self.extra_data = extra_data or {}

    def get_response_data(self):
        return {
            "success": False,
            "error": {
                "code": self.code,
                "message": str(self.detail),
                **self.extra_data,
            },
        }


class ValidationError(APIError):
    """Raised when request data validation fails."""
    
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Invalid data provided."
    default_code = "validation_error"


class ResourceNotFound(APIError):
    """Raised when a requested resource is not found."""
    
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Resource not found."
    default_code = "not_found"


class PermissionDenied(APIError):
    """Raised when user doesn't have permission to perform an action."""
    
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "You don't have permission to perform this action."
    default_code = "permission_denied"


class Unauthorized(APIError):
    """Raised when authentication is required but not provided."""
    
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Authentication credentials were not provided."
    default_code = "unauthorized"


class ConflictError(APIError):
    """Raised when the request conflicts with existing data."""
    
    status_code = status.HTTP_409_CONFLICT
    default_detail = "A resource with this data already exists."
    default_code = "conflict"


class SchoolNotFound(ResourceNotFound):
    """Raised when school context is missing."""
    
    default_detail = "School context not found. Please login to a school."
    default_code = "school_not_found"


class InvalidQueryParams(ValidationError):
    """Raised when query parameters are invalid."""
    
    default_detail = "Invalid query parameters."
    default_code = "invalid_query_params"

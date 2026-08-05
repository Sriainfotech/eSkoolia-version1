"""
API Utilities - Helper functions for common operations across the API.
Includes filtering, pagination, validation, and date/time utilities.
"""

from datetime import datetime, timedelta, date
from django.db.models import Q, Count
from rest_framework import status
from rest_framework.response import Response
from .exceptions import InvalidQueryParams


class DateTimeUtils:
    """Utilities for date and time operations."""
    
    @staticmethod
    def parse_date(date_str):
        """Parse date string in various formats."""
        formats = ['%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y', '%Y/%m/%d']
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Unable to parse date: {date_str}")
    
    @staticmethod
    def get_academic_year_dates(academic_year):
        """Get start and end dates of an academic year."""
        if hasattr(academic_year, 'start_date') and hasattr(academic_year, 'end_date'):
            return academic_year.start_date, academic_year.end_date
        return None, None
    
    @staticmethod
    def get_date_range(start_date, end_date):
        """Generate all dates between start_date and end_date."""
        current = start_date
        dates = []
        while current <= end_date:
            dates.append(current)
            current += timedelta(days=1)
        return dates
    
    @staticmethod
    def get_month_range(year, month):
        """Get the first and last date of a given month."""
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        start_date = date(year, month, 1)
        return start_date, end_date


class SearchUtils:
    """Utilities for search and filtering operations."""
    
    @staticmethod
    def build_search_query(search_term, search_fields):
        """Build a Q object for searching multiple fields."""
        if not search_term or not search_fields:
            return Q()
        
        query = Q()
        for field in search_fields:
            query |= Q(**{f'{field}__icontains': search_term})
        return query
    
    @staticmethod
    def apply_filters(queryset, filters):
        """
        Apply multiple filters to a queryset.
        
        Args:
            queryset: Django QuerySet
            filters: Dict of {field_name: value} pairs
        
        Returns:
            Filtered QuerySet
        """
        for field, value in filters.items():
            if value:
                try:
                    queryset = queryset.filter(**{field: value})
                except Exception as e:
                    raise InvalidQueryParams(f"Invalid filter '{field}': {str(e)}")
        return queryset
    
    @staticmethod
    def apply_range_filter(queryset, field, start_value, end_value):
        """Apply range filtering (e.g., date range, number range)."""
        if start_value:
            queryset = queryset.filter(**{f'{field}__gte': start_value})
        if end_value:
            queryset = queryset.filter(**{f'{field}__lte': end_value})
        return queryset


class ValidationUtils:
    """Utilities for data validation."""
    
    @staticmethod
    def validate_email(email):
        """Validate email format."""
        import re
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(email_regex, email) is not None
    
    @staticmethod
    def validate_phone(phone):
        """Validate phone number format."""
        import re
        phone_regex = r'^\d{1,12}$'
        return re.match(phone_regex, str(phone or '').strip()) is not None
    
    @staticmethod
    def validate_required_fields(data, required_fields):
        """Validate that all required fields are present."""
        missing_fields = []
        for field in required_fields:
            if field not in data or data[field] is None:
                missing_fields.append(field)
        
        if missing_fields:
            raise InvalidQueryParams(f"Required fields missing: {', '.join(missing_fields)}")
    
    @staticmethod
    def validate_enum(value, allowed_values, field_name="value"):
        """Validate that a value is in allowed list."""
        if value not in allowed_values:
            raise InvalidQueryParams(
                f"Invalid {field_name}: {value}. Allowed values: {', '.join(map(str, allowed_values))}"
            )


class PaginationUtils:
    """Utilities for pagination handling."""
    
    @staticmethod
    def get_pagination_params(request, default_page_size=25, max_page_size=100):
        """Extract and validate pagination parameters from request."""
        try:
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', default_page_size))
            
            # Validate page number
            if page < 1:
                page = 1
            
            # Validate and cap page size
            if page_size < 1:
                page_size = default_page_size
            elif page_size > max_page_size:
                page_size = max_page_size
            
            return page, page_size
        except ValueError:
            raise InvalidQueryParams("Page and page_size must be integers")
    
    @staticmethod
    def paginate_queryset(queryset, page, page_size):
        """Manually paginate a queryset."""
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        
        items = queryset[start:end]
        
        return {
            'items': items,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
            'has_next': end < total,
            'has_previous': page > 1,
        }


class AggregationUtils:
    """Utilities for data aggregation and statistics."""
    
    @staticmethod
    def get_summary_stats(queryset, integer_fields=None, decimal_fields=None):
        """Get summary statistics for a queryset."""
        stats = {
            'total_count': queryset.count(),
            'active_count': queryset.filter(active_status=True).count() if hasattr(queryset.model, 'active_status') else None,
        }
        
        if integer_fields:
            for field in integer_fields:
                agg_result = queryset.aggregate(
                    total=Count(field),
                )
                stats[f'{field}_count'] = agg_result['total']
        
        return stats
    
    @staticmethod
    def group_by_field(queryset, group_field):
        """Group queryset results by a field."""
        groups = {}
        for item in queryset:
            key = getattr(item, group_field)
            if key not in groups:
                groups[key] = []
            groups[key].append(item)
        return groups


class BulkOperationUtils:
    """Utilities for bulk operations."""
    
    @staticmethod
    def bulk_update(model, updates):
        """
        Perform bulk update on a model.
        
        Args:
            model: Django model class
            updates: List of tuples (instance, fields_dict) or dict {id: fields_dict}
        """
        if isinstance(updates, dict):
            # Convert dict format to list of updates
            for obj_id, fields in updates.items():
                obj = model.objects.get(id=obj_id)
                for field, value in fields.items():
                    setattr(obj, field, value)
                obj.save()
        else:
            # Assume list format
            for instance, fields in updates:
                for field, value in fields.items():
                    setattr(instance, field, value)
                instance.save()
    
    @staticmethod
    def bulk_delete(model, ids):
        """Perform bulk delete on a model."""
        return model.objects.filter(id__in=ids).delete()
    
    @staticmethod
    def bulk_create(model, data_list, ignore_conflicts=False):
        """Perform bulk create on a model."""
        objects = [model(**data) for data in data_list]
        return model.objects.bulk_create(objects, ignore_conflicts=ignore_conflicts)


class ResponseFormatUtils:
    """Utilities for formatting API responses."""
    
    @staticmethod
    def format_error_response(message, code="error", status_code=status.HTTP_400_BAD_REQUEST, details=None):
        """Format an error response."""
        response_data = {
            "success": False,
            "error": {
                "code": code,
                "message": message,
            },
        }
        if details:
            response_data["error"]["details"] = details
        return Response(response_data, status=status_code)
    
    @staticmethod
    def format_success_response(data, message="Success", status_code=status.HTTP_200_OK):
        """Format a success response."""
        return Response(
            {
                "success": True,
                "message": message,
                "data": data,
            },
            status=status_code,
        )
    
    @staticmethod
    def format_list_response(items, total, page, page_size, message="Data retrieved successfully"):
        """Format a list response with pagination."""
        total_pages = (total + page_size - 1) // page_size
        return Response(
            {
                "success": True,
                "message": message,
                "pagination": {
                    "count": total,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": total_pages,
                    "has_next": page < total_pages,
                    "has_previous": page > 1,
                },
                "data": items,
            },
            status=status.HTTP_200_OK,
        )

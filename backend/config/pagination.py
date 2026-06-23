from rest_framework.pagination import PageNumberPagination


class ApiPageNumberPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 10000

    def get_page_size(self, request):
        size = super().get_page_size(request)
        if size is None:
            return self.page_size
        return max(10, min(size, 10000))
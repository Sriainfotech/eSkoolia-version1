from rest_framework_simplejwt.authentication import JWTAuthentication

class QueryParamJWTAuthentication(JWTAuthentication):
    """
    Extends JWTAuthentication to also accept a JWT via ?token= query param.
    Used for CSV download endpoints opened via  where custom
    headers cannot be sent.
    """

    def authenticate(self, request):
        # Try standard Authorization header first
        result = super().authenticate(request)
        if result is not None:
            return result

        # Fallback: read token from query param (CSV downloads)
        raw_token = request.query_params.get("token")
        if not raw_token:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        return user, validated_token

import os
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

from apps.chat.routing import websocket_urlpatterns as chat_patterns
from apps.core.routing import websocket_urlpatterns as core_patterns

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

django_asgi_app = get_asgi_application()

# Combine all WebSocket URL patterns
all_websocket_patterns = chat_patterns + core_patterns

application = ProtocolTypeRouter(
	{
		"http": django_asgi_app,
		"websocket": AuthMiddlewareStack(URLRouter(all_websocket_patterns)),
	}
)

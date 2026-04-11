import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.cache import cache


class TrackingConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time bus tracking updates."""

    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope["user"]
        
        if not self.user.is_authenticated:
            await self.close()
            return

        # Add user to tracking group
        await self.channel_layer.group_add("bus_location_all", self.channel_name)
        await self.channel_layer.group_add("bus_alerts_all", self.channel_name)
        
        await self.accept()
        await self.send(
            text_data=json.dumps({
                "type": "connection_established",
                "message": "Connected to live tracking",
            })
        )

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        await self.channel_layer.group_discard("bus_location_all", self.channel_name)
        await self.channel_layer.group_discard("bus_alerts_all", self.channel_name)

    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(text_data)
            message_type = data.get("type")

            if message_type == "ping":
                await self.send(text_data=json.dumps({"type": "pong"}))
            elif message_type == "subscribe_vehicle":
                vehicle_id = data.get("vehicle_id")
                if vehicle_id:
                    group_name = f"bus_vehicle_{vehicle_id}"
                    await self.channel_layer.group_add(group_name, self.channel_name)
                    await self.send(
                        text_data=json.dumps({
                            "type": "subscription_confirmed",
                            "vehicle_id": vehicle_id,
                        })
                    )
        except json.JSONDecodeError:
            pass

    async def bus_location_update(self, event):
        """Handle bus location update messages from channel layer."""
        await self.send(
            text_data=json.dumps({
                "type": "bus_location_update",
                "location": event["location"],
            })
        )

    async def alert_message(self, event):
        """Handle alert messages from channel layer."""
        await self.send(
            text_data=json.dumps({
                "type": "alert_message",
                "alert": event["alert"],
            })
        )


class RouteBuilderConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for collaborative route building."""

    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope["user"]
        self.route_id = self.scope["url_route"]["kwargs"].get("route_id")

        if not self.user.is_authenticated:
            await self.close()
            return

        self.group_name = f"route_builder_{self.route_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send(
            text_data=json.dumps({
                "type": "connected",
                "route_id": self.route_id,
            })
        )

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle incoming messages."""
        try:
            data = json.loads(text_data)
            
            # Broadcast stop additions to all users editing this route
            if data.get("type") == "stop_added":
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "stop_update",
                        "stop": data.get("stop"),
                    }
                )
            elif data.get("type") == "stop_removed":
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "stop_update",
                        "stop": data.get("stop"),
                        "action": "removed",
                    }
                )
        except json.JSONDecodeError:
            pass

    async def stop_update(self, event):
        """Send stop update to connected clients."""
        await self.send(
            text_data=json.dumps({
                "type": "stop_update",
                "stop": event["stop"],
                "action": event.get("action", "added"),
            })
        )

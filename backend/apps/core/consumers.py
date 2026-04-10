import json
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone


class BusLocationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time bus location updates.
    
    Connection URL: ws://localhost:8000/ws/bus-tracking/location/
    Expected messages from client:
    {
        "action": "subscribe", 
        "route_id": 123,  # Optional - subscribe to specific route
        "vehicle_id": 456  # Optional - subscribe to specific vehicle
    }
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.route_id = None
        self.vehicle_id = None
        self.user = None

    async def connect(self):
        self.user = self.scope.get("user")
        self.is_authenticated = bool(self.user and self.user.is_authenticated)
        
        self.route_id = self.scope['url_route']['kwargs'].get('route_id')
        self.vehicle_id = self.scope['url_route']['kwargs'].get('vehicle_id')
        
        # Create a group name for this bus/route
        if self.vehicle_id:
            self.group_name = f"bus_location_vehicle_{self.vehicle_id}"
        elif self.route_id:
            self.group_name = f"bus_location_route_{self.route_id}"
        else:
            self.group_name = "bus_location_all"
        
        # Join the group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            action = data.get("action")
            
            if action == "update_location":
                if not self.is_authenticated:
                    await self.send(text_data=json.dumps({"error": "Authentication required for location updates"}))
                    return
                # Receive location update from mobile device
                await self.handle_location_update(data)
            elif action == "get_active_buses":
                # Request list of all active buses
                await self.send_active_buses()
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({"error": "Invalid JSON"}))
        except Exception as e:
            await self.send(text_data=json.dumps({"error": str(e)}))

    async def handle_location_update(self, data):
        """Handle incoming GPS location update"""
        vehicle_id = data.get("vehicle_id")
        latitude = Decimal(str(data.get("latitude", 0)))
        longitude = Decimal(str(data.get("longitude", 0)))
        speed = int(data.get("speed", 0))
        heading = int(data.get("heading", 0))
        accuracy = int(data.get("accuracy", 0))
        
        # Update/Create location in database
        location = await self.update_bus_location(vehicle_id, latitude, longitude, speed, heading, accuracy)
        
        # Check for alerts (stopped, near school, late)
        await self.check_and_create_alerts(vehicle_id, latitude, longitude, speed)
        
        # Broadcast to clients
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "bus_location_update",
                "vehicle_id": vehicle_id,
                "latitude": float(latitude),
                "longitude": float(longitude),
                "speed": speed,
                "heading": heading,
                "timestamp": timezone.now().isoformat(),
            }
        )

    async def send_active_buses(self):
        """Send list of all active buses on this route"""
        buses = await self.get_active_buses_on_route()
        await self.send(text_data=json.dumps({
            "type": "active_buses",
            "buses": buses
        }))

    @database_sync_to_async
    def update_bus_location(self, vehicle_id, latitude, longitude, speed, heading, accuracy):
        """Update or create bus location in database"""
        from apps.core.models import BusLocation
        
        location, created = BusLocation.objects.update_or_create(
            vehicle_id=vehicle_id,
            defaults={
                "latitude": latitude,
                "longitude": longitude,
                "speed": speed,
                "heading": heading,
                "accuracy": accuracy,
                "is_active": True,
            }
        )
        return location

    @database_sync_to_async
    def check_and_create_alerts(self, vehicle_id, latitude, longitude, speed):
        """Check for alert conditions and create alerts if needed"""
        from apps.core.models import Vehicle
        
        try:
            vehicle = Vehicle.objects.get(id=vehicle_id)
            
            # Check: Bus stopped for > 5 minutes
            self._check_stopped_alert(vehicle, latitude, longitude)
            
            # Check: Near school (hardcoded coordinates - should be configurable)
            self._check_near_school_alert(vehicle, latitude, longitude)
            
        except Vehicle.DoesNotExist:
            pass

    def _check_stopped_alert(self, vehicle, current_lat, current_lon):
        """Check if bus is stopped (speed=0) for > 5 minutes"""
        from apps.core.models import BusLocation, TransportAlert
        
        # Get location from 5 minutes ago
        five_min_ago = timezone.now() - timedelta(minutes=5)
        old_location = BusLocation.objects.filter(
            vehicle=vehicle,
            timestamp__lte=five_min_ago
        ).order_by("-timestamp").first()
        
        if old_location and old_location.speed == 0:
            # Bus has been stopped for > 5 min
            existing_alert = TransportAlert.objects.filter(
                vehicle=vehicle,
                alert_type="stopped",
                is_resolved=False
            ).exists()
            
            if not existing_alert:
                TransportAlert.objects.create(
                    vehicle=vehicle,
                    alert_type="stopped",
                    message=f"{vehicle.vehicle_no} has been stopped for more than 5 minutes",
                    severity="warning",
                    latitude=current_lat,
                    longitude=current_lon,
                )

    def _check_near_school_alert(self, vehicle, latitude, longitude):
        """Check if bus is near school (1km radius from school coordinates)"""
        from apps.core.models import TransportAlert
        
        # School coordinates (should be fetched from settings)
        SCHOOL_LAT = Decimal("27.1088")
        SCHOOL_LON = Decimal("85.3194")
        NEAR_SCHOOL_RADIUS_KM = 1
        
        # Calculate distance (simplified - use Haversine for production)
        distance = abs(float(latitude) - float(SCHOOL_LAT)) + abs(float(longitude) - float(SCHOOL_LON))
        
        if distance < 0.01:  # Rough approximation for 1km
            existing_alert = TransportAlert.objects.filter(
                vehicle=vehicle,
                alert_type="near_school",
                is_resolved=False,
                created_at__gte=timezone.now() - timedelta(minutes=30)
            ).exists()
            
            if not existing_alert:
                TransportAlert.objects.create(
                    vehicle=vehicle,
                    alert_type="near_school",
                    message=f"{vehicle.vehicle_no} is approaching the school",
                    severity="info",
                    latitude=latitude,
                    longitude=longitude,
                )

    @database_sync_to_async
    def get_active_buses_on_route(self):
        """Get all active buses with their current locations"""
        from apps.core.models import BusLocation
        
        locations = BusLocation.objects.filter(
            is_active=True,
            vehicle__active_status=True
        ).select_related("vehicle").order_by("-timestamp")[:100]
        
        return [
            {
                "id": loc.vehicle.id,
                "vehicle_no": loc.vehicle.vehicle_no,
                "latitude": float(loc.latitude),
                "longitude": float(loc.longitude),
                "speed": loc.speed,
                "heading": loc.heading,
                "timestamp": loc.timestamp.isoformat(),
            }
            for loc in locations
        ]

    # Group message handlers
    async def bus_location_update(self, event):
        """Handle bus_location_update message from channel layer"""
        if event.get("location"):
            await self.send(text_data=json.dumps({
                "type": "bus_location_update",
                "location": event["location"],
            }))
            return

        await self.send(text_data=json.dumps({
            "type": "bus_location_update",
            "vehicle_id": event["vehicle_id"],
            "latitude": event["latitude"],
            "longitude": event["longitude"],
            "speed": event["speed"],
            "heading": event["heading"],
            "timestamp": event["timestamp"],
        }))

    async def bus_alert_generated(self, event):
        """Handle bus_alert_generated message from channel layer"""
        await self.send(text_data=json.dumps({
            "type": "bus_alert",
            "alert": {
                "vehicle": event["vehicle_id"],
                "alert_type": event["alert_type"],
                "message": event["message"],
                "severity": event["severity"],
                "created_at": timezone.now().isoformat(),
            },
        }))


class BusAlertConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time transport alerts.
    
    Connection URL: ws://localhost:8000/ws/bus-alerts/
    Sends alerts whenever a bus generates one.
    """
    
    async def connect(self):
        self.user = self.scope.get("user")
        self.is_authenticated = bool(self.user and self.user.is_authenticated)
        
        self.group_name = "bus_alerts_all"
        
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def alert_message(self, event):
        """Handle alert message from channel layer"""
        if event.get("alert"):
            await self.send(text_data=json.dumps({
                "type": "bus_alert",
                "alert": event["alert"],
            }))
            return

        await self.send(text_data=json.dumps({
            "type": "bus_alert",
            "alert": {
                "vehicle": event.get("vehicle_id"),
                "alert_type": event["alert_type"],
                "message": event["message"],
                "severity": event["severity"],
                "created_at": event.get("timestamp") or timezone.now().isoformat(),
            },
        }))

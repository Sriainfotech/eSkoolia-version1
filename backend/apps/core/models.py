import re

from django.db import models
from decimal import Decimal


class AcademicYear(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="academic_years")
    name = models.CharField(max_length=64, help_text="e.g. 2025-2026")
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "academic_years"
        ordering = ["-start_date"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_academic_year_school_name"),
        ]

    def save(self, *args, **kwargs):
        if self.is_current:
            AcademicYear.objects.filter(school=self.school, is_current=True).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Class(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="classes")
    name = models.CharField(max_length=64, help_text="e.g. Grade 1, Class 10")
    numeric_order = models.PositiveSmallIntegerField(default=0, help_text="For sorting")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "school_classes"
        ordering = ["numeric_order", "name", "id"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_class_school_name"),
        ]

    @staticmethod
    def resolve_numeric_order(name):
        cleaned = (name or "").strip().upper()
        if cleaned == "LKG":
            return 1
        if cleaned == "UKG":
            return 2

        match = re.search(r"(?<!\d)(1[0-2]|[1-9])(?!\d)", cleaned)
        if match:
            return int(match.group(1)) + 2

        return 1000

    def save(self, *args, **kwargs):
        if not self.numeric_order:
            self.numeric_order = self.resolve_numeric_order(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Section(models.Model):
    school_class = models.ForeignKey(Class, on_delete=models.CASCADE, related_name="sections")
    name = models.CharField(max_length=32, help_text="e.g. A, B, Red")
    capacity = models.PositiveSmallIntegerField(default=40)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "class_sections"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["school_class", "name"], name="uq_section_class_name"),
        ]

    def __str__(self):
        return f"{self.school_class.name} - {self.name}"


class Subject(models.Model):
    SUBJECT_TYPE_CHOICES = [
        ("compulsory", "Compulsory"),
        ("elective", "Elective"),
        ("optional", "Optional"),
    ]
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="subjects")
    name = models.CharField(max_length=128)
    code = models.CharField(max_length=32, blank=True)
    subject_type = models.CharField(max_length=16, choices=SUBJECT_TYPE_CHOICES, default="compulsory")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "subjects"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_subject_school_name"),
        ]

    def __str__(self):
        return self.name


class ClassPeriod(models.Model):
    PERIOD_TYPE_CHOICES = [
        ("class", "Class"),
        ("exam", "Exam"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="class_periods")
    period = models.CharField(max_length=100)
    start_time = models.TimeField()
    end_time = models.TimeField()
    period_type = models.CharField(max_length=10, choices=PERIOD_TYPE_CHOICES, default="class")
    is_break = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "class_periods"
        ordering = ["start_time", "period"]
        constraints = [
            models.UniqueConstraint(fields=["school", "period", "period_type"], name="uq_class_period_school_name_type"),
        ]

    def __str__(self):
        return self.period


class ClassRoom(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="class_rooms")
    room_no = models.CharField(max_length=50)
    capacity = models.PositiveIntegerField(null=True, blank=True)
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "class_rooms"
        ordering = ["room_no"]
        constraints = [
            models.UniqueConstraint(fields=["school", "room_no"], name="uq_class_room_school_room_no"),
        ]

    def __str__(self):
        return self.room_no


# ===== TRANSPORT MODULE =====
class Vehicle(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="vehicles")
    academic_year = models.ForeignKey("AcademicYear", on_delete=models.CASCADE, related_name="vehicles")
    vehicle_no = models.CharField(max_length=255)
    vehicle_model = models.CharField(max_length=255)
    made_year = models.IntegerField(null=True, blank=True)
    note = models.TextField(blank=True)
    driver = models.ForeignKey("hr.Staff", on_delete=models.SET_NULL, null=True, blank=True, related_name="vehicles")
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "vehicles"
        ordering = ["vehicle_no"]
        constraints = [
            models.UniqueConstraint(fields=["school", "vehicle_no"], name="uq_vehicle_school_no"),
        ]

    def __str__(self):
        return self.vehicle_no


class TransportRoute(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="transport_routes")
    academic_year = models.ForeignKey("AcademicYear", on_delete=models.CASCADE, related_name="transport_routes")
    title = models.CharField(max_length=200)
    fare = models.DecimalField(max_digits=10, decimal_places=2)
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transport_routes"
        ordering = ["title"]
        constraints = [
            models.UniqueConstraint(fields=["school", "title"], name="uq_transport_route_school_title"),
        ]

    def __str__(self):
        return self.title


class AssignVehicle(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="assign_vehicles")
    academic_year = models.ForeignKey("AcademicYear", on_delete=models.CASCADE, related_name="assign_vehicles")
    vehicle = models.ForeignKey("Vehicle", on_delete=models.CASCADE, related_name="assignments")
    route = models.ForeignKey("TransportRoute", on_delete=models.CASCADE, related_name="assignments")
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "assign_vehicles"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["school", "vehicle", "route"], name="uq_assign_vehicle_school_vehicle_route"),
        ]

    def __str__(self):
        return f"{self.vehicle.vehicle_no} - {self.route.title}"


# ===== BUS TRACKING MODULE =====
class BusStop(models.Model):
    """Represents a stop on a transport route (school, neighborhood pickup points, etc.)"""
    STOP_TYPE_CHOICES = [
        ("start", "Start"),
        ("middle", "Middle"),
        ("end", "End"),
    ]

    route = models.ForeignKey("TransportRoute", on_delete=models.CASCADE, related_name="stops")
    stop_name = models.CharField(max_length=200)  # e.g., "Madhya Pur", "School"
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    stop_order = models.IntegerField()  # 1, 2, 3... (sequence on route)
    stop_type = models.CharField(max_length=10, choices=STOP_TYPE_CHOICES, default="middle")
    scheduled_time = models.TimeField(null=True, blank=True)
    geofence_radius = models.IntegerField(default=100, help_text="Geofence radius in meters")
    arrival_time_window = models.CharField(max_length=50, blank=True, help_text="Expected arrival time e.g., '09:30-09:45'")
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "bus_stops"
        ordering = ["route_id", "stop_order"]
        constraints = [
            models.UniqueConstraint(fields=["route", "stop_name"], name="uq_bus_stop_route_name"),
        ]

    def __str__(self):
        return f"{self.route.title} - {self.stop_name}"


class BusLocation(models.Model):
    """Real-time GPS location data for a vehicle"""
    vehicle = models.ForeignKey("Vehicle", on_delete=models.CASCADE, related_name="bus_locations")
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    speed = models.IntegerField(default=0, help_text="Speed in km/h")
    heading = models.IntegerField(default=0, help_text="Direction in degrees (0-360)")
    accuracy = models.IntegerField(default=0, help_text="GPS accuracy in meters")
    timestamp = models.DateTimeField(auto_now=True)  # Updated every location push
    is_active = models.BooleanField(default=True)  # False if vehicle is offline

    class Meta:
        db_table = "bus_locations"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.vehicle.vehicle_no} @ {self.latitude},{self.longitude}"


class TransportAlert(models.Model):
    """Alerts generated for bus status changes (stopped, late, near school)"""
    ALERT_TYPE_CHOICES = [
        ("stopped", "Bus Stopped >5 min"),
        ("running_late", "Running Late"),
        ("near_school", "Near School (<1km)"),
        ("arrived", "Arrived at Destination"),
        ("left", "Left Departure Point"),
        ("mechanical", "Mechanical Issue"),
        ("traffic", "Heavy Traffic Detected"),
    ]

    vehicle = models.ForeignKey("Vehicle", on_delete=models.CASCADE, related_name="bus_alerts")
    route = models.ForeignKey("TransportRoute", on_delete=models.SET_NULL, null=True, blank=True, related_name="bus_alerts")
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPE_CHOICES)
    message = models.TextField()
    severity = models.CharField(max_length=10, choices=[("info", "Info"), ("warning", "Warning"), ("critical", "Critical")], default="info")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "transport_alerts"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.vehicle.vehicle_no} - {self.alert_type} ({self.severity})"


class BusRoutePickupUpdate(models.Model):
    """Tracks pickup updates: when bus reaches a stop, marks students as picked up"""
    stop = models.ForeignKey("BusStop", on_delete=models.CASCADE, related_name="pickups")
    vehicle = models.ForeignKey("Vehicle", on_delete=models.CASCADE, related_name="stop_pickups")
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="bus_pickups")
    arrived_at = models.DateTimeField()
    picked_up_at = models.DateTimeField(null=True, blank=True)  # When student actually boarded
    status_choices = [
        ("waiting", "Waiting for Bus"),
        ("arrived", "Bus Arrived at Stop"),
        ("picked_up", "Student Picked Up"),
        ("missed", "Student Missed Bus"),
    ]
    status = models.CharField(max_length=20, choices=status_choices, default="waiting")

    class Meta:
        db_table = "bus_route_pickup_updates"
        ordering = ["-arrived_at"]

    def __str__(self):
        return f"{self.student} - {self.stop.stop_name} ({self.status})"


# ===== INVENTORY MODULE =====
class ItemCategory(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="item_categories")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "item_categories"
        ordering = ["title"]
        constraints = [
            models.UniqueConstraint(fields=["school", "title"], name="uq_item_category_school_title"),
        ]

    def __str__(self):
        return self.title


class ItemStore(models.Model):
    """Storage locations/warehouses"""
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="item_stores")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "item_stores"
        ordering = ["title"]
        constraints = [
            models.UniqueConstraint(fields=["school", "title"], name="uq_item_store_school_title"),
        ]

    def __str__(self):
        return self.title


class Supplier(models.Model):
    """Vendors/Suppliers"""
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="suppliers")
    name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    tax_id = models.CharField(max_length=50, blank=True)
    payment_terms = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "suppliers"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_supplier_school_name"),
        ]

    def __str__(self):
        return self.name


class Item(models.Model):
    """Inventory items with stock tracking"""
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="inventory_items")
    category = models.ForeignKey(ItemCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="items")
    item_code = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    unit = models.CharField(max_length=50, default="piece")
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reorder_level = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name="items")
    item_photo = models.CharField(max_length=300, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "items"
        ordering = ["item_code", "name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "item_code"], name="uq_item_school_code"),
        ]

    def __str__(self):
        return f"{self.item_code} - {self.name}"


class ItemReceive(models.Model):
    """Purchase/Receive transactions"""
    PAYMENT_STATUS_PAID = "P"
    PAYMENT_STATUS_UNPAID = "U"
    PAYMENT_STATUS_PARTIAL = "PP"
    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_STATUS_PAID, "Paid"),
        (PAYMENT_STATUS_UNPAID, "Unpaid"),
        (PAYMENT_STATUS_PARTIAL, "Partially Paid"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="item_receives")
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="receives")
    receive_date = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    payment_status = models.CharField(max_length=2, choices=PAYMENT_STATUS_CHOICES, default=PAYMENT_STATUS_UNPAID)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    reference_no = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="item_receives_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "item_receives"
        ordering = ["-receive_date", "-created_at"]

    def __str__(self):
        return f"Receive {self.id} - {self.supplier.name}"


class ItemReceiveChild(models.Model):
    """Line items for purchase transactions"""
    receive = models.ForeignKey(ItemReceive, on_delete=models.CASCADE, related_name="line_items")
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        db_table = "item_receive_children"

    def save(self, *args, **kwargs):
        self.total_cost = self.quantity * self.unit_cost
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.receive.id} - {self.item.name}"


class ItemIssue(models.Model):
    """Item distribution/allocation"""
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="item_issues")
    issue_date = models.DateField()
    store = models.ForeignKey(ItemStore, on_delete=models.SET_NULL, null=True, blank=True)
    subject = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    issued_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="item_issues_issued")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "item_issues"
        ordering = ["-issue_date"]

    def __str__(self):
        return f"Issue {self.id}"


class ItemSell(models.Model):
    """Sales/Distribution transactions"""
    PAYMENT_STATUS_PAID = "P"
    PAYMENT_STATUS_UNPAID = "U"
    PAYMENT_STATUS_PARTIAL = "PP"
    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_STATUS_PAID, "Paid"),
        (PAYMENT_STATUS_UNPAID, "Unpaid"),
        (PAYMENT_STATUS_PARTIAL, "Partially Paid"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="item_sells")
    sell_date = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    payment_status = models.CharField(max_length=2, choices=PAYMENT_STATUS_CHOICES, default=PAYMENT_STATUS_UNPAID)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    reference_no = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    sold_to = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="item_sells_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "item_sells"
        ordering = ["-sell_date", "-created_at"]

    def __str__(self):
        return f"Sell {self.id}"


class ItemSellChild(models.Model):
    """Line items for sales transactions"""
    sell = models.ForeignKey(ItemSell, on_delete=models.CASCADE, related_name="line_items")
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        db_table = "item_sell_children"

    def save(self, *args, **kwargs):
        self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.sell.id} - {self.item.name}"

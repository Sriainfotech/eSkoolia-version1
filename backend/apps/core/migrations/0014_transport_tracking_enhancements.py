from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0013_busstop_route_builder_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="vehicle",
            name="current_latitude",
            field=models.DecimalField(blank=True, decimal_places=6, help_text="Current GPS latitude", max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="vehicle",
            name="current_longitude",
            field=models.DecimalField(blank=True, decimal_places=6, help_text="Current GPS longitude", max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="vehicle",
            name="current_speed",
            field=models.IntegerField(default=0, help_text="Current speed in km/h"),
        ),
        migrations.AddField(
            model_name="vehicle",
            name="is_tracking_active",
            field=models.BooleanField(default=False, help_text="Whether live GPS tracking is active"),
        ),
        migrations.AddField(
            model_name="vehicle",
            name="last_location_update",
            field=models.DateTimeField(blank=True, help_text="Last GPS update timestamp", null=True),
        ),
        migrations.AddField(
            model_name="vehicle",
            name="next_stop",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="buses_heading_to", to="core.busstop"),
        ),
        migrations.AddField(
            model_name="vehicle",
            name="status",
            field=models.CharField(
                choices=[
                    ("idle", "Idle"),
                    ("approaching_stop", "Approaching Stop"),
                    ("at_stop", "At Stop"),
                    ("in_transit", "In Transit"),
                    ("offline", "Offline"),
                ],
                default="idle",
                help_text="Current vehicle status",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="VehicleDriverAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("assigned_from", models.DateField(blank=True, null=True)),
                ("assigned_to", models.DateField(blank=True, null=True)),
                ("is_primary", models.BooleanField(default=False)),
                ("active_status", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("driver", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="vehicle_assignments", to="hr.staff")),
                ("vehicle", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="driver_assignments", to="core.vehicle")),
            ],
            options={
                "db_table": "vehicle_driver_assignments",
                "ordering": ["-is_primary", "-created_at"],
            },
        ),
        migrations.CreateModel(
            name="TransportNotificationLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("channel", models.CharField(choices=[("sms", "SMS"), ("email", "Email")], max_length=10)),
                ("provider", models.CharField(blank=True, max_length=30)),
                ("recipient", models.CharField(max_length=120)),
                ("message", models.TextField()),
                ("status", models.CharField(choices=[("sent", "Sent"), ("failed", "Failed"), ("skipped", "Skipped")], default="skipped", max_length=10)),
                ("error_message", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("student", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="transport_notifications", to="students.student")),
                ("vehicle", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notification_logs", to="core.vehicle")),
            ],
            options={
                "db_table": "transport_notification_logs",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="RoutePerformanceLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("log_date", models.DateField()),
                ("total_distance_km", models.DecimalField(decimal_places=3, default=Decimal("0.000"), max_digits=10)),
                ("avg_speed_kmh", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=7)),
                ("delay_minutes", models.IntegerField(default=0)),
                ("completed_stops", models.PositiveIntegerField(default=0)),
                ("total_stops", models.PositiveIntegerField(default=0)),
                ("completed", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("route", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="performance_logs", to="core.transportroute")),
                ("vehicle", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="performance_logs", to="core.vehicle")),
            ],
            options={
                "db_table": "route_performance_logs",
                "ordering": ["-log_date", "-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="vehicledriverassignment",
            constraint=models.UniqueConstraint(fields=("vehicle", "driver"), name="uq_vehicle_driver_pair"),
        ),
        migrations.AddConstraint(
            model_name="routeperformancelog",
            constraint=models.UniqueConstraint(fields=("route", "vehicle", "log_date"), name="uq_route_vehicle_date_log"),
        ),
    ]

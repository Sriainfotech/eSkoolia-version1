from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0012_bus_tracking_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="busstop",
            name="geofence_radius",
            field=models.IntegerField(default=100, help_text="Geofence radius in meters"),
        ),
        migrations.AddField(
            model_name="busstop",
            name="scheduled_time",
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="busstop",
            name="stop_type",
            field=models.CharField(
                choices=[("start", "Start"), ("middle", "Middle"), ("end", "End")],
                default="middle",
                max_length=10,
            ),
        ),
    ]

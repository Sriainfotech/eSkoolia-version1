# Generated migration for bus tracking models

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0011_alter_class_options'),
        ('students', '0008_studentsubjectassignment'),
    ]

    operations = [
        migrations.CreateModel(
            name='BusStop',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('stop_name', models.CharField(max_length=200)),
                ('latitude', models.DecimalField(decimal_places=6, max_digits=9)),
                ('longitude', models.DecimalField(decimal_places=6, max_digits=9)),
                ('stop_order', models.IntegerField()),
                ('arrival_time_window', models.CharField(blank=True, help_text="Expected arrival time e.g., '09:30-09:45'", max_length=50)),
                ('active_status', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('route', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stops', to='core.transportroute')),
            ],
            options={
                'db_table': 'bus_stops',
                'ordering': ['route_id', 'stop_order'],
            },
        ),
        migrations.CreateModel(
            name='BusLocation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('latitude', models.DecimalField(decimal_places=6, max_digits=9)),
                ('longitude', models.DecimalField(decimal_places=6, max_digits=9)),
                ('speed', models.IntegerField(default=0, help_text='Speed in km/h')),
                ('heading', models.IntegerField(default=0, help_text='Direction in degrees (0-360)')),
                ('accuracy', models.IntegerField(default=0, help_text='GPS accuracy in meters')),
                ('timestamp', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('vehicle', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bus_locations', to='core.vehicle')),
            ],
            options={
                'db_table': 'bus_locations',
                'ordering': ['-timestamp'],
            },
        ),
        migrations.CreateModel(
            name='TransportAlert',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('alert_type', models.CharField(choices=[('stopped', 'Bus Stopped >5 min'), ('running_late', 'Running Late'), ('near_school', 'Near School (<1km)'), ('arrived', 'Arrived at Destination'), ('left', 'Left Departure Point'), ('mechanical', 'Mechanical Issue'), ('traffic', 'Heavy Traffic Detected')], max_length=20)),
                ('message', models.TextField()),
                ('severity', models.CharField(choices=[('info', 'Info'), ('warning', 'Warning'), ('critical', 'Critical')], default='info', max_length=10)),
                ('latitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('longitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('is_resolved', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('route', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bus_alerts', to='core.transportroute')),
                ('vehicle', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bus_alerts', to='core.vehicle')),
            ],
            options={
                'db_table': 'transport_alerts',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='BusRoutePickupUpdate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('arrived_at', models.DateTimeField()),
                ('picked_up_at', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(choices=[('waiting', 'Waiting for Bus'), ('arrived', 'Bus Arrived at Stop'), ('picked_up', 'Student Picked Up'), ('missed', 'Student Missed Bus')], default='waiting', max_length=20)),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bus_pickups', to='students.student')),
                ('stop', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pickups', to='core.busstop')),
                ('vehicle', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stop_pickups', to='core.vehicle')),
            ],
            options={
                'db_table': 'bus_route_pickup_updates',
                'ordering': ['-arrived_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='busstop',
            constraint=models.UniqueConstraint(fields=['route', 'stop_name'], name='uq_bus_stop_route_name'),
        ),
    ]

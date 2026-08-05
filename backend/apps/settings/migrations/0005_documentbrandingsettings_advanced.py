from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("settings", "0004_documentbrandingsettings"),
    ]

    operations = [
        # --- accent color & layout controls ---
        migrations.AddField(
            model_name="documentbrandingsettings",
            name="accent_color",
            field=models.CharField(
                default="#1A1A2E",
                help_text="Hex color for borders and divider lines.",
                max_length=7,
            ),
        ),
        migrations.AddField(
            model_name="documentbrandingsettings",
            name="header_size",
            field=models.CharField(
                choices=[("compact", "Compact"), ("standard", "Standard"), ("tall", "Tall")],
                default="standard",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="documentbrandingsettings",
            name="logo_position",
            field=models.CharField(
                choices=[("left", "Left"), ("center", "Center"), ("right", "Right")],
                default="center",
                max_length=8,
            ),
        ),
        # --- divider ---
        migrations.AddField(
            model_name="documentbrandingsettings",
            name="show_divider",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="documentbrandingsettings",
            name="divider_style",
            field=models.CharField(
                choices=[
                    ("none", "None"),
                    ("solid", "Solid"),
                    ("double", "Double Line"),
                    ("dashed", "Dashed"),
                    ("thick_rule", "Thick Rule"),
                ],
                default="solid",
                max_length=16,
            ),
        ),
        # --- watermark ---
        migrations.AddField(
            model_name="documentbrandingsettings",
            name="show_watermark",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="documentbrandingsettings",
            name="watermark_text",
            field=models.CharField(
                blank=True,
                help_text="Diagonal watermark text on the header. Defaults to the school name when blank.",
                max_length=80,
            ),
        ),
        # --- new declaration fields ---
        migrations.AddField(
            model_name="documentbrandingsettings",
            name="declaration_fee_receipt",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="documentbrandingsettings",
            name="declaration_transfer_certificate",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="documentbrandingsettings",
            name="declaration_admission",
            field=models.TextField(blank=True),
        ),
        # --- expand header_style choices to include 3 new styles ---
        migrations.AlterField(
            model_name="documentbrandingsettings",
            name="header_style",
            field=models.CharField(
                choices=[
                    ("classic", "Classic"),
                    ("modern", "Modern"),
                    ("minimal", "Minimal"),
                    ("executive", "Executive"),
                    ("letterpress", "Letterpress"),
                    ("banner", "Banner"),
                ],
                default="classic",
                max_length=16,
            ),
        ),
    ]

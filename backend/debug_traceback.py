import os
import sys
import django
from dotenv import load_dotenv

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Load dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()

from apps.fees.models import FeeAssignment
from apps.fees.serializers import FeeAssignmentSerializer
from django.contrib.auth import get_user_model

User = get_user_model()
try:
    user = User.objects.first()
    print("User:", user)
    assignments = FeeAssignment.objects.filter(academic_year__school=user.school)
    print("Found assignments count:", assignments.count())
    serializer = FeeAssignmentSerializer(assignments, many=True)
    # Trigger serialization
    data = serializer.data
    print("Serialization success! Data count:", len(data))
except Exception as e:
    import traceback
    traceback.print_exc()

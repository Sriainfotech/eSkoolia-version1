from datetime import date
import re

from django import forms

from .models import Student


class StudentValidationModelForm(forms.ModelForm):
    CLASS_NAME_INVALID = {"abc", "adc", "asdf", "test", "demo"}

    class Meta:
        model = Student
        fields = [
            "admission_no",
            "roll_no",
            "first_name",
            "last_name",
            "date_of_birth",
            "academic_year",
            "gender",
            "custom_gender",
            "phone",
            "email",
            "address_line",
            "city",
            "district",
            "state",
            "pincode",
            "status",
            "category",
            "guardian",
            "current_class",
            "current_section",
            "is_disabled",
            "is_active",
        ]

    def __init__(self, *args, **kwargs):
        self.partial = kwargs.pop("partial", False)
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)

        if self.partial:
            for field_name, field in self.fields.items():
                if field_name not in self.data:
                    field.required = False

    def _is_missing_in_partial(self, field_name):
        return self.partial and field_name not in self.data

    def clean_admission_no(self):
        if self._is_missing_in_partial("admission_no"):
            return getattr(self.instance, "admission_no", "")
        admission_no = str(self.cleaned_data.get("admission_no") or "").strip()
        if not admission_no:
            raise forms.ValidationError("Admission number is required")
        if not re.fullmatch(r"[A-Za-z0-9]+", admission_no):
            raise forms.ValidationError("Admission number should contain only letters and numbers")
        return admission_no

    def clean_roll_no(self):
        roll_no = str(self.cleaned_data.get("roll_no") or "").strip()
        if not roll_no:
            return ""
        if not re.fullmatch(r"\d+", roll_no):
            raise forms.ValidationError("Roll number must contain numbers only")
        return roll_no

    def clean_first_name(self):
        if self._is_missing_in_partial("first_name"):
            return getattr(self.instance, "first_name", "")
        first_name = str(self.cleaned_data.get("first_name") or "").strip()
        if not first_name:
            raise forms.ValidationError("First name is required")
        if not re.fullmatch(r"[A-Za-z\s'-]+", first_name):
            raise forms.ValidationError("First name can contain only letters, spaces, apostrophe, and hyphen")
        return first_name

    def clean_last_name(self):
        last_name = str(self.cleaned_data.get("last_name") or "").strip()
        if not last_name:
            return ""
        if not re.fullmatch(r"[A-Za-z\s'-]+", last_name):
            raise forms.ValidationError("Last name can contain only letters, spaces, apostrophe, and hyphen")
        return last_name

    def clean_date_of_birth(self):
        if self._is_missing_in_partial("date_of_birth"):
            return getattr(self.instance, "date_of_birth", None)
        dob = self.cleaned_data.get("date_of_birth")
        if dob and dob > date.today():
            raise forms.ValidationError("Date of birth cannot be in the future")
        return dob

    def clean_phone(self):
        if self._is_missing_in_partial("phone"):
            return getattr(self.instance, "phone", "")
        phone = str(self.cleaned_data.get("phone") or "").strip()
        if not phone:
            raise forms.ValidationError("Phone number is required")
        if not re.fullmatch(r"\d{10}", phone):
            raise forms.ValidationError("Phone number must be exactly 10 digits")
        return phone

    def clean_pincode(self):
        pincode = str(self.cleaned_data.get("pincode") or "").strip()
        if not pincode:
            return ""
        if not re.fullmatch(r"\d{6}", pincode):
            raise forms.ValidationError("Pincode must be exactly 6 digits")
        return pincode

    def clean_academic_year(self):
        if self._is_missing_in_partial("academic_year"):
            return getattr(self.instance, "academic_year", None)
        academic_year = self.cleaned_data.get("academic_year")
        if not academic_year:
            return academic_year

        year_name = str(getattr(academic_year, "name", "") or "").strip()
        if not re.fullmatch(r"\d{4}-\d{4}", year_name):
            raise forms.ValidationError("Please select a valid academic year")
        start_year, end_year = [int(part) for part in year_name.split("-")]
        if end_year != start_year + 1:
            raise forms.ValidationError("Academic year range is invalid")
        return academic_year

    def clean_current_class(self):
        if self._is_missing_in_partial("current_class"):
            return getattr(self.instance, "current_class", None)
        current_class = self.cleaned_data.get("current_class")
        if not current_class:
            return current_class

        class_name = str(getattr(current_class, "name", "") or "").strip()
        lowered = class_name.lower()
        if not class_name or lowered in self.CLASS_NAME_INVALID:
            raise forms.ValidationError("Please select a valid class")
        return current_class

    def clean(self):
        cleaned_data = super().clean()
        current_class = cleaned_data.get("current_class")
        current_section = cleaned_data.get("current_section")

        if current_class and current_section and current_section.school_class_id != current_class.id:
            self.add_error("current_section", "Selected section does not belong to selected class")

        return cleaned_data

import re

from django import forms

from .models import ExamType


class ExamTypeModelForm(forms.ModelForm):
    class Meta:
        model = ExamType
        fields = ["title", "is_average", "average_mark"]

    def clean_exam_name(self, value: str) -> str:
        exam_name = (value or "").strip()
        if not exam_name:
            raise forms.ValidationError("Exam name is required.")

        if len(exam_name) >= 3 and re.fullmatch(r"(.)\1{2,}", exam_name):
            raise forms.ValidationError("Enter a meaningful exam name.")

        if re.fullmatch(r"[^A-Za-z0-9\s]+", exam_name):
            raise forms.ValidationError("Symbols-only names are not allowed.")

        return exam_name

    def clean_title(self):
        value = self.cleaned_data.get("title", "")
        return self.clean_exam_name(value)

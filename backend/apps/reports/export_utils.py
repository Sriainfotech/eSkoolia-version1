import csv
from io import BytesIO, StringIO
from typing import Iterable, Sequence

from django.http import HttpResponse

def _safe_cell(value):
    if value is None:
        return ""
    return value

def export_csv(rows: Iterable[dict], columns: Sequence[tuple[str, str]], filename: str) -> HttpResponse:
    stream = StringIO()
    writer = csv.writer(stream)
    writer.writerow([header for header, _ in columns])
    for row in rows:
        writer.writerow([_safe_cell(row.get(key)) for _, key in columns])

    response = HttpResponse(stream.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}.csv"'
    return response

def export_excel(rows: Iterable[dict], columns: Sequence[tuple[str, str]], filename: str) -> HttpResponse:
    try:
        from openpyxl import Workbook
    except ImportError as exc:
        raise RuntimeError("openpyxl is required for Excel export") from exc

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Report"
    sheet.append([header for header, _ in columns])

    for row in rows:
        sheet.append([_safe_cell(row.get(key)) for _, key in columns])

    output = BytesIO()
    workbook.save(output)
    output.seek(0)

    response = HttpResponse(
        output.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}.xlsx"'
    return response

def export_pdf(rows: Iterable[dict], columns: Sequence[tuple[str, str]], filename: str, title: str) -> HttpResponse:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError as exc:
        raise RuntimeError("reportlab is required for PDF export") from exc

    output = BytesIO()
    document = SimpleDocTemplate(output, pagesize=landscape(A4), title=title)
    styles = getSampleStyleSheet()

    table_rows = [[header for header, _ in columns]]
    for row in rows:
        table_rows.append([str(_safe_cell(row.get(key))) for _, key in columns])

    table = Table(table_rows, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    story = [Paragraph(title, styles["Heading2"]), Spacer(1, 12), table]
    
    output.seek(0)

    response = HttpResponse(output.getvalue(), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}.pdf"'
    return response

def build_export_response(
    export_format: str,
    rows: list[dict],
    columns: Sequence[tuple[str, str]],
    filename: str,
    title: str,
) -> HttpResponse:
    if export_format == "csv":
        return export_csv(rows, columns, filename)
    if export_format == "excel":
        return export_excel(rows, columns, filename)
    if export_format == "pdf":
        return export_pdf(rows, columns, filename, title)
    raise ValueError(f"Unsupported export format: {export_format}")

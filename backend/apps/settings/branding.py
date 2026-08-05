"""Renders the single header image every PDF/print feature in the ERP
fetches — student & staff verification forms, fee receipts, payslips, and
anything added later. This is the one place that knows how to build a
header; nothing else should duplicate this logic.

Two paths, chosen by DocumentBrandingSettings.header_mode:
  - "generated": composed live, on every call, from SchoolTenant identity
    fields plus this settings row's style/color. Deliberately never
    cached — see the "generated mode" comment on DocumentBrandingSettings
    for why a cached image here would be a staleness bug waiting to happen.
  - "uploaded": the PNG already rasterized once at upload time (see
    apps.settings.views.DocumentBrandingUploadLetterheadView) is read back
    as-is — safe to cache because a new upload is the only thing that can
    invalidate it, and that's exactly what regenerates it.

Six generated styles (all designed to look good in black-and-white print):
  classic     — centered logo, name, address stack
  modern      — left logo, right-aligned detail column
  minimal     — small left logo, single compact line
  executive   — logo + vertical separator + right text block
  letterpress — double-rule borders top/bottom, centered stack
  banner      — solid dark band header with white text, details below
"""
import io
import os

from django.conf import settings as django_settings
from PIL import Image, ImageDraw, ImageFont

HEADER_WIDTH = 1600

_SIZE_HEIGHTS = {
    "compact": 220,
    "standard": 300,
    "tall": 380,
}


# ---------------------------------------------------------------------------
# Font helpers
# ---------------------------------------------------------------------------

def _load_font(size, bold=False):
    """Best-effort TrueType font loading, falling back to PIL's built-in
    bitmap font so rendering never raises even on a minimal server image
    without common system fonts installed."""
    candidates = [
        "arialbd.ttf" if bold else "arial.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "LiberationSans-Bold.ttf" if bold else "LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    return ImageFont.load_default()


# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------

def _hex_to_rgb(hex_color: str):
    """Convert '#RRGGBB' to (R, G, B) ints. Returns a safe dark fallback on
    malformed input so rendering never crashes due to a bad settings value."""
    hex_color = (hex_color or "").lstrip("#")
    if len(hex_color) != 6:
        return (26, 26, 46)
    try:
        return (int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16))
    except ValueError:
        return (26, 26, 46)


# ---------------------------------------------------------------------------
# Logo helper
# ---------------------------------------------------------------------------

def _resolve_local_logo(logo_url):
    """Only load the logo if it resolves to a file already on this
    server's disk (i.e. was uploaded through this app). Deliberately does
    NOT fetch arbitrary external URLs from inside a server-side render —
    that would add a slow, unreliable, and security-sensitive network call
    (SSRF surface) to a path that needs to be fast and safe on every
    request. An external logo URL just renders as a text-only header
    instead of failing, hanging, or reaching out to an arbitrary host.
    """
    if not logo_url or "://" in logo_url:
        return None
    rel = logo_url.lstrip("/")
    if rel.startswith("media/"):
        rel = rel[len("media/"):]
    abs_path = os.path.join(django_settings.MEDIA_ROOT, rel)
    if not os.path.isfile(abs_path):
        return None
    try:
        return Image.open(abs_path).convert("RGBA")
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------

def _draw_centered(draw, cx, y, text, font, color):
    if not text:
        return
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    draw.text((cx - w // 2, y), text, font=font, fill=color)


def _draw_divider(draw, width: int, height: int, style: str, color_rgb: tuple) -> None:
    """Draw a bottom-edge decorative divider on the header image.

    Placed 14 px from the bottom so it sits cleanly inside the image bounds
    while still appearing as a 'closing rule' for the header area.
    """
    y = height - 14
    if style == "solid":
        draw.line([(0, y), (width, y)], fill=color_rgb, width=2)
    elif style == "double":
        draw.line([(0, y - 4), (width, y - 4)], fill=color_rgb, width=1)
        draw.line([(0, y + 2), (width, y + 2)], fill=color_rgb, width=2)
    elif style == "dashed":
        segment, gap, x = 50, 18, 0
        while x < width:
            draw.line([(x, y), (min(x + segment, width), y)], fill=color_rgb, width=2)
            x += segment + gap
    elif style == "thick_rule":
        draw.line([(0, y - 4), (width, y - 4)], fill=color_rgb, width=5)
        draw.line([(0, y + 3), (width, y + 3)], fill=color_rgb, width=1)
    # "none" → draw nothing


def _add_watermark(img: Image.Image, text: str, color_hex: str) -> Image.Image:
    """Composite a faint diagonal watermark over the header image.

    Uses 22/255 alpha so it is subtle on screen but still catches the eye on
    a B&W printout — the slight contrast difference survives grayscale output
    without making the header feel 'busy'.
    """
    r, g, b = _hex_to_rgb(color_hex)
    wm_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    wm_draw = ImageDraw.Draw(wm_layer)
    wm_font = _load_font(160, bold=True)
    bbox = wm_draw.textbbox((0, 0), text, font=wm_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (img.width - tw) // 2
    y = (img.height - th) // 2
    wm_draw.text((x, y), text, font=wm_font, fill=(r, g, b, 22))
    rotated = wm_layer.rotate(-25, resample=Image.BICUBIC, expand=False)
    base = img.convert("RGBA")
    composited = Image.alpha_composite(base, rotated)
    return composited.convert("RGB")


# ---------------------------------------------------------------------------
# Style renderers (private)
# ---------------------------------------------------------------------------

def _render_classic(draw, img, name, motto, address, contact, logo, color, name_font, sub_font, small_font, height, logo_pos):
    cx = HEADER_WIDTH // 2
    y = 18
    if logo:
        if logo_pos == "left":
            img.paste(logo, (30, (height - logo.height) // 2), logo)
            cx = (30 + logo.width + HEADER_WIDTH) // 2
        elif logo_pos == "right":
            img.paste(logo, (HEADER_WIDTH - logo.width - 30, (height - logo.height) // 2), logo)
            cx = (HEADER_WIDTH - logo.width - 30) // 2
        else:  # center
            img.paste(logo, (cx - logo.width // 2, y), logo)
            y += logo.height + 8
    _draw_centered(draw, cx, y, name, name_font, color)
    y += 62
    if motto:
        _draw_centered(draw, cx, y, motto, sub_font, color)
        y += 36
    if address:
        _draw_centered(draw, cx, y, address, small_font, color)
        y += 28
    if contact:
        _draw_centered(draw, cx, y, contact, small_font, color)


def _render_modern(draw, img, name, motto, address, contact, affiliation, logo, color, name_font, sub_font, small_font, height):
    x = 50
    if logo:
        img.paste(logo, (x, (height - logo.height) // 2), logo)
        x += logo.width + 50
    draw.text((x, 46), name, font=name_font, fill=color)
    y = 46 + 70
    if motto:
        draw.text((x, y), motto, font=sub_font, fill=color)
        y += 38
    if address:
        draw.text((x, y), address, font=small_font, fill=color)
        y += 30
    if contact:
        draw.text((x, y), contact, font=small_font, fill=color)
        y += 30
    if affiliation:
        draw.text((x, y), f"Affiliation No: {affiliation}", font=small_font, fill=color)


def _render_minimal(draw, img, name, address, contact, logo, color, name_font, small_font, height):
    x = 40
    if logo:
        img.paste(logo, (x, (height - logo.height) // 2), logo)
        x += logo.width + 30
    draw.text((x, max(20, height // 2 - 50)), name, font=name_font, fill=color)
    line2 = "  ·  ".join(p for p in [address, contact] if p)
    draw.text((x, max(20, height // 2 - 50) + 68), line2, font=small_font, fill=color)


def _render_executive(draw, img, name, motto, address, contact, affiliation, logo, color, color_rgb, accent_rgb, name_font, sub_font, small_font, height):
    """Left logo → thick vertical separator → right-aligned text block.
    Inspired by executive/corporate letterhead. Crisp B&W contrast."""
    x = 40
    if logo:
        img.paste(logo, (x, (height - logo.height) // 2), logo)
        x += logo.width + 28
    # Vertical rule
    sep_x = x + 8
    draw.rectangle([(sep_x, 24), (sep_x + 3, height - 24)], fill=accent_rgb)
    x = sep_x + 22
    # School name — large and bold
    draw.text((x, 36), name, font=name_font, fill=color)
    y = 36 + 70
    if motto:
        draw.text((x, y), motto, font=sub_font, fill=color)
        y += 36
    if address:
        draw.text((x, y), address, font=small_font, fill=color)
        y += 28
    if contact:
        draw.text((x, y), contact, font=small_font, fill=color)
        y += 28
    if affiliation:
        draw.text((x, y), f"Affiliation: {affiliation}", font=small_font, fill=color)


def _render_letterpress(draw, img, name, motto, address, contact, affiliation, logo, color, color_rgb, name_font, sub_font, small_font, height):
    """Double-rule top and bottom borders, centered stack.
    Evokes the classic letterpress aesthetic — prints beautifully in B&W."""
    margin = 40
    # Top double line: thick outer, thin inner
    draw.line([(margin, 10), (HEADER_WIDTH - margin, 10)], fill=color_rgb, width=3)
    draw.line([(margin, 17), (HEADER_WIDTH - margin, 17)], fill=color_rgb, width=1)

    cx = HEADER_WIDTH // 2
    y = 28
    if logo:
        img.paste(logo, (cx - logo.width // 2, y), logo)
        y += logo.height + 10
    _draw_centered(draw, cx, y, name, name_font, color)
    y += 62
    if motto:
        _draw_centered(draw, cx, y, motto, sub_font, color)
        y += 36
    if address:
        _draw_centered(draw, cx, y, address, small_font, color)
        y += 28
    if contact:
        _draw_centered(draw, cx, y, contact, small_font, color)
        y += 28
    if affiliation:
        _draw_centered(draw, cx, y, f"Affiliation No: {affiliation}", small_font, color)

    # Bottom double line: thin inner, thick outer
    draw.line([(margin, height - 17), (HEADER_WIDTH - margin, height - 17)], fill=color_rgb, width=1)
    draw.line([(margin, height - 10), (HEADER_WIDTH - margin, height - 10)], fill=color_rgb, width=3)


def _render_banner(draw, img, name, motto, address, contact, affiliation, logo, color, color_rgb, name_font, sub_font, small_font, height):
    """Solid dark band occupying ~58 % of the header height, school name in
    white within the band, details on a clean white strip below.
    Excellent B&W contrast — the dark fill becomes solid black in print."""
    band_h = int(height * 0.58)
    draw.rectangle([(0, 0), (HEADER_WIDTH, band_h)], fill=color_rgb)

    # Logo inside the band, left side
    text_x = 50
    if logo:
        logo_y = (band_h - logo.height) // 2
        img.paste(logo, (text_x, logo_y), logo)
        text_x += logo.width + 40

    # School name + motto centered within the band text area
    band_cx = (text_x + HEADER_WIDTH) // 2
    name_y = max(10, (band_h - 65) // 2 - (16 if motto else 0))
    _draw_centered(draw, band_cx, name_y, name, name_font, "#FFFFFF")
    if motto:
        _draw_centered(draw, band_cx, name_y + 68, motto, sub_font, "rgba(255,255,255,200)")

    # Details below the band
    y = band_h + 14
    _draw_centered(draw, HEADER_WIDTH // 2, y, address, small_font, color)
    if contact:
        _draw_centered(draw, HEADER_WIDTH // 2, y + 28, contact, small_font, color)
    if affiliation:
        _draw_centered(draw, HEADER_WIDTH // 2, y + 56, f"Affiliation No: {affiliation}", small_font, color)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def render_generated_header_png(school, branding_override=None) -> bytes:
    from apps.tenancy.models import SchoolTenant

    from .models import DocumentBrandingSettings

    tenant = SchoolTenant.objects.filter(school_id=school.id).first()
    branding = branding_override if branding_override is not None else getattr(school, "document_branding", None)

    name = (getattr(tenant, "name", "") or school.name)
    address = ", ".join(
        p for p in [
            getattr(tenant, "campus_address", None),
            getattr(tenant, "city", None),
            getattr(tenant, "pin_code", None),
        ] if p
    )
    contact = "  |  ".join(
        p for p in [
            getattr(tenant, "school_phone", None) or getattr(tenant, "principal_phone", None),
            getattr(tenant, "school_email", None) or getattr(tenant, "principal_email", None),
            getattr(tenant, "website", None),
        ] if p
    )
    motto = getattr(tenant, "motto", "") or ""
    affiliation = getattr(tenant, "affiliation_number", "") or ""

    style = branding.header_style if branding else DocumentBrandingSettings.STYLE_CLASSIC
    color = branding.header_text_color if branding else "#1A1A2E"
    accent = (branding.accent_color if branding and branding.accent_color else color)
    header_size = branding.header_size if branding else DocumentBrandingSettings.SIZE_STANDARD
    logo_pos = branding.logo_position if branding else DocumentBrandingSettings.LOGO_CENTER
    show_div = branding.show_divider if branding is not None else True
    div_style = branding.divider_style if branding else DocumentBrandingSettings.DIVIDER_SOLID
    show_wm = branding.show_watermark if branding is not None else False
    wm_text = (branding.watermark_text if branding and branding.watermark_text else name) or name

    height = _SIZE_HEIGHTS.get(header_size, 300)
    color_rgb = _hex_to_rgb(color)
    accent_rgb = _hex_to_rgb(accent)

    logo = _resolve_local_logo(getattr(tenant, "logo_url", None))
    show_logo = branding.show_logo if branding is not None else True
    if logo and show_logo:
        logo = logo.copy()
        max_logo_dim = max(60, height // 3)
        logo.thumbnail((max_logo_dim, max_logo_dim))
    else:
        logo = None

    img = Image.new("RGB", (HEADER_WIDTH, height), "white")
    draw = ImageDraw.Draw(img)

    name_font_sz = max(38, min(56, height // 5))
    sub_font_sz = max(22, height // 11)
    small_font_sz = max(18, height // 15)
    name_font = _load_font(name_font_sz, bold=True)
    sub_font = _load_font(sub_font_sz)
    small_font = _load_font(small_font_sz)

    if style == DocumentBrandingSettings.STYLE_BANNER:
        _render_banner(draw, img, name, motto, address, contact, affiliation, logo, color, color_rgb, name_font, sub_font, small_font, height)
    elif style == DocumentBrandingSettings.STYLE_EXECUTIVE:
        _render_executive(draw, img, name, motto, address, contact, affiliation, logo, color, color_rgb, accent_rgb, name_font, sub_font, small_font, height)
    elif style == DocumentBrandingSettings.STYLE_LETTERPRESS:
        _render_letterpress(draw, img, name, motto, address, contact, affiliation, logo, color, color_rgb, name_font, sub_font, small_font, height)
    elif style == DocumentBrandingSettings.STYLE_MINIMAL:
        _render_minimal(draw, img, name, address, contact, logo, color, name_font, small_font, height)
    elif style == DocumentBrandingSettings.STYLE_MODERN:
        _render_modern(draw, img, name, motto, address, contact, affiliation, logo, color, name_font, sub_font, small_font, height)
    else:  # classic (default / fallback)
        _render_classic(draw, img, name, motto, address, contact, logo, color, name_font, sub_font, small_font, height, logo_pos)

    # Divider is skipped for letterpress (it has its own rules) and banner
    # (the band edge already acts as a visual separator).
    if show_div and div_style != DocumentBrandingSettings.DIVIDER_NONE and style not in (
        DocumentBrandingSettings.STYLE_LETTERPRESS,
        DocumentBrandingSettings.STYLE_BANNER,
    ):
        _draw_divider(draw, HEADER_WIDTH, height, div_style, accent_rgb)

    if show_wm:
        img = _add_watermark(img, wm_text.upper(), color)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def rasterize_pdf_first_page(file_bytes: bytes, dpi: int = 150) -> bytes:
    """Render the first page of an uploaded letterhead PDF to a PNG using
    PyMuPDF — no external system binaries (e.g. poppler) required, so this
    works the same on every deployment target without extra setup."""
    import fitz  # PyMuPDF

    doc = fitz.open(stream=file_bytes, filetype="pdf")
    try:
        if doc.page_count == 0:
            raise ValueError("PDF has no pages.")
        page = doc.load_page(0)
        zoom = dpi / 72
        matrix = fitz.Matrix(zoom, zoom)
        pixmap = page.get_pixmap(matrix=matrix, alpha=False)
        return pixmap.tobytes("png")
    finally:
        doc.close()


def normalize_image_to_png(file_bytes: bytes) -> bytes:
    """Re-encode an uploaded image (JPEG/PNG/etc.) to PNG for a single
    consistent stored format, regardless of what the school uploaded."""
    img = Image.open(io.BytesIO(file_bytes))
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def get_header_image_bytes(school) -> bytes:
    """The one function every consumer should go through — directly from
    Python (server-side PDF generation), or via
    DocumentBrandingHeaderImageView over HTTP for frontend callers."""
    from .models import DocumentBrandingSettings

    branding = getattr(school, "document_branding", None)
    if (
        branding is not None
        and branding.header_mode == DocumentBrandingSettings.MODE_UPLOADED
        and branding.letterhead_rendered_image
    ):
        branding.letterhead_rendered_image.open("rb")
        try:
            return branding.letterhead_rendered_image.read()
        finally:
            branding.letterhead_rendered_image.close()
    return render_generated_header_png(school)


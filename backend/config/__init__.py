import sys as _sys

# Guard: only load the Celery app when running as a Celery worker/beat
# process, NOT when Django (or daphne/ASGI) imports the config package.
# Celery 5.6 + billiard 4.2 sub-module imports hang on Python 3.14 when
# triggered at ASGI startup time. The guard checks that the process was
# launched via a celery entry-point so ASGI servers are unaffected.
_celery_entrypoints = {"celery", "celery.__main__"}
if (
    _sys.argv and _sys.argv[0].endswith("celery")
) or _sys.modules.get("celery.__main__") or (
    _sys.argv and len(_sys.argv) > 1 and _sys.argv[0].endswith("__main__.py")
    and "celery" in _sys.argv[0]
):
    from .celery import app as celery_app  # noqa: F401
    __all__ = ("celery_app",)


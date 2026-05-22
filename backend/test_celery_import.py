import time
t = time.time()
import celery.schedules
print(f"celery.schedules imported OK in {time.time()-t:.1f}s")
from celery.schedules import crontab
print(f"crontab imported OK in {time.time()-t:.1f}s")

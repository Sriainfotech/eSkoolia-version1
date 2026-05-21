# Production Deployment & Readiness Guide

## Environment Setup

### 1. Install Dependencies

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Additional production packages
pip install gunicorn whitenoise psycopg2-binary celery redis
```

### 2. Environment Configuration

Create `.env` file in project root:

```bash
# Django Settings
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=your-secret-key-here-change-this-in-production
DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Database (PostgreSQL recommended)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=school_erp_prod
DB_USER=postgres
DB_PASSWORD=secure-password
DB_HOST=localhost
DB_PORT=5432

# Redis (for caching and Celery)
REDIS_URL=redis://localhost:6379/0

# Email Configuration
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
EMAIL_USE_TLS=True

# JWT Token Settings
JWT_SECRET=your-jwt-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DAYS=1

# File Upload
FILE_UPLOAD_MAX_MEMORY_SIZE=5242880  # 5MB
DATA_UPLOAD_MAX_MEMORY_SIZE=5242880

# CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Sentry (Error tracking)
SENTRY_DSN=your-sentry-dsn-here
```

### 3. Production Settings

Update `config/settings/production.py`:

```python
from .base import *

DEBUG = False
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', '').split(',')

# Database - PostgreSQL in production
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT', 5432),
        'CONN_MAX_AGE': 600,
    }
}

# Cache Configuration
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/1'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

# Session Cache
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'

# Security Settings
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
X_FRAME_OPTIONS = 'DENY'

# Static & Media Files
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Whitenoise for serving static files
MIDDLEWARE = [
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Add first
    *MIDDLEWARE,
]

# Gzip compression
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Sentry Error Tracking
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

sentry_sdk.init(
    dsn=os.getenv('SENTRY_DSN'),
    integrations=[DjangoIntegration()],
    traces_sample_rate=0.1,
    send_default_pii=False
)

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'ERROR',
            'class': 'logging.FileHandler',
            'filename': '/var/log/django/error.log',
        },
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['file', 'console'],
        'level': 'INFO',
    },
}
```

## Database Migration & Setup

```bash
# Run migrations
python manage.py migrate --settings=config.settings.production

# Create superuser
python manage.py createsuperuser --settings=config.settings.production

# Collect static files
python manage.py collectstatic --noinput --settings=config.settings.production

# Load initial data (permissions, roles)
python manage.py loaddata initial_permissions --settings=config.settings.production
python manage.py loaddata initial_roles --settings=config.settings.production
```

## Deployment Options

### Option 1: Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput --settings=config.settings.production

# Expose port
EXPOSE 8000

# Run gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "config.wsgi:application"]
```

Create `docker-compose.yml`:

```yaml
version: '3.9'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: school_erp_prod
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secure-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  web:
    build: .
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings.production
    volumes:
      - .:/app
    ports:
      - "8000:8000"
    depends_on:
      - db
      - redis
    env_file:
      - .env

  celery:
    build: .
    command: celery -A config worker -l info
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings.production
    depends_on:
      - db
      - redis
    env_file:
      - .env

volumes:
  postgres_data:
```

Deploy with Docker:

```bash
# Build and run
docker-compose build
docker-compose up -d

# Run migrations
docker-compose exec web python manage.py migrate

# Create superuser
docker-compose exec web python manage.py createsuperuser
```

### Option 2: Traditional Server Deployment (Ubuntu)

```bash
# 1. Setup server environment
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv postgresql postgresql-contrib nginx

# 2. Clone project
git clone <repo-url> /var/www/school-erp
cd /var/www/school-erp

# 3. Setup virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. Setup database
sudo -u postgres createdb school_erp_prod
sudo -u postgres createuser school_erp_user
# Set password...

# 5. Run migrations
python manage.py migrate --settings=config.settings.production

# 6. Create Gunicorn service file
sudo nano /etc/systemd/system/gunicorn.service
```

Create gunicorn service file:

```ini
[Unit]
Description=gunicorn daemon for School ERP
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/school-erp
ExecStart=/var/www/school-erp/venv/bin/gunicorn \
    --workers 4 \
    --bind unix:/var/run/gunicorn.sock \
    --timeout 120 \
    config.wsgi:application

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 7. Setup Nginx
sudo nano /etc/nginx/sites-available/school-erp
```

Nginx configuration:

```nginx
upstream gunicorn {
    server unix:/var/run/gunicorn.sock fail_timeout=0;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://gunicorn;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /static/ {
        alias /var/www/school-erp/staticfiles/;
    }

    location /media/ {
        alias /var/www/school-erp/media/;
    }
}
```

Enable and start services:

```bash
sudo ln -s /etc/nginx/sites-available/school-erp /etc/nginx/sites-enabled/
sudo systemctl start gunicorn
sudo systemctl enable gunicorn
sudo systemctl restart nginx
```

## SSL Certificate (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com
```

Update Nginx configuration with SSL:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # ... rest of configuration
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## Monitoring & Logging

### Setup Monitoring

```bash
# Install monitoring tools
pip install django-health-check
pip install django-extensions
```

Add health check endpoint:

```python
# config/urls.py
urlpatterns = [
    path('health/', include('health_check.urls')),
]
```

### Centralized Logging

```bash
pip install python-json-logger
```

### Database Backups

```bash
# Create backup script
sudo nano /usr/local/bin/backup-school-erp.sh
```

```bash
#!/bin/bash
DB_NAME="school_erp_prod"
BACKUP_DIR="/backups/school-erp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
pg_dump $DB_NAME | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -type f -name "backup_*.sql.gz" -mtime +30 -delete
```

Add to crontab:

```bash
# Backup daily at 2 AM
0 2 * * * /usr/local/bin/backup-school-erp.sh
```

## Performance Optimization

### 1. Database Optimization

```python
# Use select_related and prefetch_related
queryset = Model.objects.select_related('foreign_key').prefetch_related('reverse_relation')

# Pagination
from rest_framework.pagination import PageNumberPagination
class StandardPagination(PageNumberPagination):
    page_size = 25
```

### 2. Caching

```python
from django.views.decorators.cache import cache_page

@cache_page(60 * 5)  # Cache for 5 minutes
def expensive_view(request):
    pass
```

### 3. CDN for Static Files

Use CloudFront or Cloudflare for static file delivery.

## Security Checklist

- [ ] Change DEBUG = False
- [ ] Set secure SECRET_KEY
- [ ] Use HTTPS everywhere (HTTPS_REDIRECT)
- [ ] Enable HSTS headers
- [ ] Set secure cookie flags
- [ ] Configure CORS properly
- [ ] Use strong database passwords
- [ ] Setup firewall rules
- [ ] Enable rate limiting
- [ ] Setup API authentication (JWT)
- [ ] Implement CSRF protection
- [ ] Sanitize user inputs
- [ ] Use environment variables for secrets
- [ ] Regular security updates
- [ ] Setup monitoring and alerting
- [ ] Implement request logging
- [ ] Setup API rate limiting

## Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Run load test
ab -n 1000 -c 100 http://yourdomain.com/api/test/

# Using Locust
pip install locust
locust -f locustfile.py --host=http://yourdomain.com
```

## Production Checklist

- [ ] Database backed up and secured
- [ ] Email configured
- [ ] Static files collected and served
- [ ] SSL certificate installed
- [ ] Monitoring and alerting configured
- [ ] Database optimized with indexes
- [ ] Caching strategy implemented
- [ ] API rate limiting configured
- [ ] Security headers configured
- [ ] Logging configured
- [ ] Backup strategy in place
- [ ] Disaster recovery plan
- [ ] Load tested under expected load
- [ ] Documentation up to date
- [ ] Team trained on deployment process
- [ ] Rollback procedure documented

## Troubleshooting

### Service won't start

```bash
# Check service status
sudo systemctl status gunicorn
sudo journalctl -u gunicorn -n 50

# Check Nginx
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Database connection errors

```bash
# Check PostgreSQL
sudo -u postgres psql
\l  # List databases
\du # List users

# Test connection
PGPASSWORD=password psql -h localhost -U user -d dbname -c "SELECT 1;"
```

### High server load

```bash
# Monitor resources
top
htop
iotop

# Check disk space
df -h
du -sh /var/www/school-erp

# Check connections
netstat -an | grep ESTABLISHED | wc -l
```

# Getting Started with School ERP Development

## 🚀 Quick Start

### **Windows Users**

1. Navigate to the project root directory in PowerShell or CMD:
```bash
cd c:\xampp\htdocs\upload\rewrite
```

2. Run the startup script:
```bash
.\START_DEV_SERVERS.bat
```

This will automatically:
- ✅ Create Python virtual environment
- ✅ Install backend dependencies (including Daphne ASGI server)
- ✅ Run database migrations
- ✅ Start Django backend with ASGI server on http://localhost:8000 (supports WebSockets)
- ✅ Install frontend dependencies (if needed)
- ✅ Start Next.js frontend on http://localhost:3000 (or 3001)

### **macOS/Linux Users**

1. Navigate to the project root directory:
```bash
cd /path/to/rewrite
```

2. Make the script executable and run:
```bash
chmod +x start-dev-servers.sh
./start-dev-servers.sh
```

---

## 🌐 Access the Application

Once both servers are running:

| Service | URL | Purpose |
|---------|-----|---------|
| **Backend API** | http://localhost:8000/api/ | REST API endpoints |
| **WebSocket Chat** | ws://localhost:8000/ws/chat/ | Real-time messaging |
| **API Docs (Swagger)** | http://localhost:8000/api/docs/ | Interactive API documentation |
| **API Docs (ReDoc)** | http://localhost:8000/api/redoc/ | Alternative API documentation |
| **Frontend** | http://localhost:3000 | React/Next.js web interface |

---

## 🛠️ Manual Setup (If Needed)

### **Backend Setup**

1. Create virtual environment:
```bash
cd rewrite/backend
python -m venv venv
```

2. Activate virtual environment:
   - **Windows**: `venv\Scripts\activate`
   - **macOS/Linux**: `source venv/bin/activate`

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run migrations:
```bash
# Set environment variable first
$env:DJANGO_SETTINGS_MODULE = 'config.settings.local'  # Windows
export DJANGO_SETTINGS_MODULE=config.settings.local     # macOS/Linux

# Then run migrations
python manage.py migrate
```

5. Start development server:
```bash
python manage.py runserver 0.0.0.0:8000
```

### **Frontend Setup**

1. Navigate to frontend directory:
```bash
cd rewrite/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

4. The server will start on http://localhost:3000 (or 3001 if 3000 is in use)

---

## 🔧 Common Issues & Solutions

### **Issue: "Port 8000 is already in use"**

**Solution:** Kill the process using port 8000:
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:8000 | xargs kill -9
```

### **Issue: "PORT 3000 is already in use"**

**Solution:** The frontend automatically tries port 3001. You can also:
```bash
# Windows - use different port
npm run dev -- -p 3002

# macOS/Linux
npm run dev -- -p 3002
```

### **Issue: "Module not found" or import errors**

**Solution:** Reinstall dependencies:
```bash
# Backend
cd rewrite/backend
pip install --upgrade -r requirements.txt

# Frontend
cd rewrite/frontend
rm -rf node_modules package-lock.json
npm install
```

### **Issue: "Migrations not applied"**

**Solution:** Ensure DJANGO_SETTINGS_MODULE is set and run:
```bash
python manage.py migrate --run-syncdb
```

### **Issue: "DJANGO_SETTINGS_MODULE not defined"**

**Solution:** Set it before running commands:
```bash
# Windows PowerShell
$env:DJANGO_SETTINGS_MODULE = 'config.settings.local'

# Windows CMD
set DJANGO_SETTINGS_MODULE=config.settings.local

# macOS/Linux
export DJANGO_SETTINGS_MODULE=config.settings.local
```

---

## 📚 Project Structure

```
rewrite/
├── backend/                    # Django REST Framework API
│   ├── config/                # Django configuration
│   ├── apps/                  # Django applications
│   ├── manage.py              # Django management script
│   └── requirements.txt        # Python dependencies
│
├── frontend/                  # Next.js React application
│   ├── app/                   # Next.js pages & layouts
│   ├── components/            # React components
│   ├── package.json           # Node dependencies
│   └── tsconfig.json          # TypeScript config
│
├── START_DEV_SERVERS.bat     # Windows startup script
├── start-dev-servers.sh      # Unix startup script
└── README.md
```

---

## 🧪 Testing

### **Backend Tests**

```bash
cd rewrite/backend
$env:DJANGO_SETTINGS_MODULE = 'config.settings.local'

# Run all tests
python manage.py test

# Run specific app tests
python manage.py test apps.students

# Run with coverage
pip install coverage
coverage run --source='.' manage.py test
coverage report
```

### **Frontend Tests**

```bash
cd rewrite/frontend
npm test
```

---

## 📖 Documentation

### **Backend Documentation**
- [API_DOCUMENTATION.md](../backend/API_DOCUMENTATION.md) - Complete API reference
- [CONVERSION_GUIDE.md](../backend/CONVERSION_GUIDE.md) - How to add new modules
- [TESTING_GUIDE.md](../backend/TESTING_GUIDE.md) - Testing patterns
- [PRODUCTION_GUIDE.md](../backend/PRODUCTION_GUIDE.md) - Deployment guide
- [QUICK_REFERENCE.md](../backend/QUICK_REFERENCE.md) - Quick tips & tricks

---

## 🚀 First Steps

1. **Start the dev servers** using one of the methods above
2. **Visit the API Docs** at http://localhost:8000/api/docs/
3. **Login with test credentials** (if created):
   - Username: `admin`
   - Password: `admin@123` (or your created password)
4. **Explore the API** in the interactive Swagger UI
5. **Open the frontend** at http://localhost:3000 to see the web interface

---

## 💡 Tips

- **Frontend hot reload**: Changes to Next.js code automatically reload in browser
- **Backend auto-reload**: Django dev server automatically restarts on Python code changes
- **Debug print statements**: Add `print()` statements in backend and check the terminal
- **Network inspection**: Use browser DevTools to inspect API calls and responses
- **API testing**: Use Postman, Insomnia, or the built-in Swagger UI

---

## 🔐 Development Credentials

To create a test user:

```bash
cd rewrite/backend
$env:DJANGO_SETTINGS_MODULE = 'config.settings.local'
python manage.py createsuperuser
```

Then enter:
- Username: `testuser`
- Email: `test@example.com`
- Password: `TestPass@123`

---

## 📝 Environment Configuration

The `.env` file in `rewrite/backend/` contains:

```
DJANGO_DEBUG=True              # Enable debug mode
DJANGO_SECRET_KEY=...          # Secret for Django (change in production)
DB_ENGINE=sqlite3              # Using SQLite for development
REDIS_URL=redis://...          # Redis URL (optional for dev)
```

For production, see [PRODUCTION_GUIDE.md](../backend/PRODUCTION_GUIDE.md)

---

## 🆘 Need Help?

1. Check if both servers are running: 
   - Backend: http://localhost:8000/health/ (should return `{"status":"ok"}`)
   - Frontend: http://localhost:3000 (should load the page)

2. Check the server terminal output for error messages

3. Review relevant documentation in the `backend/` directory

4. Run `python manage.py check` to verify Django configuration

---

**Happy Coding! 🎉**

For detailed information about each component, see the documentation files in `backend/` directory.

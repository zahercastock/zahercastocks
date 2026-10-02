import os
from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from .database import engine, Base, SessionLocal, get_db
from .seed_data import init_db_data
from .routes_api import router as api_router
from .auth import (
    get_current_user_optional,
    SESSION_COOKIE_NAME,
    delete_user_session,
    extract_session_token
)

# Crear tablas en la base de datos si no existen
Base.metadata.create_all(bind=engine)

# Inicializar con datos de ejemplo y usuario administrador
with SessionLocal() as db:
    init_db_data(db)

app = FastAPI(
    title="ZahercaStocks · Control de Equipos y Herramientas",
    description="Sistema de control de inventario, préstamos y monitoreo remoto para Zaherca Construcciones.",
    version="1.0.0"
)

# CORS para permitir peticiones remotas y móviles
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directorios de plantillas y archivos estáticos
current_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(current_dir, "static")
templates_dir = os.path.join(current_dir, "templates")

os.makedirs(static_dir, exist_ok=True)
os.makedirs(templates_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=static_dir), name="static")
templates = Jinja2Templates(directory=templates_dir)

# Incluir rutas API
app.include_router(api_router)


# --- Vistas Web HTML (Frontend Protegido con Autenticación) ---

@app.get("/login")
def view_login(request: Request, db: Session = Depends(get_db)):
    user = get_current_user_optional(request, db)
    if user:
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse(request=request, name="login.html")


@app.get("/logout")
def view_logout(request: Request, db: Session = Depends(get_db)):
    token = extract_session_token(request)
    if token:
        delete_user_session(db, token)
    response = RedirectResponse(url="/login", status_code=302)
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return response


@app.get("/")
def view_dashboard(request: Request, db: Session = Depends(get_db)):
    user = get_current_user_optional(request, db)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse(request=request, name="dashboard.html", context={"active_page": "dashboard", "current_user": user})


@app.get("/inventory")
def view_inventory(request: Request, db: Session = Depends(get_db)):
    user = get_current_user_optional(request, db)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse(request=request, name="inventory.html", context={"active_page": "inventory", "current_user": user})


@app.get("/movements")
def view_movements(request: Request, db: Session = Depends(get_db)):
    user = get_current_user_optional(request, db)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse(request=request, name="movements.html", context={"active_page": "movements", "current_user": user})


@app.get("/scanner")
def view_scanner(request: Request, db: Session = Depends(get_db)):
    user = get_current_user_optional(request, db)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse(request=request, name="scanner.html", context={"active_page": "scanner", "current_user": user})


@app.get("/employees")
def view_employees(request: Request, db: Session = Depends(get_db)):
    user = get_current_user_optional(request, db)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse(request=request, name="employees.html", context={"active_page": "employees", "current_user": user})


@app.get("/print-qr")
def view_print_qr(request: Request, db: Session = Depends(get_db)):
    user = get_current_user_optional(request, db)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse(request=request, name="qr_print.html", context={"active_page": "print_qr", "current_user": user})


@app.get("/users")
def view_users(request: Request, db: Session = Depends(get_db)):
    user = get_current_user_optional(request, db)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    if user.role != "admin":
        return RedirectResponse(url="/", status_code=302)
    return templates.TemplateResponse(request=request, name="users.html", context={"active_page": "users", "current_user": user})


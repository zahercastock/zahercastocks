import io
import csv
import datetime
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List

from .database import get_db
from .models import Equipment, Employee, Movement, User, UserSession
from .auth import (
    SESSION_COOKIE_NAME,
    create_user_session,
    delete_user_session,
    get_current_user,
    get_current_user_optional,
    require_admin,
    extract_session_token
)
import socket
import os

router = APIRouter(prefix="/api")

def get_server_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

@router.get("/tunnel-info")
def get_tunnel_info():
    tunnel_file = os.path.join(os.path.dirname(__file__), "tunnel_info.txt")
    tunnel_url = None
    if os.path.exists(tunnel_file):
        try:
            with open(tunnel_file, "r", encoding="utf-8") as f:
                tunnel_url = f.read().strip()
        except:
            pass
    
    local_ip = get_server_local_ip()
    best_mobile_url = tunnel_url if tunnel_url else f"http://{local_ip}:8000"
    
    return {
        "tunnel_url": tunnel_url,
        "local_ip": local_ip,
        "best_mobile_url": best_mobile_url
    }

@router.get("/tunnel-qr")
def get_tunnel_qr():
    info = get_tunnel_info()
    target_url = info["best_mobile_url"]

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(target_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)

    return Response(content=img_byte_arr.getvalue(), media_type="image/png")


# --- Esquemas Pydantic para validación ---

class EquipmentCreate(BaseModel):
    code: str
    name: str
    category: str = "Herramientas Generales"
    brand: Optional[str] = ""
    model: Optional[str] = ""
    serial_number: Optional[str] = ""
    location: Optional[str] = "Almacén Principal"
    status: Optional[str] = "DISPONIBLE"
    condition: Optional[str] = "Bueno"
    value: Optional[float] = 0.0
    notes: Optional[str] = ""

class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    condition: Optional[str] = None
    value: Optional[float] = None
    notes: Optional[str] = None

class EmployeeCreate(BaseModel):
    doc_id: str
    full_name: str
    role: Optional[str] = "Técnico"
    department: Optional[str] = "Operaciones"
    phone: Optional[str] = ""
    email: Optional[str] = ""

class EmployeeUpdate(BaseModel):
    doc_id: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None

class CheckoutRequest(BaseModel):
    equipment_code: str
    employee_id: int
    movement_type: Optional[str] = "PRESTAMO"  # PRESTAMO o MANTENIMIENTO
    destination_project: Optional[str] = "General"
    expected_return_date: Optional[str] = None  # Format: YYYY-MM-DD or YYYY-MM-DDTHH:MM
    checkout_condition: Optional[str] = "Bueno"
    checkout_notes: Optional[str] = ""

class CheckinRequest(BaseModel):
    return_condition: str = "Bueno"
    return_notes: Optional[str] = ""
    new_equipment_status: Optional[str] = "DISPONIBLE"  # DISPONIBLE o MANTENIMIENTO

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = ""
    role: Optional[str] = "operador"  # admin o operador

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


# --- Endpoints de Estadísticas (Dashboard) ---

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total_equipments = db.query(Equipment).count()
    available_equipments = db.query(Equipment).filter(Equipment.status == "DISPONIBLE").count()
    in_use_equipments = db.query(Equipment).filter(Equipment.status == "EN_USO").count()
    maintenance_equipments = db.query(Equipment).filter(Equipment.status == "MANTENIMIENTO").count()
    damaged_equipments = db.query(Equipment).filter(Equipment.status == "DANADO").count()
    
    total_employees = db.query(Employee).filter(Employee.is_active == True).count()
    
    # Préstamos activos y atrasados
    active_movements = db.query(Movement).filter(Movement.status == "ACTIVO").all()
    overdue_count = sum(1 for m in active_movements if m.is_overdue)
    
    # Préstamos activos detallados
    active_loans_list = [m.to_dict() for m in active_movements]
    
    # Movimientos recientes (últimos 10)
    recent_movements = (
        db.query(Movement)
        .order_by(Movement.id.desc())
        .limit(10)
        .all()
    )
    
    # Conteo por categoría
    category_counts = (
        db.query(Equipment.category, func.count(Equipment.id))
        .group_by(Equipment.category)
        .all()
    )
    categories_data = [{"category": cat, "count": count} for cat, count in category_counts]

    return {
        "total_equipments": total_equipments,
        "available_equipments": available_equipments,
        "in_use_equipments": in_use_equipments,
        "maintenance_equipments": maintenance_equipments,
        "damaged_equipments": damaged_equipments,
        "total_employees": total_employees,
        "overdue_count": overdue_count,
        "active_loans": active_loans_list,
        "recent_movements": [m.to_dict() for m in recent_movements],
        "categories": categories_data
    }


# --- Endpoints de Equipos ---

@router.get("/equipment/locations")
def list_equipment_locations(db: Session = Depends(get_db)):
    locs = db.query(Equipment.location).distinct().all()
    locations = sorted(list(set([l[0].strip() for l in locs if l[0] and l[0].strip()])))
    return locations


@router.get("/equipment/categories")
def list_equipment_categories(db: Session = Depends(get_db)):
    cats = db.query(Equipment.category).distinct().all()
    categories = sorted(list(set([c[0].strip() for c in cats if c[0] and c[0].strip()])))
    return categories



@router.get("/equipment")
def list_equipment(
    q: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    location: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Equipment)
    
    search_term = (search or q or "").strip()
    if search_term:
        term = f"%{search_term}%"
        query = query.filter(
            (Equipment.code.ilike(term)) |
            (Equipment.name.ilike(term)) |
            (Equipment.brand.ilike(term)) |
            (Equipment.serial_number.ilike(term)) |
            (Equipment.location.ilike(term))
        )
    
    if category and category.strip() and category.upper() != "TODAS":
        cat_val = category.strip()
        query = query.filter(
            (Equipment.category == cat_val) |
            (Equipment.category.ilike(f"%{cat_val}%")) |
            (func.lower(Equipment.category) == cat_val.lower())
        )
        
    if status and status.strip() and status.upper() != "TODOS":
        st_val = status.strip()
        query = query.filter(
            (Equipment.status == st_val) |
            (func.lower(Equipment.status) == st_val.lower())
        )
        
    if location and location.strip() and location.upper() != "TODAS":
        loc_val = location.strip()
        query = query.filter(
            (Equipment.location == loc_val) |
            (Equipment.location.ilike(f"%{loc_val}%"))
        )

    equipments = query.order_by(Equipment.id.desc()).all()
    return [eq.to_dict() for eq in equipments]



@router.get("/equipment/{equipment_id}")
def get_equipment(equipment_id: int, db: Session = Depends(get_db)):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    
    data = eq.to_dict()
    # Agregar historial de movimientos
    history = (
        db.query(Movement)
        .filter(Movement.equipment_id == equipment_id)
        .order_by(Movement.id.desc())
        .limit(20)
        .all()
    )
    data["history"] = [m.to_dict() for m in history]
    
    # Préstamo activo actual si existe
    active_loan = (
        db.query(Movement)
        .filter(Movement.equipment_id == equipment_id, Movement.status == "ACTIVO")
        .first()
    )
    data["active_loan"] = active_loan.to_dict() if active_loan else None
    return data


@router.get("/equipment/by-code/{code}")
def get_equipment_by_code(code: str, db: Session = Depends(get_db)):
    clean_code = code.strip()
    eq = db.query(Equipment).filter(func.lower(Equipment.code) == clean_code.lower()).first()
    if not eq:
        raise HTTPException(status_code=404, detail=f"No se encontró ningún equipo con el código '{code}'")
    
    data = eq.to_dict()
    active_loan = (
        db.query(Movement)
        .filter(Movement.equipment_id == eq.id, Movement.status == "ACTIVO")
        .first()
    )
    data["active_loan"] = active_loan.to_dict() if active_loan else None
    return data


@router.post("/equipment")
def create_equipment(payload: EquipmentCreate, db: Session = Depends(get_db)):
    # Validar código único
    exists = db.query(Equipment).filter(func.lower(Equipment.code) == payload.code.strip().lower()).first()
    if exists:
        raise HTTPException(status_code=400, detail=f"El código de equipo '{payload.code}' ya está registrado.")

    new_eq = Equipment(
        code=payload.code.strip().upper(),
        name=payload.name.strip(),
        category=payload.category,
        brand=payload.brand,
        model=payload.model,
        serial_number=payload.serial_number,
        location=payload.location,
        status=payload.status,
        condition=payload.condition,
        value=payload.value,
        notes=payload.notes
    )
    db.add(new_eq)
    db.commit()
    db.refresh(new_eq)

    # Registrar movimiento de auditoría por alta de equipo
    audit_mov = Movement(
        equipment_id=new_eq.id,
        equipment_code_snap=new_eq.code,
        equipment_name_snap=new_eq.name,
        equipment_category_snap=new_eq.category,
        employee_name_snap="Administrador / Sistema",
        employee_doc_snap="SYS-01",
        movement_type="ALTA_INVENTARIO",
        status="DEVUELTO",
        checkout_date=datetime.datetime.utcnow(),
        return_date=datetime.datetime.utcnow(),
        checkout_condition=new_eq.condition or "Bueno",
        return_condition=new_eq.condition or "Bueno",
        destination_project=new_eq.location or "Almacén Principal",
        checkout_notes=f"Registro y alta en inventario del equipo '{new_eq.name}' ({new_eq.code}). Estado inicial: {new_eq.status}."
    )
    db.add(audit_mov)
    db.commit()

    return {"message": "Equipo registrado con éxito", "equipment": new_eq.to_dict()}


@router.put("/equipment/{equipment_id}")
def update_equipment(equipment_id: int, payload: EquipmentUpdate, db: Session = Depends(get_db)):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(eq, key, value)
    
    db.commit()
    db.refresh(eq)
    return {"message": "Equipo actualizado con éxito", "equipment": eq.to_dict()}


@router.delete("/equipment/{equipment_id}")
def delete_equipment(equipment_id: int, db: Session = Depends(get_db)):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    
    # 1. Preservar instantáneas (snapshots) en todos los movimientos existentes
    existing_movements = db.query(Movement).filter(Movement.equipment_id == equipment_id).all()
    for m in existing_movements:
        m.equipment_code_snap = eq.code
        m.equipment_name_snap = eq.name
        m.equipment_category_snap = eq.category
        m.equipment_id = None
        if not m.employee_name_snap and m.employee:
            m.employee_name_snap = m.employee.full_name
            m.employee_doc_snap = m.employee.doc_id

    # 2. Registrar movimiento de auditoría por baja/eliminación
    audit_del = Movement(
        equipment_id=None,
        equipment_code_snap=eq.code,
        equipment_name_snap=eq.name,
        equipment_category_snap=eq.category,
        employee_name_snap="Administrador / Sistema",
        employee_doc_snap="SYS-01",
        movement_type="BAJA_INVENTARIO",
        status="DEVUELTO",
        checkout_date=datetime.datetime.utcnow(),
        return_date=datetime.datetime.utcnow(),
        checkout_condition=eq.condition or "Baja",
        return_condition=eq.condition or "Baja",
        destination_project="Desincorporado / Eliminado",
        checkout_notes=f"Equipo '{eq.name}' ({eq.code}) desincorporado y eliminado del catálogo activo. Última ubicación: {eq.location}, Estado previo: {eq.status}."
    )
    db.add(audit_del)

    # 3. Eliminar el equipo del catálogo
    db.delete(eq)
    db.commit()
    return {"message": f"Equipo '{eq.name}' ({eq.code}) eliminado del inventario activo. Su historial de movimientos ha sido preservado permanentemente."}


@router.get("/equipment/{equipment_id}/qr")
def generate_equipment_qr(equipment_id: int, db: Session = Depends(get_db)):
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    # Generar QR con el código del equipo
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(eq.code)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)

    return Response(content=img_byte_arr.getvalue(), media_type="image/png")


# --- Endpoints de Empleados ---

@router.get("/employees")
def list_employees(db: Session = Depends(get_db)):
    emps = db.query(Employee).order_by(Employee.full_name.asc()).all()
    return [emp.to_dict() for emp in emps]


@router.post("/employees")
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    exists = db.query(Employee).filter(func.lower(Employee.doc_id) == payload.doc_id.strip().lower()).first()
    if exists:
        raise HTTPException(status_code=400, detail=f"La cédula/ID '{payload.doc_id}' ya está registrada.")

    emp = Employee(
        doc_id=payload.doc_id.strip().upper(),
        full_name=payload.full_name.strip(),
        role=payload.role,
        department=payload.department,
        phone=payload.phone,
        email=payload.email
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return {"message": "Empleado registrado con éxito", "employee": emp.to_dict()}


@router.put("/employees/{employee_id}")
def update_employee(employee_id: int, payload: EmployeeUpdate, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    update_data = payload.model_dump(exclude_unset=True)
    
    # Validar cambio de documento/cédula
    if "doc_id" in update_data and update_data["doc_id"]:
        new_doc = update_data["doc_id"].strip().upper()
        if new_doc != emp.doc_id:
            exists = db.query(Employee).filter(
                func.lower(Employee.doc_id) == new_doc.lower(),
                Employee.id != employee_id
            ).first()
            if exists:
                raise HTTPException(status_code=400, detail=f"La cédula/ID '{new_doc}' ya está registrada por otro empleado ({exists.full_name}).")
            emp.doc_id = new_doc
        del update_data["doc_id"]

    for key, value in update_data.items():
        setattr(emp, key, value)

    db.commit()
    db.refresh(emp)
    return {"message": "Empleado actualizado con éxito", "employee": emp.to_dict()}


@router.delete("/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    # Verificar si tiene préstamos activos pendientes
    active_loans = db.query(Movement).filter(
        Movement.employee_id == employee_id,
        Movement.status.in_(["ACTIVO", "ATRASADO"])
    ).count()
    if active_loans > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar a '{emp.full_name}' porque tiene {active_loans} herramienta(s) en préstamo activo. Por favor registra la devolución antes de eliminar este personal."
        )

    # Preservar instantáneas (snapshots) en todos los movimientos de este empleado
    existing_movements = db.query(Movement).filter(Movement.employee_id == employee_id).all()
    for m in existing_movements:
        m.employee_name_snap = emp.full_name
        m.employee_doc_snap = emp.doc_id
        m.employee_id = None
        if not m.equipment_name_snap and m.equipment:
            m.equipment_code_snap = m.equipment.code
            m.equipment_name_snap = m.equipment.name
            m.equipment_category_snap = m.equipment.category

    db.delete(emp)
    db.commit()
    return {"message": f"Personal '{emp.full_name}' ({emp.doc_id}) eliminado del catálogo activo. Su historial de movimientos ha sido preservado permanentemente."}


# --- Endpoints de Movimientos (Check-Out y Check-In) ---

@router.get("/movements")
def list_movements(
    status: Optional[str] = None, # ACTIVO, DEVUELTO, ATRASADO
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(Movement).order_by(Movement.id.desc())
    if status == "ACTIVO":
        query = query.filter(Movement.status == "ACTIVO")
    elif status == "DEVUELTO":
        query = query.filter(Movement.status == "DEVUELTO")
    
    movements = query.limit(limit).all()
    result = [m.to_dict() for m in movements]
    
    if status == "ATRASADO":
        result = [m for m in result if m["status"] == "ATRASADO"]
        
    return result


@router.get("/movements/{movement_id}")
def get_movement(movement_id: int, db: Session = Depends(get_db)):
    mov = db.query(Movement).filter(Movement.id == movement_id).first()
    if not mov:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")
    return mov.to_dict()



@router.post("/movements/checkout")
def checkout_equipment(payload: CheckoutRequest, db: Session = Depends(get_db)):
    # Buscar equipo por código
    eq = db.query(Equipment).filter(func.lower(Equipment.code) == payload.equipment_code.strip().lower()).first()
    if not eq:
        raise HTTPException(status_code=404, detail=f"No se encontró el equipo '{payload.equipment_code}'")

    if eq.status == "EN_USO":
        raise HTTPException(status_code=400, detail=f"El equipo '{eq.name}' ({eq.code}) ya está en préstamo (EN USO).")
    elif eq.status in ["MANTENIMIENTO", "DANADO", "BAJA"]:
        raise HTTPException(status_code=400, detail=f"No se puede prestar el equipo porque su estado es '{eq.status}'.")

    # Buscar empleado
    emp = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    # Parsear fecha esperada de retorno
    expected_dt = None
    if payload.expected_return_date:
        try:
            # Soporta formato YYYY-MM-DD o ISO
            clean_date = payload.expected_return_date.replace("T", " ")
            if len(clean_date) == 10:
                expected_dt = datetime.datetime.strptime(clean_date, "%Y-%m-%d") + datetime.timedelta(hours=18)
            else:
                expected_dt = datetime.datetime.strptime(clean_date[:16], "%Y-%m-%d %H:%M")
        except Exception:
            expected_dt = datetime.datetime.utcnow() + datetime.timedelta(days=1)
    else:
        # Por defecto 24 horas
        expected_dt = datetime.datetime.utcnow() + datetime.timedelta(days=1)

    movement_type = payload.movement_type.strip().upper() if payload.movement_type else "PRESTAMO"
    if movement_type not in ["PRESTAMO", "MANTENIMIENTO"]:
        movement_type = "PRESTAMO"

    new_status = "MANTENIMIENTO" if movement_type == "MANTENIMIENTO" else "EN_USO"

    # Crear movimiento con instantáneas de datos
    mov = Movement(
        equipment_id=eq.id,
        employee_id=emp.id,
        equipment_code_snap=eq.code,
        equipment_name_snap=eq.name,
        equipment_category_snap=eq.category,
        employee_name_snap=emp.full_name,
        employee_doc_snap=emp.doc_id,
        movement_type=movement_type,
        status="ACTIVO",
        checkout_date=datetime.datetime.utcnow(),
        expected_return_date=expected_dt,
        checkout_condition=payload.checkout_condition or eq.condition,
        destination_project=payload.destination_project,
        checkout_notes=payload.checkout_notes
    )
    db.add(mov)

    # Actualizar estado de equipo
    eq.status = new_status
    db.commit()
    db.refresh(mov)

    action_label = "Envío a Mantenimiento" if movement_type == "MANTENIMIENTO" else "Préstamo"
    return {
        "message": f"{action_label} registrado exitosamente para '{eq.name}' a {emp.full_name}",
        "movement": mov.to_dict()
    }


@router.post("/movements/checkin/{movement_id}")
def checkin_equipment(movement_id: int, payload: CheckinRequest, db: Session = Depends(get_db)):
    mov = db.query(Movement).filter(Movement.id == movement_id).first()
    if not mov:
        raise HTTPException(status_code=404, detail="Registro de préstamo no encontrado")

    if mov.status == "DEVUELTO":
        raise HTTPException(status_code=400, detail="Este préstamo ya ha sido registrado como devuelto previamente.")

    now = datetime.datetime.utcnow()
    mov.status = "DEVUELTO"
    mov.return_date = now
    mov.return_condition = payload.return_condition
    mov.return_notes = payload.return_notes

    # Actualizar estado del equipo
    eq = mov.equipment
    if eq:
        eq.status = payload.new_equipment_status or "DISPONIBLE"
        eq.condition = payload.return_condition

    db.commit()
    return {
        "message": f"Devolución del equipo '{eq.name if eq else (mov.equipment_name_snap or '')}' registrada exitosamente",
        "movement": mov.to_dict()
    }


# --- Exportación a CSV / Excel ---

@router.get("/export/csv")
def export_csv(type: str = Query("equipment", enum=["equipment", "movements"]), db: Session = Depends(get_db)):
    output = io.StringIO()
    writer = csv.writer(output)

    if type == "equipment":
        writer.writerow(["ID", "Código", "Nombre", "Categoría", "Marca", "Modelo", "Nro Serie", "Ubicación", "Estado", "Condición", "Valor Estimado", "Notas", "Fecha Registro"])
        equipments = db.query(Equipment).all()
        for eq in equipments:
            writer.writerow([
                eq.id, eq.code, eq.name, eq.category, eq.brand, eq.model,
                eq.serial_number, eq.location, eq.status, eq.condition,
                eq.value, eq.notes, eq.created_at.strftime("%Y-%m-%d %H:%M") if eq.created_at else ""
            ])
        filename = f"inventario_equipos_{datetime.date.today()}.csv"

    else:
        writer.writerow(["ID", "Código Equipo", "Nombre Equipo", "ID Empleado", "Empleado Responsable", "Tipo", "Estado", "Fecha Salida", "Fecha Estimada Retorno", "Fecha Devolución Real", "Condición Entrega", "Condición Retorno", "Proyecto / Destino", "Notas"])
        movements = db.query(Movement).order_by(Movement.id.desc()).all()
        for m in movements:
            eq_code = m.equipment.code if m.equipment else (m.equipment_code_snap or "ELIMINADO")
            eq_name = m.equipment.name if m.equipment else (m.equipment_name_snap or "Equipo desincorporado")
            emp_doc = m.employee.doc_id if m.employee else (m.employee_doc_snap or "")
            emp_name = m.employee.full_name if m.employee else (m.employee_name_snap or "Sistema")
            writer.writerow([
                m.id,
                eq_code,
                eq_name,
                emp_doc,
                emp_name,
                m.movement_type,
                m.status,
                m.checkout_date.strftime("%Y-%m-%d %H:%M") if m.checkout_date else "",
                m.expected_return_date.strftime("%Y-%m-%d %H:%M") if m.expected_return_date else "",
                m.return_date.strftime("%Y-%m-%d %H:%M") if m.return_date else "",
                m.checkout_condition,
                m.return_condition or "",
                m.destination_project,
                f"{m.checkout_notes} | {m.return_notes}".strip(" |")
            ])
        filename = f"historial_movimientos_{datetime.date.today()}.csv"

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# --- Endpoints de Autenticación y Control de Acceso ---

@router.post("/auth/login")
def auth_login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    clean_user = payload.username.strip()
    user = db.query(User).filter(func.lower(User.username) == clean_user.lower()).first()
    
    if not user or not user.verify_password(payload.password):
        raise HTTPException(status_code=400, detail="Usuario o contraseña incorrectos.")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Esta cuenta de usuario ha sido desactivada.")
    
    token = create_user_session(db, user)
    
    # Establecer Cookie segura HTTP-Only
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=7 * 24 * 3600,
        samesite="lax",
        path="/"
    )
    
    return {
        "message": f"Bienvenido, {user.full_name or user.username}",
        "user": user.to_dict(),
        "token": token
    }


@router.post("/auth/logout")
def auth_logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = extract_session_token(request)
    if token:
        delete_user_session(db, token)
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"message": "Sesión cerrada correctamente"}


@router.get("/auth/me")
def auth_me(current_user: Optional[User] = Depends(get_current_user_optional)):
    if not current_user:
        return {"authenticated": False, "user": None}
    return {
        "authenticated": True,
        "user": current_user.to_dict()
    }


# --- Endpoints de Gestión de Usuarios (Exclusivo Administrador) ---

@router.get("/users")
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id.asc()).all()
    return [u.to_dict() for u in users]


@router.post("/users")
def create_user(payload: UserCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    clean_username = payload.username.strip().lower()
    if not clean_username:
        raise HTTPException(status_code=400, detail="El nombre de usuario no puede estar vacío.")
    
    if len(payload.password) < 4:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 4 caracteres.")

    exists = db.query(User).filter(func.lower(User.username) == clean_username).first()
    if exists:
        raise HTTPException(status_code=400, detail=f"El nombre de usuario '{payload.username}' ya está registrado.")
    
    role = payload.role if payload.role in ["admin", "operador"] else "operador"
    
    new_user = User(
        username=clean_username,
        full_name=payload.full_name.strip() if payload.full_name else clean_username,
        role=role,
        is_active=True
    )
    new_user.set_password(payload.password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "message": f"Usuario '{new_user.username}' creado con éxito.",
        "user": new_user.to_dict()
    }


@router.put("/users/{user_id}")
def update_user(user_id: int, payload: UserUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    
    # Proteger cuenta principal adminzaher de desactivación o cambio de rol
    if user.username == "adminzaher":
        if payload.is_active is False:
            raise HTTPException(status_code=400, detail="No se puede desactivar la cuenta principal de Administrador.")
        if payload.role and payload.role != "admin":
            raise HTTPException(status_code=400, detail="No se puede cambiar el rol de la cuenta principal de Administrador.")

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.role is not None and payload.role in ["admin", "operador"]:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password and payload.password.strip():
        if len(payload.password.strip()) < 4:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 4 caracteres.")
        user.set_password(payload.password.strip())
        
    db.commit()
    db.refresh(user)
    return {
        "message": f"Usuario '{user.username}' actualizado con éxito.",
        "user": user.to_dict()
    }


@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    
    if user.username == "adminzaher":
        raise HTTPException(status_code=400, detail="La cuenta principal de Administrador ('adminzaher') no puede ser eliminada.")
        
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta en uso.")
    
    db.delete(user)
    db.commit()
    return {"message": f"Usuario '{user.username}' eliminado correctamente."}


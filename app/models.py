import datetime
import hashlib
import os
import secrets
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    salt = Column(String(64), nullable=False)
    full_name = Column(String(150), default="")
    role = Column(String(50), default="operador")  # admin, operador
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relación con sesiones
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")

    @staticmethod
    def hash_password(password: str, salt: str = None) -> tuple[str, str]:
        if not salt:
            salt = secrets.token_hex(16)
        pwd_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            100_000
        ).hex()
        return pwd_hash, salt

    def set_password(self, password: str):
        pwd_hash, salt = self.hash_password(password)
        self.password_hash = pwd_hash
        self.salt = salt

    def verify_password(self, password: str) -> bool:
        if not self.password_hash or not self.salt:
            return False
        pwd_hash, _ = self.hash_password(password, self.salt)
        return secrets.compare_digest(self.password_hash, pwd_hash)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "full_name": self.full_name or self.username,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M") if self.created_at else ""
        }


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(100), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="sessions")

    @property
    def is_expired(self):
        return datetime.datetime.utcnow() > self.expires_at



class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False, index=True)
    category = Column(String(100), default="Herramientas Generales", index=True)
    brand = Column(String(100), default="")
    model = Column(String(100), default="")
    serial_number = Column(String(100), default="")
    location = Column(String(150), default="Almacén Principal")
    status = Column(String(50), default="DISPONIBLE", index=True)  # DISPONIBLE, EN_USO, MANTENIMIENTO, DANADO, BAJA
    condition = Column(String(50), default="Bueno")  # Excelente, Bueno, Regular, Requiere Revisión
    value = Column(Float, default=0.0)
    notes = Column(Text, default="")
    image_url = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relación con movimientos
    movements = relationship("Movement", back_populates="equipment")

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "category": self.category,
            "brand": self.brand,
            "model": self.model,
            "serial_number": self.serial_number,
            "location": self.location,
            "status": self.status,
            "condition": self.condition,
            "value": self.value,
            "notes": self.notes,
            "image_url": self.image_url,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M") if self.created_at else "",
            "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M") if self.updated_at else ""
        }


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(String(50), unique=True, index=True, nullable=False) # Cédula / DNI / ID
    full_name = Column(String(150), nullable=False, index=True)
    role = Column(String(100), default="Técnico")
    department = Column(String(100), default="Operaciones")
    phone = Column(String(50), default="")
    email = Column(String(100), default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relación con movimientos
    movements = relationship("Movement", back_populates="employee")

    def to_dict(self):
        return {
            "id": self.id,
            "doc_id": self.doc_id,
            "full_name": self.full_name,
            "role": self.role,
            "department": self.department,
            "phone": self.phone,
            "email": self.email,
            "is_active": self.is_active,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M") if self.created_at else ""
        }


class Movement(Base):
    __tablename__ = "movements"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="SET NULL"), nullable=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Instantáneas (snapshots) para preservar historial permanente
    equipment_code_snap = Column(String(50), nullable=True)
    equipment_name_snap = Column(String(150), nullable=True)
    equipment_category_snap = Column(String(100), nullable=True)
    employee_name_snap = Column(String(150), nullable=True)
    employee_doc_snap = Column(String(50), nullable=True)

    movement_type = Column(String(50), default="PRESTAMO")  # PRESTAMO, MANTENIMIENTO, ALTA_INVENTARIO, BAJA_INVENTARIO
    status = Column(String(50), default="ACTIVO", index=True)  # ACTIVO, DEVUELTO, ATRASADO
    
    checkout_date = Column(DateTime, default=datetime.datetime.utcnow)
    expected_return_date = Column(DateTime, nullable=True)
    return_date = Column(DateTime, nullable=True)
    
    checkout_condition = Column(String(50), default="Bueno")
    return_condition = Column(String(50), nullable=True)
    
    checkout_notes = Column(Text, default="")
    return_notes = Column(Text, default="")
    destination_project = Column(String(150), default="General")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relaciones
    equipment = relationship("Equipment", back_populates="movements")
    employee = relationship("Employee", back_populates="movements")

    @property
    def is_overdue(self):
        if self.status == "ACTIVO" and self.expected_return_date:
            return datetime.datetime.utcnow() > self.expected_return_date
        return False

    def to_dict(self):
        eq_code = self.equipment.code if self.equipment else (self.equipment_code_snap or "ELIMINADO")
        eq_name = self.equipment.name if self.equipment else (self.equipment_name_snap or "Equipo desincorporado")
        eq_cat = self.equipment.category if self.equipment else (self.equipment_category_snap or "")
        
        emp_name = self.employee.full_name if self.employee else (self.employee_name_snap or "Sistema / Administrador")
        emp_doc = self.employee.doc_id if self.employee else (self.employee_doc_snap or "")
        emp_dept = self.employee.department if self.employee else ""

        return {
            "id": self.id,
            "equipment_id": self.equipment_id,
            "equipment_code": eq_code,
            "equipment_name": eq_name,
            "equipment_category": eq_cat,
            "is_equipment_deleted": self.equipment is None,
            "employee_id": self.employee_id,
            "employee_name": emp_name,
            "employee_doc": emp_doc,
            "employee_dept": emp_dept,
            "is_employee_deleted": self.employee is None and bool(self.employee_name_snap and self.employee_name_snap != "Administrador / Sistema"),
            "movement_type": self.movement_type,
            "status": "ATRASADO" if self.is_overdue else self.status,
            "is_overdue": self.is_overdue,
            "checkout_date": self.checkout_date.strftime("%Y-%m-%d %H:%M") if self.checkout_date else "",
            "expected_return_date": self.expected_return_date.strftime("%Y-%m-%d %H:%M") if self.expected_return_date else "",
            "return_date": self.return_date.strftime("%Y-%m-%d %H:%M") if self.return_date else "",
            "checkout_condition": self.checkout_condition,
            "return_condition": self.return_condition or "",
            "checkout_notes": self.checkout_notes or "",
            "return_notes": self.return_notes or "",
            "destination_project": self.destination_project or "General"
        }

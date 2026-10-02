import datetime
from sqlalchemy.orm import Session
from .models import Equipment, Employee, Movement, User

def init_admin_user(db: Session):
    admin = db.query(User).filter(User.username == "adminzaher").first()
    if not admin:
        new_admin = User(
            username="adminzaher",
            full_name="Administrador Zaherca",
            role="admin",
            is_active=True
        )
        new_admin.set_password("zaherclave2026")
        db.add(new_admin)
        db.commit()
        print("[AUTH] Usuario administrador 'adminzaher' inicializado con éxito.")

def init_db_data(db: Session):
    init_admin_user(db)

    # No re-crear datos de prueba para permitir inventario limpio
    if db.query(Employee).first() is not None:
        return

    # Empleados iniciales
    employees = [
        Employee(
            doc_id="EMP-101",
            full_name="Carlos Mendoza",
            role="Técnico de Mantenimiento",
            department="Mantenimiento",
            phone="+1 809 555 0192",
            email="carlos.mendoza@empresa.com"
        ),
        Employee(
            doc_id="EMP-102",
            full_name="Pedro Gómez",
            role="Electricista Industrial",
            department="Instalaciones Eléctricas",
            phone="+1 809 555 0144",
            email="pedro.gomez@empresa.com"
        ),
        Employee(
            doc_id="EMP-103",
            full_name="Laura Rodríguez",
            role="Supervisora de Obras",
            department="Construcción",
            phone="+1 809 555 0188",
            email="laura.rodriguez@empresa.com"
        ),
        Employee(
            doc_id="EMP-104",
            full_name="Andrés Morales",
            role="Mecánico Automotriz / Pesado",
            department="Taller Mecánico",
            phone="+1 809 555 0123",
            email="andres.morales@empresa.com"
        )
    ]
    for emp in employees:
        db.add(emp)
    db.commit()

    # Herramientas y Equipos iniciales
    equipments = [
        Equipment(
            code="H-MKT-08",
            name="Taladro Percutor Inalámbrico 18V",
            category="Herramientas Eléctricas",
            brand="Makita",
            model="DHP484Z",
            serial_number="MK-2023-8891",
            location="Almacén Central - Estante A1",
            status="EN_USO",
            condition="Excelente",
            value=220.00,
            notes="Incluye 2 baterías de 5Ah y cargador rápido."
        ),
        Equipment(
            code="H-BOS-04",
            name="Sierra Circular de Mano 7-1/4\"",
            category="Herramientas Eléctricas",
            brand="Bosch",
            model="GKS 150",
            serial_number="BS-4412-901",
            location="Almacén Central - Estante A2",
            status="DISPONIBLE",
            condition="Bueno",
            value=165.00,
            notes="Disco de corte para madera de 24 dientes instalado."
        ),
        Equipment(
            code="H-DEW-12",
            name="Esmeriladora Angular 4-1/2\" 900W",
            category="Herramientas Eléctricas",
            brand="DeWalt",
            model="DWE4120",
            serial_number="DW-8871-332",
            location="Almacén Central - Estante A3",
            status="EN_USO",
            condition="Bueno",
            value=115.00,
            notes="Guarda protectora y llave de ajuste incluidas."
        ),
        Equipment(
            code="M-FLU-01",
            name="Multímetro Digital True RMS",
            category="Equipos de Medición",
            brand="Fluke",
            model="117",
            serial_number="FLK-998-1002",
            location="Gabinete de Precisión - Cajón 1",
            status="DISPONIBLE",
            condition="Excelente",
            value=290.00,
            notes="Calibrado recientemente. Incluye sondas TL75."
        ),
        Equipment(
            code="M-LEI-03",
            name="Nivel Láser Autonivelante 360°",
            category="Equipos de Medición",
            brand="Leica",
            model="Lino L2P5",
            serial_number="LCA-774-0019",
            location="Gabinete de Precisión - Cajón 2",
            status="DISPONIBLE",
            condition="Excelente",
            value=450.00,
            notes="Incluye trípode y estuche de transporte de alto impacto."
        ),
        Equipment(
            code="H-MIL-101",
            name="Martillo Demoledor SDS-Max 1500W",
            category="Maquinaria y Demolición",
            brand="Milwaukee",
            model="Kango 900S",
            serial_number="MW-6621-998",
            location="Bodega Pesada - Pallet 3",
            status="MANTENIMIENTO",
            condition="Regular",
            value=850.00,
            notes="Enviado a revisión por vibración anormal en empuñadura."
        ),
        Equipment(
            code="S-PRO-07",
            name="Arnés de Seguridad con Línea de Vida",
            category="Seguridad Industrial",
            brand="Protecta",
            model="PRO-FullBody",
            serial_number="PRT-4401-2",
            location="Armario de Seguridad",
            status="DISPONIBLE",
            condition="Excelente",
            value=95.00,
            notes="Inspección de cintas y costuras al día."
        )
    ]
    for eq in equipments:
        db.add(eq)
    db.commit()

    # Movimientos / Préstamos de ejemplo (uno activo a tiempo y uno atrasado para ver la alerta)
    now = datetime.datetime.utcnow()
    mov1 = Movement(
        equipment_id=equipments[0].id,  # Taladro Makita
        employee_id=employees[1].id,    # Pedro Gómez
        movement_type="PRESTAMO",
        status="ACTIVO",
        checkout_date=now - datetime.timedelta(days=1),
        expected_return_date=now + datetime.timedelta(days=2),
        checkout_condition="Excelente",
        destination_project="Instalación Planta Norte",
        checkout_notes="Préstamo para montaje de bandejas eléctricas."
    )
    
    mov2 = Movement(
        equipment_id=equipments[2].id,  # Esmeriladora DeWalt
        employee_id=employees[0].id,    # Carlos Mendoza
        movement_type="PRESTAMO",
        status="ACTIVO",
        checkout_date=now - datetime.timedelta(days=4),
        expected_return_date=now - datetime.timedelta(days=1), # Atrasado a propósito
        checkout_condition="Bueno",
        destination_project="Reparación Estructura Metálica",
        checkout_notes="Urgente para corte de perfiles."
    )

    db.add(mov1)
    db.add(mov2)
    db.commit()

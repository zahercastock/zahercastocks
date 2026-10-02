import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Si existe una variable de entorno DATABASE_URL (usada en la nube), la usa; sino usa SQLite local.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./inventory.db")

# Ajuste para compatibilidad con Postgres en Render/Heroku si la URL empieza con postgres://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from sqlalchemy import Column, String
from app.database import Base

class JobRole(Base):
    __tablename__ = "job_roles"

    job_role_code = Column(String, primary_key=True)
    job_role_text = Column(String)
    description = Column(String)

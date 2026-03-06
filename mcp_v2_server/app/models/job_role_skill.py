from sqlalchemy import Column, String
from app.database import Base

class JobRoleSkill(Base):
    __tablename__ = "job_role_skills"

    id = Column(String, primary_key=True)

    job_role_code = Column(String)
    job_role_text = Column(String)

    skill_id = Column(String)
    proficiency = Column(String)
    criticality = Column(String)

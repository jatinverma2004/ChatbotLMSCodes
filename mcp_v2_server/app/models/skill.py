from sqlalchemy import Column, String
from app.database import Base

class Skill(Base):
    __tablename__ = "skills_master"

    skill_id = Column(String, primary_key=True)
    skill_name = Column(String, unique=True)
    skill_type = Column(String)

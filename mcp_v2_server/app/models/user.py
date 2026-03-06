from sqlalchemy import Column, String, Date
from app.database import Base

class UserProfile(Base):
    __tablename__ = "user_profiles"

    uid = Column(String, primary_key=True)
    emp_code = Column(String)
    employee_name = Column(String)

    job_role_code = Column(String)
    job_role_text = Column(String)

    date_of_joining = Column(Date)

    org_unit_text = Column(String)
    job_work_area = Column(String)
    job_work_stream = Column(String)
    function_text = Column(String)
    sub_function_text = Column(String)

    job_grade_family = Column(String)
    sub_job_grade_family = Column(String)

    company_text = Column(String)
    state = Column(String)
    region = Column(String)
    facility = Column(String)

    category_l1_name = Column(String)
    l1_emp_code = Column(String)

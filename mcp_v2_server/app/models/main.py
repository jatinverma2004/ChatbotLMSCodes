from fastapi import FastAPI
from app.database import Base, engine
from app.models import *

app = FastAPI(title="MCP V2 Server")

Base.metadata.create_all(bind=engine)

@app.get("/")
def home():
    return {"status": "MCP V2 Server Running"}

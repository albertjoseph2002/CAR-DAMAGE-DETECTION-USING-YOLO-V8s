from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str

class ProjectCreate(BaseModel):
    make: str
    model: str
    year: str

class ProjectAnalysisSave(BaseModel):
    image_path: str
    damages: List[str]
    estimates: dict
    timestamp: datetime = Field(default_factory=datetime.utcnow)

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str = "user"

class ProjectCreate(BaseModel):
    projectName: Optional[str] = None
    make: str
    model: str
    year: str
    number_plate: str

class ProjectAnalysisSave(BaseModel):
    image_path: str
    media_type: str = "image"
    damages: List[str]
    estimates: dict
    timestamp: datetime = Field(default_factory=datetime.utcnow)

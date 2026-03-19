from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from utils.auth import SECRET_KEY, ALGORITHM, create_access_token, get_password_hash
from routers.db_config import db
from datetime import timedelta
from utils.auth import ACCESS_TOKEN_EXPIRE_MINUTES
from bson import ObjectId
from fastapi.security import OAuth2PasswordBearer

# Admin Credentials
ADMIN_EMAIL = "admin@123"
ADMIN_PASSWORD = "12345678"

router = APIRouter(prefix="/api/admin", tags=["admin"])

class AdminLogin(BaseModel):
    email: str
    password: str

# Define a custom oauth2 scheme for admin, if desired, or just reuse the bearer token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/admin/login")

async def get_current_admin(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate admin credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id != "admin":
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return {"id": "admin", "role": "admin"}


@router.post("/login")
async def login_admin(creds: AdminLogin):
    if creds.email != ADMIN_EMAIL or creds.password != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect admin email or password",
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": "admin"}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/metrics")
async def get_admin_metrics(admin: dict = Depends(get_current_admin)):
    users_count = await db.users.count_documents({})
    projects_count = await db.projects.count_documents({})
    return {"total_users": users_count, "total_projects": projects_count}

@router.get("/users")
async def get_all_users(admin: dict = Depends(get_current_admin)):
    users_cursor = db.users.find({})
    users = await users_cursor.to_list(length=1000)
    for u in users:
        u["id"] = str(u["_id"])
        del u["_id"]
        if "password" in u:
            del u["password"]
    return users

class AdminUserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str

@router.post("/users")
async def create_user_by_admin(user: AdminUserCreate, admin: dict = Depends(get_current_admin)):
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user.dict()
    user_dict["password"] = get_password_hash(user.password)
    result = await db.users.insert_one(user_dict)
    
    created_user = await db.users.find_one({"_id": result.inserted_id})
    return {"id": str(created_user["_id"]), "message": "User created successfully"}

class AdminUserUpdate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr

@router.put("/users/{user_id}")
async def update_user_by_admin(user_id: str, user_update: AdminUserUpdate, admin: dict = Depends(get_current_admin)):
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid User ID")
        
    result = await db.users.update_one(
        {"_id": obj_id},
        {"$set": user_update.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User updated successfully"}

@router.delete("/users/{user_id}")
async def delete_user_by_admin(user_id: str, admin: dict = Depends(get_current_admin)):
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid User ID")
        
    # Delete the user
    result = await db.users.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cascade delete their projects
    await db.projects.delete_many({"user_id": user_id})
    return {"message": "User and their projects deleted successfully"}

@router.get("/projects")
async def get_all_projects(admin: dict = Depends(get_current_admin)):
    # To get user details alongside projects, we will fetch users into a dict first
    users_cursor = db.users.find({})
    users = await users_cursor.to_list(length=1000)
    user_map = {str(u["_id"]): u.get("email", "Unknown") for u in users}

    projects_cursor = db.projects.find({})
    projects = await projects_cursor.to_list(length=1000)
    
    for p in projects:
        p["id"] = str(p["_id"])
        del p["_id"]
        # Attach user email for the admin dashboard view
        p["user_email"] = user_map.get(p.get("user_id"), "Unknown User")
    
    return projects

@router.delete("/projects/{project_id}")
async def delete_project_by_admin(project_id: str, admin: dict = Depends(get_current_admin)):
    try:
        obj_id = ObjectId(project_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid Project ID")
        
    result = await db.projects.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return {"message": "Project deleted successfully"}

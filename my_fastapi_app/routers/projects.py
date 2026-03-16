from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from models.schemas import ProjectCreate, ProjectAnalysisSave
from routers.db_config import db
from utils.dependencies import get_current_user
from bson import ObjectId

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.post("")
async def create_project(project: ProjectCreate, current_user: dict = Depends(get_current_user)):
    project_dict = project.dict()
    project_dict["user_id"] = current_user["id"]
    project_dict["analyzed_images"] = [] # Initialize empty list for saved images
    
    result = await db.projects.insert_one(project_dict)
    
    # Remove the ObjectId so JSON serialization doesn't fail
    if "_id" in project_dict:
        del project_dict["_id"]
        
    return {"id": str(result.inserted_id), **project_dict}

@router.get("")
async def get_projects(current_user: dict = Depends(get_current_user)):
    projects_cursor = db.projects.find({"user_id": current_user["id"]})
    projects = await projects_cursor.to_list(length=100)
    
    # Convert ObjectId to string for JSON serialization
    for proj in projects:
        proj["id"] = str(proj["_id"])
        del proj["_id"]
        
    return projects

@router.get("/{project_id}")
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    try:
        project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    except:
        raise HTTPException(status_code=400, detail="Invalid project ID")
        
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    project["id"] = str(project["_id"])
    del project["_id"]
    return project

@router.delete("/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    try:
        result = await db.projects.delete_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"status": "success", "message": "Project deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid project ID")

@router.post("/{project_id}/save_analysis")
async def save_project_analysis(project_id: str, analysis: ProjectAnalysisSave, current_user: dict = Depends(get_current_user)):
    try:
        project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    except:
        raise HTTPException(status_code=400, detail="Invalid project ID")
        
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    analysis_dict = analysis.dict()
    
    # Push the new analysis to the project's analyzed_images array
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$push": {"analyzed_images": analysis_dict}}
    )
    
    return {"status": "success", "message": "Analysis saved to project"}

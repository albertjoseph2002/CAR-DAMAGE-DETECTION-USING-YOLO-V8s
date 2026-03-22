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

@router.delete("/{project_id}/analysis/{index}")
async def delete_project_analysis(project_id: str, index: int, current_user: dict = Depends(get_current_user)):
    try:
        project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    except:
        raise HTTPException(status_code=400, detail="Invalid project ID")
        
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # To delete by index in an array, we first unset the element at that index, then pull nulls.
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$unset": {f"analyzed_images.{index}": 1}}
    )
    
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$pull": {"analyzed_images": None}}
    )
    
    return {"status": "success", "message": "Analysis deleted"}

@router.get("/{project_id}/statistics")
async def get_project_statistics(project_id: str, current_user: dict = Depends(get_current_user)):
    try:
        project = await db.projects.find_one({"_id": ObjectId(project_id), "user_id": current_user["id"]})
    except:
        raise HTTPException(status_code=400, detail="Invalid project ID")
        
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    all_classes = [
        'Headlight-Damage', 'RunningBoard-Dent', 'Sidemirror-Damage', 'Taillight-Damage',
        'Windscreen-Damage', 'bonnet-dent', 'boot-dent', 'doorouter-dent',
        'fender-dent', 'front-bumper-dent', 'quaterpanel-dent', 'rear-bumper-dent', 'roof-dent'
    ]
    
    damage_counts = {cls: 0 for cls in all_classes}
    total_damages_found = 0
    
    for scan in project.get("analyzed_images", []):
        for damage in scan.get("damages", []):
            found = False
            for cls in damage_counts.keys():
                if cls.lower() == damage.lower():
                    damage_counts[cls] += 1
                    total_damages_found += 1
                    found = True
                    break
            if not found:
                damage_counts[damage] = damage_counts.get(damage, 0) + 1
                total_damages_found += 1
                
    return {
        "damage_counts": damage_counts,
        "total_damages": total_damages_found,
        "total_classes": len(all_classes)
    }

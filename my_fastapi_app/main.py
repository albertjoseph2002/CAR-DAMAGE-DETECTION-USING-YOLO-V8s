import os
import io
import uvicorn
import numpy as np
import nest_asyncio
from enum import Enum
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import cv2
from typing import List
from numpy import ndarray
from typing import List, Dict
from PIL import Image
import base64
from fastapi import Response, Body
from detection import Detection
import google.generativeai as genai
import json
import os
from routers.auth import router as auth_router, user_router
from routers.projects import router as projects_router
from routers.admin import router as admin_router
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Gemini
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("WARNING: GEMINI_API_KEY not found in .env")

genai.configure(api_key=api_key)
generation_config = {
  "temperature": 0.2,
  "top_p": 0.95,
  "top_k": 40,
  "max_output_tokens": 8192,
  "response_mime_type": "application/json",
}
gemini_model = genai.GenerativeModel(
  model_name="gemini-3.1-flash-lite-preview",
  generation_config=generation_config,
)

# Initialize Detection
# Load class names from `app.yaml` so the model output matches what it was trained on.
# If `app.yaml` is missing or malformed, fall back to a small default set.
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Load model weights
best_pt_path = os.path.join(repo_root, "best.pt")
print(f"Loading YOLO model from: {best_pt_path}")

# Load class name mapping from config
classes = [
    'Headlight-Damage', 'RunningBoard-Dent', 'Sidemirror-Damage', 'Taillight-Damage',
    'Windscreen-Damage', 'bonnet-dent', 'boot-dent', 'doorouter-dent',
    'fender-dent', 'front-bumper-dent', 'quaterpanel-dent', 'rear-bumper-dent', 'roof-dent'
]
try:
    import yaml

    cfg_path = os.path.join(os.path.dirname(__file__), "app.yaml")
    with open(cfg_path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    names = cfg.get("names") or cfg.get("classes")
    if isinstance(names, dict):
        # Sort by numeric keys (as is common in YOLO YAML configs)
        classes = [names[k] for k in sorted(names, key=lambda x: int(x))]
    elif isinstance(names, list):
        classes = names
except Exception as e:
    print(f"Warning: could not load class names from app.yaml: {e}")

print(f"Using {len(classes)} classes: {classes[:5]}{'...' if len(classes) > 5 else ''}")

detection = Detection(
    model_path=best_pt_path,
    classes=classes
)

app = FastAPI()

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(projects_router)
app.include_router(admin_router)

# Mount static files
app.mount("/static", StaticFiles(directory="front end/user module"), name="static")
app.mount("/admin_static", StaticFiles(directory="front end/admin module"), name="admin_static")

@app.get("/")
async def read_index():
    return FileResponse('front end/index.html')

@app.get("/login")
async def read_login():
    return FileResponse('front end/login.html')

@app.get("/signup")
async def read_signup():
    return FileResponse('front end/signup.html')

@app.get("/user-module")
async def read_user_module():
    return FileResponse('front end/user module/home.html')

@app.get("/select_input")
async def read_select_input():
    return FileResponse('front end/user module/select_input.html')

@app.get("/detection_image")
async def read_detection_image():
    return FileResponse('front end/user module/detection_image.html')

@app.get("/detection_video")
async def read_detection_video():
    return FileResponse('front end/user module/detection_video.html')

@app.get("/detection_webcam")
async def read_detection_webcam():
    return FileResponse('front end/user module/detection_webcam.html')

@app.get("/home")
async def read_home():
    return FileResponse('front end/user module/home.html')

@app.get("/project-view")
async def read_project_view():
    return FileResponse('front end/user module/project-view.html')

@app.get("/create_project")
async def read_create_project():
    return FileResponse('front end/user module/create_project.html')

@app.get("/projects")
async def read_projects():
    return FileResponse('front end/user module/projects.html')

@app.get("/project-statistics")
async def read_project_statistics():
    return FileResponse('front end/user module/project-statistics.html')

@app.get("/generate_report")
async def read_generate_report():
    return FileResponse('front end/user module/generate_report.html')

@app.get("/admin/login")
async def read_admin_login():
    return FileResponse('front end/admin module/login.html')

@app.get("/admin/dashboard")
async def read_admin_dashboard():
    return FileResponse('front end/admin module/dashboard.html')

@app.post('/detection')
def post_detection(file: bytes = File(...)):
   image = Image.open(io.BytesIO(file)).convert("RGB")
   image = np.array(image)
   image = image[:,:,::-1].copy() # RGB to BGR
   # If we want to support webcam frame blob (which might come as multipart form data with 'file' field),
   # we might need to adjust. 
   # Actually the frontend sends 'file' in formData for webcam too.
   # But is it bytes or UploadFile?
   # The generic handler 'file: bytes = File(...)' works for both if we send it right.
   # However, frontend sends a Blob which behaves like a file.
   results = detection(image)
   return results

@app.post("/analyze")
async def analyze_car(files: List[UploadFile] = File(...)):
    results = {}
    
    # Process each file, assuming files are indexed 0, 1, 2... or use filename
    for i, file in enumerate(files):
        content = await file.read()
        image = Image.open(io.BytesIO(content)).convert("RGB")
        image = np.array(image)
        image = image[:,:,::-1].copy() # RGB to BGR
        
        # Run detection
        det_result = detection(image)
        
        # Use filename or index as key
        key = f"Image {i+1}" 
        results[key] = det_result
        
    return results

@app.post("/analyze_video")
async def analyze_video(file: UploadFile = File(...)):
    try:
        # Create temp directory for videos
        os.makedirs("front end/user module/videos", exist_ok=True)
        
        # Use .webm for better browser compatibility (VP8 codec)
        base_name = os.path.splitext(file.filename)[0]
        output_filename = f"output_{base_name}.webm"
        output_video_path = f"front end/user module/videos/{output_filename}"
        
        input_video_path = f"front end/user module/videos/input_{file.filename}"
        
        with open(input_video_path, "wb") as buffer:
            buffer.write(await file.read())
            
        cap = cv2.VideoCapture(input_video_path)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Could not open video file")
            
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        
        if width == 0 or height == 0:
             raise HTTPException(status_code=400, detail="Invalid video dimensions")

        # Define codec and create VideoWriter
        # VP80 (WebM) is widely supported by OpenCV and Browsers
        try:
            fourcc = cv2.VideoWriter_fourcc(*'vp80') 
        except:
            print("VP80 codec init failed")
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            output_filename = f"output_{base_name}.mp4"
            output_video_path = f"front end/user module/videos/{output_filename}"

        out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
        if not out.isOpened():
             # Try fallback to mp4v if vp80 failed to open writer (not just init)
             print("VideoWriter failed to open with VP80. Trying mp4v fallback.")
             fourcc = cv2.VideoWriter_fourcc(*'mp4v')
             output_filename = f"output_{base_name}.mp4"
             output_video_path = f"front end/user module/videos/{output_filename}"
             out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
             if not out.isOpened():
                 raise HTTPException(status_code=500, detail="Could not initialize VideoWriter")

        unique_damages = {} # {label: max_confidence}

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            # Run detection on frame
            try:
                # Detection class expects BGR image (it handles swapRB=True internally)
                results = detection(frame) 
                
                boxes = results['boxes']
                classes = results['classes']
                confidences = results['confidences']
                
                for i, box in enumerate(boxes):
                    x, y, w, h = box
                    label = classes[i]
                    conf = confidences[i]
                    
                    # Track unique damages
                    if label not in unique_damages or conf > unique_damages[label]:
                         unique_damages[label] = conf

                    # Draw rectangle
                    cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
                    
                    # Draw label: label + percentage
                    text = f"{label}: {conf:.0f}%"
                    
                    # Get text size
                    (text_width, text_height), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
                    
                    # Draw text background
                    cv2.rectangle(frame, (x, y - 20), (x + text_width, y), (0, 255, 0), -1)
                    
                    # Draw text
                    cv2.putText(frame, text, (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)
                    
            except Exception as e:
                print(f"Frame processing error: {e}")
                pass
            
            out.write(frame)
            
        cap.release()
        out.release()
        
        # Format summary for frontend
        summary_list = [{"label": k, "score": float(v)} for k, v in unique_damages.items()]
        
        return {"video_url": f"/static/videos/{output_filename}", "damage_summary": summary_list}

    except Exception as e:
        print(f"Error processing video: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload_webcam_video")
async def upload_webcam_video(file: UploadFile = File(...)):
    try:
        import uuid
        os.makedirs("front end/user module/videos", exist_ok=True)
        unique_id = str(uuid.uuid4())[:8]
        output_filename = f"webcam_{unique_id}.webm"
        output_video_path = f"front end/user module/videos/{output_filename}"
        
        with open(output_video_path, "wb") as buffer:
             buffer.write(await file.read())
             
        return {"video_url": f"/static/videos/{output_filename}"}
    except Exception as e:
        print(f"Error saving webcam video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload_pdf_report")
async def upload_pdf_report(file: UploadFile = File(...)):
    try:
        import uuid
        os.makedirs("front end/user module/reports", exist_ok=True)
        unique_id = str(uuid.uuid4())[:8]
        output_filename = f"report_{unique_id}.pdf"
        output_path = f"front end/user module/reports/{output_filename}"
        
        with open(output_path, "wb") as buffer:
             buffer.write(await file.read())
             
        return {"pdf_url": f"/static/reports/{output_filename}"}
    except Exception as e:
        print(f"Error saving PDF report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/estimate_prices")
async def estimate_prices(payload: dict = Body(...)):
    try:
        damages = payload.get("damages", [])
        make = payload.get("make", "Unknown")
        model = payload.get("model", "Unknown")
        year = payload.get("year", "Unknown")

        if not damages:
             return {"estimates": [], "total": "0"}

        prompt = f"""
        You are an expert auto parts appraiser. I have a {year} {make} {model} that has the following damaged parts detected: {', '.join(damages)}.
        Please provide a realistic estimated price range in Indian Rupees (INR) for replacing/repairing EACH part (consider both parts and labor), and a total estimated cost range.

        Format the response EXACTLY as this JSON structure:
        {{
            "estimates": [
                {{"part": "string", "cost": "string (e.g., ₹1000 - ₹2000)"}},
                ...
            ],
            "total": "string (e.g., ₹5000 - ₹8000)"
        }}
        """

        response = gemini_model.generate_content(prompt)
        # Parse the JSON response
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
        result_json = json.loads(raw_text.strip())
        return result_json
        
    except Exception as e:
        print(f"Error estimating prices: {str(e)}")
        import traceback
        traceback.print_exc()
        # Provide a graceful fallback to prevent frontend error display
        fallback_estimates = []
        for part in damages:
            fallback_estimates.append({"part": part, "cost": "Estimate unavailable (API error/quota limit)"})
        return {"estimates": fallback_estimates, "total": "N/A"}

if __name__ == '__main__':
    uvicorn.run("main:app", host="0.0.0.0", port=8080)


# 🚗 Smart Car Damage Detection and Analysis System

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-FF1493?style=for-the-badge&logo=yolo)](https://ultralytics.com/)
[![Gemini API](https://img.shields.io/badge/Gemini_AI-4285F4?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)

An end-to-end multi-modal web application powered by Deep Learning (YOLOv8) to detect various types of car damages (dents, scratches, broken parts) from images, recorded videos, and real-time webcam feeds. The system also integrates **Google Gemini AI** to automatically generate realistic repair cost estimates based on the identified damages, vehicle make, model, and year.

## ✨ Key Features

- **Multi-Modal Damage Detection**: Supports uploaded images, recorded videos (MP4/WebM), and live webcam analysis.
- **High-Accuracy Classification**: Capable of detecting up to 13 distinct classes of car damage (e.g., Headlight-Damage, Windscreen-Damage, bonnet-dent, doorouter-dent, etc.).
- **Smart Price Estimation**: Generates repair/replacement cost estimates using Google Gemini AI, tailored directly to the specific detected parts.
- **Comprehensive User & Admin Modules**: Includes user authentication, session management, and dedicated admin dashboards.
- **Workspace & Project Management**: Users can create individual projects for different cars, run analyses, and keep track of historical detection records and statistics.
- **Report Generation**: Automatically generates detailed PDF reports for insurance or repair quotes.

## 📊 Model Performance & Metrics

The custom-trained YOLOv8 model achieved outstanding results on the validation set across all 13 damage classes after 60 epochs of training:

- **Overall Precision (P)**: 96.6%
- **Overall Recall (R)**: 95.7%
- **mAP50**: 98.1%
- **mAP50-95**: 78.9%

**Inference Speed**: ~4.9ms per image.

*(Metrics evaluated on 885 validation images containing 1,418 instances)*

### Class-wise Performance (mAP50)
| Class | mAP50 | Class | mAP50 |
|---|---|---|---|
| Headlight-Damage | 98.3% | Doorouter-Dent | 98.7% |
| RunningBoard-Dent | 95.7% | Fender-Dent | 97.4% |
| Sidemirror-Damage | 99.5% | Front-bumper-Dent | 98.3% |
| Taillight-Damage | 99.5% | Quaterpanel-Dent | 97.3% |
| Windscreen-Damage | 99.2% | Rear-bumper-Dent | 96.6% |
| Bonnet-Dent | 99.0% | Roof-Dent | 98.8% |
| Boot-Dent | 96.9% | | |

## 🛠️ Technology Stack

- **Backend Architecture**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Computer Vision & AI**: [YOLOv8](https://github.com/ultralytics/ultralytics) (Ultralytics), OpenCV, Pillow
- **Generative AI**: [Google Gemini Pro API](https://aistudio.google.com/)
- **Frontend Layer**: HTML5, Vanilla CSS3, JavaScript (Vanilla)
- **Deployment Server**: Uvicorn

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites

- **Python 3.8+** installed on your system.
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/app/apikey).
- Pre-trained YOLOv8 weights (`best.pt` or `best.onnx`) inside the project repository.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/CAR-DAMAGE-DETECTION-USING-YOLO-V8s.git
   cd CAR-DAMAGE-DETECTION-USING-YOLO-V8s
   ```

2. **Create a virtual environment (Recommended):**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

3. **Install the required dependencies:**
   ```bash
   pip install fastapi uvicorn ultralytics opencv-python-headless python-multipart python-dotenv google-generativeai PyYAML Pillow nest_asyncio numpy
   ```

4. **Environment Setup:**
   Create a `.env` file inside the `my_fastapi_app` directory and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_google_gemini_api_key_here
   ```

### Running the Application

Start the FastAPI application via Uvicorn:

```bash
cd my_fastapi_app
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

Once the server says it's running, open your web browser and navigate to:
**[http://localhost:8080](http://localhost:8080)**

## 📂 Project Structure

```text
.
├── my_fastapi_app/
│   ├── main.py                # Core FastAPI server and endpoints
│   ├── detection.py           # YOLO image/video inferencing wrapper
│   ├── routers/               # Router modules for Auth, Admin, Projects
│   ├── models/                # Pydantic schemas and database logic
│   └── app.yaml               # YOLO class configuration file
├── front end/
│   ├── user module/           # Landing, Login, Dashboard, UI assets
│   └── admin module/          # Admin reporting, user tracking interfaces
├── best.pt / best.onnx        # YOLOv8 Custom Object Detection Weights
├── config.yaml                # Training / Configuration settings
└── README.md
```

## 🎮 How to Use

1. **Sign Up / Login**: Register a new user account or log in via the User Portal.
2. **Dashboard**: From the dashboard, navigate to "Create Project".
3. **Capture & Analyze**: Enter the details of your vehicle (Make, Model, Year). Choose an input method:
   - *Image Upload*: Upload photographs of the damaged car.
   - *Video Upload*: Upload a walkaround video.
   - *Webcam*: Use your device's camera for live detection.
4. **Get Cost Estimate**: Once the AI identifies the damage bounding boxes, hit the "Estimate Prices" button to fetch real-time financial estimates from the Gemini model.
5. **Download Report**: Convert your analytics summary into a clean PDF format.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to modify and enhance this project.

---

If you find this project helpful, please consider giving it a ⭐ on GitHub!

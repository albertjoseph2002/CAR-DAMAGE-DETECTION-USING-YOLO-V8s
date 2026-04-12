const generateSlotsBtn = document.getElementById('generateSlotsBtn');
const imageCountInput = document.getElementById('imageCount');
const uploadGrid = document.getElementById('uploadGrid');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const resultsSection = document.getElementById('results-section');
const reportGrid = document.getElementById('reportGrid');
const zoomOverlay = document.getElementById('zoomOverlay');
const zoomImage = document.getElementById('zoomImage');

// --- Project Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    let projectId = urlParams.get('project');
    const token = localStorage.getItem('token');

    if (!projectId) {
        projectId = localStorage.getItem('current_project');
    } else {
        localStorage.setItem('current_project', projectId);
    }

    if (projectId && token) {
        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const project = await response.json();
                const header = document.getElementById('projectHeader');
                const nameEl = document.getElementById('currentProjectName');
                const infoEl = document.getElementById('currentVehicleInfo');

                if (header && nameEl && infoEl) {
                    nameEl.textContent = project.name || `${project.year} ${project.make} ${project.model}`;
                    infoEl.textContent = `${project.year} ${project.make} ${project.model} | Plate: ${project.number_plate || 'N/A'}`;
                    header.style.display = 'block';
                }
            }
        } catch(error) {
            console.error("Error fetching project context:", error);
        }
    }
});
// ------------------------------

// Video elements
const videoUpload = document.getElementById('videoUpload');
const videoPreview = document.getElementById('videoPreview');
const videoPreviewContainer = document.querySelector('.video-preview-container');
const analyzeVideoBtn = document.getElementById('analyzeVideoBtn');
const videoResult = document.getElementById('videoResult');
const videoResultContainer = document.getElementById('videoResultContainer');
const downloadVideoLink = document.getElementById('downloadVideoLink');

// Webcam elements
const webcamVideo = document.getElementById('webcamVideo');
const webcamOverlay = document.getElementById('webcamOverlay');
const startWebcamBtn = document.getElementById('startWebcamBtn');
const stopWebcamBtn = document.getElementById('stopWebcamBtn');
const resetWebcamLogBtn = document.getElementById('resetWebcamLogBtn');

let currentFileCount = 0;
let uploadedFiles = {};
let webcamStream = null;
let webcamInterval = null;
let webcamDetectedDamages = new Set();
let mediaRecorder = null;
let recordedChunks = [];
let currentWebcamEstimates = null;

// ================= IMAGES LOGIC =================

if (imageCountInput && uploadGrid) {
    generateSlots(); // Init with defaults
    if (generateSlotsBtn) generateSlotsBtn.addEventListener('click', generateSlots);
}

function generateSlots() {
    const count = parseInt(imageCountInput.value);
    if (count < 1 || count > 5) {
        alert("Please choose between 1 and 5 images.");
        return;
    }

    currentFileCount = count;
    uploadedFiles = {};
    uploadGrid.innerHTML = '';
    reportGrid.innerHTML = '';
    resultsSection.style.display = 'none';
    analyzeBtn.disabled = true;

    for (let i = 0; i < count; i++) {
        createUploadCard(i);
    }
}

function createUploadCard(index) {
    const card = document.createElement('div');
    card.className = 'upload-card';
    const id = `img${index}`;

    card.innerHTML = `
        <h3>Image ${index + 1}</h3>
        <label for="${id}Upload" class="upload-label">
            <span id="${id}Text">Choose Image...</span>
            <input type="file" id="${id}Upload" accept="image/*">
        </label>
        <div class="preview-container">
            <img id="${id}Preview" class="preview-image" style="display: none;">
            <canvas id="${id}Canvas" class="result-canvas"></canvas>
        </div>
    `;

    uploadGrid.appendChild(card);

    const input = document.getElementById(`${id}Upload`);
    const text = document.getElementById(`${id}Text`);
    const preview = document.getElementById(`${id}Preview`);
    const canvas = document.getElementById(`${id}Canvas`);

    input.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            uploadedFiles[index] = file;
            text.textContent = file.name;

            const reader = new FileReader();
            reader.onload = (event) => {
                preview.src = event.target.result;
                preview.style.display = 'block';
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                checkAllFilesSelected();
            };
            reader.readAsDataURL(file);
        }
    });

    preview.onload = () => {
        canvas.width = preview.width;
        canvas.height = preview.height;
    };
}

function checkAllFilesSelected() {
    const keys = Object.keys(uploadedFiles);
    analyzeBtn.disabled = keys.length !== currentFileCount;
}

if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
        if (Object.keys(uploadedFiles).length !== currentFileCount) return;

        loading.style.display = 'block';
        analyzeBtn.disabled = true;
        resultsSection.style.display = 'none';

        for (let i = 0; i < currentFileCount; i++) {
            const canvas = document.getElementById(`img${i}Canvas`);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }

        const formData = new FormData();
        for (let i = 0; i < currentFileCount; i++) {
            formData.append('files', uploadedFiles[i]);
        }

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const report = await response.json();

            // Fetch auto parts price estimation FIRST
            let allDetectedClasses = new Set();
            for (let i = 0; i < currentFileCount; i++) {
                const key = `Image ${i + 1}`;
                if (report[key] && report[key].classes) {
                    report[key].classes.forEach(c => allDetectedClasses.add(c));
                }
            }
            
            let estimateData = null;
            if (allDetectedClasses.size > 0) {
                estimateData = await fetchAndDisplayPriceEstimate(Array.from(allDetectedClasses));
            }

            await generateReport(report, estimateData);

        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during analysis.');
        } finally {
            loading.style.display = 'none';
            analyzeBtn.disabled = false;
        }
    });
}

// ... Report generation & Helper functions (generateReport, drawBoxes, createReportImage, createReportCard) ...
// (Reusing existing helper functions here, copy-pasting for completeness)

async function generateReport(report, estimateData = null) {
    reportGrid.innerHTML = '';
    const projectId = localStorage.getItem('current_project');
    const token = localStorage.getItem('token');
    let savedToProject = false;
    
    for (let i = 0; i < currentFileCount; i++) {
        const key = `Image ${i + 1}`;
        const inputId = `img${i}`;
        if (report[key]) {

            const reportImageSrc = await createReportImage(inputId, report[key]);
            const card = createReportCard(key, report[key], reportImageSrc);
            reportGrid.appendChild(card);
            
            // Save to Backend if in a project
            if (projectId && token) {
                try {
                   const response = await fetch(`/api/projects/${projectId}/save_analysis`, {
                       method: 'POST',
                       headers: {
                           'Content-Type': 'application/json',
                           'Authorization': `Bearer ${token}`
                       },
                       body: JSON.stringify({
                           image_path: reportImageSrc, // base64 string
                           damages: report[key].classes || [],
                           estimates: estimateData || {} // Can be updated if cost is merged per image
                       })
                   });
                   
                   if (response.ok) {
                       savedToProject = true;
                   } else {
                       const err = await response.text();
                       console.error("Save analysis failed:", response.status, err);
                       alert("Failed to save analysis for " + key + ": " + err);
                   }
                } catch(e) { console.error("Could not save analysis", e); }
            }

            const imgContainer = card.querySelector('.report-image-container');
            const img = card.querySelector('.report-image');
            imgContainer.addEventListener('click', () => {
                zoomImage.src = img.src;
                zoomOverlay.style.display = 'flex';
            });
        }
    }
    
    if (savedToProject) {
       const alertBox = document.createElement('div');
       alertBox.style.padding = '10px';
       alertBox.style.backgroundColor = '#d1fae5';
       alertBox.style.color = '#065f46';
       alertBox.style.borderRadius = '6px';
       alertBox.style.marginBottom = '15px';
       alertBox.innerText = 'Analysis automatically saved to your Project history!';
       resultsSection.prepend(alertBox);
    }
    
    resultsSection.style.display = 'block';
}

function drawBoxes(elementIdPrefix, data) {
    const canvas = document.getElementById(`${elementIdPrefix}Canvas`);
    const preview = document.getElementById(`${elementIdPrefix}Preview`);
    if (!canvas || !preview) return; // Guard

    if (canvas.width !== preview.width || canvas.height !== preview.height) {
        canvas.width = preview.width;
        canvas.height = preview.height;
    }

    const ctx = canvas.getContext('2d');
    const boxes = data.boxes;
    const classes = data.classes;
    const confidences = data.confidences;

    ctx.lineWidth = 3;
    ctx.font = '16px Inter, sans-serif';

    boxes.forEach((box, i) => {
        const [x, y, w, h] = box;
        const label = classes[i];
        const score = confidences[i];
        ctx.strokeStyle = '#00FF00';
        ctx.strokeRect(x, y, w, h);
        const text = `${label} (${score.toFixed(1)}%)`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(x, y - 25, textWidth + 10, 25);
        ctx.fillStyle = '#000000';
        ctx.fillText(text, x + 5, y - 7);
    });
}

function createReportImage(elementIdPrefix, data) {
    return new Promise((resolve) => {
        const img = document.getElementById(`${elementIdPrefix}Preview`);
        const tempCanvas = document.createElement('canvas');

        // Use natural dimensions to get full resolution
        tempCanvas.width = img.naturalWidth;
        tempCanvas.height = img.naturalHeight;

        const ctx = tempCanvas.getContext('2d');

        // 1. Draw image at full size
        ctx.drawImage(img, 0, 0);

        // 2. Draw boxes directly (using original coordinates)
        if (data && data.boxes) {
            const boxes = data.boxes;
            const classes = data.classes;
            const confidences = data.confidences;

            ctx.lineWidth = 5; // Thicker lines for high-res image
            ctx.font = '24px Inter, sans-serif'; // Larger font

            boxes.forEach((box, i) => {
                const [x, y, w, h] = box;
                const label = classes[i];
                const score = confidences[i];

                // Draw Box
                ctx.strokeStyle = '#00FF00';
                ctx.strokeRect(x, y, w, h);

                const text = `${label} ${Math.round(score)}%`;
                const textWidth = ctx.measureText(text).width;

                ctx.fillStyle = '#00FF00';
                ctx.fillRect(x, y - 35, textWidth + 10, 35);
                ctx.fillStyle = '#000000';
                ctx.fillText(text, x + 5, y - 7);
            });
        }

        // Strongly compress the JPEG to avoid hitting database limits (MongoDB 16MB limit)
        resolve(tempCanvas.toDataURL('image/jpeg', 0.5));
    });
}

function createReportCard(title, data, imageSrc) {
    const card = document.createElement('div');
    card.className = 'report-card';
    const classes = data.classes;
    const confidences = data.confidences;

    let listItems = '';
    if (classes.length === 0) {
        listItems = '<li><span class="damage-label">No damage detected</span></li>';
    } else {
        classes.forEach((label, i) => {
            const score = confidences[i];
            listItems += `<li><span class="damage-label">${label}</span><span class="damage-score">Confidence: ${score.toFixed(1)}%</span></li>`;
        });
    }

    card.innerHTML = `<h3>${title}</h3><div class="report-image-container"><img src="${imageSrc}" class="report-image"></div><div class="report-details"><ul>${listItems}</ul></div>`;
    return card;
}

if (zoomOverlay) {
    zoomOverlay.addEventListener('click', () => {
        zoomOverlay.style.display = 'none';
    });
}


// ================= VIDEO LOGIC =================
if (videoUpload) {
    videoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        console.log("Video selected:", file);
        if (file) {
            const url = URL.createObjectURL(file);
            console.log("Video URL:", url);
            videoPreview.src = url;
            videoPreviewContainer.style.display = 'block';
            videoPreview.style.display = 'block'; // Ensure video itself is visible
            analyzeVideoBtn.disabled = false;
        }
    });

    analyzeVideoBtn.addEventListener('click', async () => {
        const file = videoUpload.files[0];
        if (!file) return;

        loading.style.display = 'block';
        analyzeVideoBtn.disabled = true;
        videoResultContainer.style.display = 'none';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/analyze_video', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Video processing failed');

            const data = await response.json();
            // Expecting: { video_url: "/static/videos/processed_...", damage_summary: [{label: str, score: float}] }

            videoResult.src = data.video_url;
            downloadVideoLink.href = data.video_url;

            // Generate Summary HTML
            let summaryHTML = '<h4>Detected Damages:</h4><ul class="video-damage-list">';
            if (data.damage_summary && data.damage_summary.length > 0) {
                data.damage_summary.forEach(item => {
                    summaryHTML += `
                        <li>
                            <span class="damage-label">${item.label}</span>
                            <span class="damage-score">Max Confidence: ${item.score.toFixed(1)}%</span>
                        </li>
                    `;
                });
            } else {
                summaryHTML += '<li>No significant damage detected.</li>';
            }
            summaryHTML += '</ul>';

            // Create or update summary container
            let summaryContainer = document.getElementById('videoDamageSummary');
            if (!summaryContainer) {
                summaryContainer = document.createElement('div');
                summaryContainer.id = 'videoDamageSummary';
                summaryContainer.className = 'report-details'; // Reuse styling
                videoResultContainer.appendChild(summaryContainer);
            }
            summaryContainer.innerHTML = summaryHTML;

            videoResultContainer.style.display = 'block';

            let estimateData = null;
            const detectedDamages = (data.damage_summary || []).map(item => item.label);
            if (detectedDamages.length > 0) {
                estimateData = await fetchAndDisplayPriceEstimate(detectedDamages);
            }

            const projectId = localStorage.getItem('current_project');
            const token = localStorage.getItem('token');
            if (projectId && token) {
                try {
                    const response = await fetch(`/api/projects/${projectId}/save_analysis`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            image_path: data.video_url,
                            media_type: 'video',
                            damages: detectedDamages,
                            estimates: estimateData || {}
                        })
                    });
                    
                    if (response.ok) {
                       // Remove any old alert before showing a new one
                       const oldAlert = document.getElementById('videoSaveAlert');
                       if (oldAlert) oldAlert.remove();
                       
                       const alertBox = document.createElement('div');
                       alertBox.id = 'videoSaveAlert';
                       alertBox.style.padding = '10px';
                       alertBox.style.backgroundColor = '#d1fae5';
                       alertBox.style.color = '#065f46';
                       alertBox.style.borderRadius = '6px';
                       alertBox.style.marginBottom = '15px';
                       alertBox.style.marginTop = '15px';
                       alertBox.innerText = 'Video Analysis automatically saved to your Project history!';
                       videoResultContainer.prepend(alertBox);
                    } else {
                        const errText = await response.text();
                        console.error("Failed to save video analysis:", response.status, errText);
                        alert("Failed to save video analysis: " + errText);
                    }
                } catch(e) { 
                    console.error("Could not save video analysis. Network or parsing error:", e); 
                    alert("Could not save video analysis. Check console.");
                }
            }

        } catch (error) {
            console.error(error);
            alert('Failed to process video.');
        } finally {
            loading.style.display = 'none';
            analyzeVideoBtn.disabled = false;
        }
    });
}

// ================= WEBCAM LOGIC =================
if (startWebcamBtn) {
    startWebcamBtn.addEventListener('click', startWebcam);
    stopWebcamBtn.addEventListener('click', stopWebcam);
}

if (resetWebcamLogBtn) {
    resetWebcamLogBtn.addEventListener('click', resetWebcamLog);
}

function resetWebcamLog() {
    webcamDetectedDamages.clear();
    const list = document.getElementById('webcamDamageList');
    if (list) list.innerHTML = '';
    const resultsContainer = document.getElementById('webcamResults');
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (resetWebcamLogBtn) resetWebcamLogBtn.style.display = 'none';
}

let recordingCanvas = null;
let recordingCtx = null;
let webcamAnimationFrame = null;

function renderWebcamFrame() {
    if (!webcamVideo || !webcamVideo.videoWidth || !webcamStream) {
        webcamAnimationFrame = requestAnimationFrame(renderWebcamFrame);
        return;
    }

    if (!recordingCanvas) {
        recordingCanvas = document.createElement('canvas');
        recordingCtx = recordingCanvas.getContext('2d');
    }

    if (recordingCanvas.width !== webcamVideo.videoWidth || recordingCanvas.height !== webcamVideo.videoHeight) {
        recordingCanvas.width = webcamVideo.videoWidth;
        recordingCanvas.height = webcamVideo.videoHeight;
    }

    recordingCtx.drawImage(webcamVideo, 0, 0, recordingCanvas.width, recordingCanvas.height);
    recordingCtx.drawImage(webcamOverlay, 0, 0, recordingCanvas.width, recordingCanvas.height);

    webcamAnimationFrame = requestAnimationFrame(renderWebcamFrame);
}

async function startWebcam() {
    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        webcamVideo.srcObject = webcamStream;
        startWebcamBtn.disabled = true;
        stopWebcamBtn.disabled = false;

        recordedChunks = [];
        currentWebcamEstimates = null;

        const startRecordingProcess = () => {
            if (!recordingCanvas) {
                recordingCanvas = document.createElement('canvas');
                recordingCtx = recordingCanvas.getContext('2d');
            }
            recordingCanvas.width = webcamVideo.videoWidth;
            recordingCanvas.height = webcamVideo.videoHeight;

            renderWebcamFrame();
            
            const canvasStream = recordingCanvas.captureStream(30);
            mediaRecorder = new MediaRecorder(canvasStream);
            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };
            mediaRecorder.start();
        };

        if (webcamVideo.readyState >= 1) {
            startRecordingProcess();
        } else {
            webcamVideo.onloadedmetadata = startRecordingProcess;
        }

        // Start detection loop
        webcamInterval = setInterval(captureAndDetect, 500); // 2 FPS to reduce load
    } catch (err) {
        console.error("Webcam error:", err);
        alert("Could not access webcam.");
    }
}

async function stopWebcam() {
    if (webcamInterval) {
        clearInterval(webcamInterval);
        webcamInterval = null;
    }

    if (webcamAnimationFrame) {
        cancelAnimationFrame(webcamAnimationFrame);
        webcamAnimationFrame = null;
    }

    const saveAndStopTracks = async () => {
        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            webcamVideo.srcObject = null;
            webcamStream = null;
        }

        // Fetch the price estimate ONCE for all detected damages when stopping the webcam
        if (webcamDetectedDamages.size > 0) {
            await fetchAndDisplayPriceEstimate(Array.from(webcamDetectedDamages));
        }

        // Handle saving
        if (webcamDetectedDamages.size > 0 && recordedChunks.length > 0) {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            await saveWebcamRecording(blob);
        }
    };

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.onstop = saveAndStopTracks;
        mediaRecorder.stop();
    } else {
        await saveAndStopTracks();
    }

    startWebcamBtn.disabled = false;
    stopWebcamBtn.disabled = true;

    // Clear overlay only, keep detection log
    const ctx = webcamOverlay.getContext('2d');
    ctx.clearRect(0, 0, webcamOverlay.width, webcamOverlay.height);
}

async function saveWebcamRecording(blob) {
    if (window.loading) loading.style.display = 'block';
    try {
        const formData = new FormData();
        formData.append('file', blob, 'webcam_record.webm');

        const uploadRes = await fetch('/upload_webcam_video', {
            method: 'POST',
            body: formData
        });

        if (!uploadRes.ok) throw new Error("Failed to upload webcam video");
        const data = await uploadRes.json();
        
        const projectId = localStorage.getItem('current_project');
        const token = localStorage.getItem('token');
        if (projectId && token) {
            const saveRes = await fetch(`/api/projects/${projectId}/save_analysis`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    image_path: data.video_url,
                    media_type: 'video',
                    damages: Array.from(webcamDetectedDamages),
                    estimates: currentWebcamEstimates || {}
                })
            });

            if (saveRes.ok) {
                const resultsContainer = document.getElementById('webcamResults');
                if (resultsContainer) {
                    const oldAlert = document.getElementById('webcamSaveAlert');
                    if (oldAlert) oldAlert.remove();
                    
                    const alertBox = document.createElement('div');
                    alertBox.id = 'webcamSaveAlert';
                    alertBox.style.padding = '10px';
                    alertBox.style.backgroundColor = '#d1fae5';
                    alertBox.style.color = '#065f46';
                    alertBox.style.borderRadius = '6px';
                    alertBox.style.marginBottom = '15px';
                    alertBox.style.marginTop = '15px';
                    alertBox.innerText = 'Webcam footage automatically saved to your Project history!';
                    resultsContainer.prepend(alertBox);
                } else {
                    alert("Webcam footage saved to project!");
                }
            } else {
                console.error("Failed to save webcam analysis:", await saveRes.text());
                alert("Failed to save webcam analysis to project.");
            }
        }
    } catch (e) {
        console.error("Error saving webcam recording:", e);
        alert("Failed to save webcam recording.");
    } finally {
        if (window.loading) loading.style.display = 'none';
    }
}

async function captureAndDetect() {
    if (!webcamStream || webcamVideo.videoWidth === 0 || webcamVideo.videoHeight === 0) return;

    const canvas = document.createElement('canvas'); // Temp canvas for capture
    canvas.width = webcamVideo.videoWidth;
    canvas.height = webcamVideo.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(webcamVideo, 0, 0, canvas.width, canvas.height);

    // Resize overlay to match video
    if (webcamOverlay.width !== canvas.width || webcamOverlay.height !== canvas.height) {
        webcamOverlay.width = canvas.width;
        webcamOverlay.height = canvas.height;
    }

    canvas.toBlob(async (blob) => {
        if (!webcamStream) return; // Stream stopped while blob was creating
        const formData = new FormData();
        formData.append('file', blob, 'webcam_frame.jpg');

        try {
            const response = await fetch('/detection', { // Reuse single image detection
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                const result = await response.json();
                if (webcamStream) { // Only draw if stream is still active
                    drawWebcamOverlay(result);
                }
            }
        } catch (e) {
            console.error("Frame detection error", e);
        }
    }, 'image/jpeg');
}

function drawWebcamOverlay(data) {
    const ctx = webcamOverlay.getContext('2d');
    ctx.clearRect(0, 0, webcamOverlay.width, webcamOverlay.height);

    const boxes = data.boxes;
    const classes = data.classes;
    const confidences = data.confidences;

    ctx.lineWidth = 3;
    ctx.font = '18px Inter, sans-serif';

    // Show list if hidden
    const resultsContainer = document.getElementById('webcamResults');
    const list = document.getElementById('webcamDamageList');

    if (boxes.length > 0 && resultsContainer && resultsContainer.style.display === 'none') {
        resultsContainer.style.display = 'block';
        if (resetWebcamLogBtn) resetWebcamLogBtn.style.display = 'inline-block';
    }

    boxes.forEach((box, i) => {
        const [x, y, w, h] = box;
        const label = classes[i];
        const score = confidences[i];

        // Draw Box
        ctx.strokeStyle = '#00FF00';
        ctx.strokeRect(x, y, w, h);

        const text = `${label} ${Math.round(score)}%`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(x, y - 25, textWidth + 10, 25);
        ctx.fillStyle = '#000000';
        ctx.fillText(text, x + 5, y - 7);

        // Update List
        if (!webcamDetectedDamages.has(label)) {
            console.log("Adding to list:", label);
            webcamDetectedDamages.add(label);
            if (list) {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span class="damage-label">${label}</span>
                    <span class="damage-score">Detected</span>
                `;
                list.appendChild(li);
            }
        }
    });
}

let webcamPriceEstimateTimeout = null;

async function fetchAndDisplayPriceEstimate(detectedDamages) {
    const container = document.getElementById('priceEstimateContainer');
    if (!container) return;

    container.style.display = 'block';
    container.innerHTML = '<p class="text-center text-gray-500">Estimating repair costs using Gemini AI...</p>';

    // Get project details for better estimation
    let make = "Unknown";
    let model = "Unknown";
    let year = "Unknown";

    const projectId = localStorage.getItem('current_project');
    const token = localStorage.getItem('token');
    
    if (projectId && token) {
        try {
            const response = await fetch(`/api/projects/${projectId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const project = await response.json();
                make = project.make;
                model = project.model;
                year = project.year;
            }
        } catch(e) { console.error("Could not load project for pricing", e); }
    }

    try {
        const response = await fetch('/estimate_prices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                damages: detectedDamages,
                make: make,
                model: model,
                year: year
            })
        });

        if (!response.ok) throw new Error('Failed to fetch price estimate');

        const data = await response.json();
        currentWebcamEstimates = data;

        if (data.estimates && data.estimates.length > 0) {
            let html = `
                <div class="report-card" style="margin-top: 2rem; border-color: #6366f1;">
                    <h3 style="color: #6366f1;">Repair Cost Estimate (Gemini AI)</h3>
                    <div class="report-details" style="padding: 1.5rem;">
                        <ul style="margin-bottom: 1.5rem;">
            `;

            data.estimates.forEach(est => {
                html += `
                    <li style="display: flex; justify-content: space-between; padding-bottom: 0.5rem; border-bottom: 1px solid #e5e7eb; margin-bottom: 0.5rem;">
                        <span class="damage-label">${est.part}</span>
                        <span class="font-semibold text-gray-800">${est.cost}</span>
                    </li>
                `;
            });

            html += `
                        </ul>
                        <div style="display: flex; justify-content: space-between; align-items: center; background-color: #f3f4f6; padding: 1rem; border-radius: 0.5rem;">
                            <span style="font-weight: 600; font-size: 1.125rem; color: #1f2937;">Estimated Total Cost:</span>
                            <span style="font-weight: 700; font-size: 1.25rem; color: #4f46e5;">${data.total}</span>
                        </div>
                        <p style="font-size: 0.75rem; color: #6b7280; margin-top: 1rem; text-align: center;">
                            * Estimates are AI-generated and for informational purposes only. Actual costs may vary.
                        </p>
                    </div>
                </div>
            `;
            container.innerHTML = html;
        } else {
            container.style.display = 'none';
        }

        return data;
    } catch (error) {
        console.error("Price estimation error:", error);
        container.innerHTML = '<p class="text-center text-red-500">Failed to load price estimates.</p>';
        return null;
    }
}

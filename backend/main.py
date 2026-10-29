# ======================================================================================
# CORE AI BACKEND: Multimodal Late-Fusion Network (SOTA Architecture)
# Project 2: AI-Based MDD Detection from 3D Brain MRI
# ======================================================================================

import os
import shutil
import base64
import traceback
import uuid
import numpy as np
import nibabel as nib
import torch
import torch.nn as nn
import torch.nn.functional as F
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from monai.transforms import Resize

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

app = FastAPI(title="MDD Detection Multimodal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======================================================================================
# 2. Neural Network Architecture Definition
# ======================================================================================

class SEBlock3D(nn.Module):
    def __init__(self, channel, reduction=16):
        super(SEBlock3D, self).__init__()
        self.avg_pool = nn.AdaptiveAvgPool3d(1)
        self.fc = nn.Sequential(
            nn.Linear(channel, channel // reduction, bias=False), 
            nn.ReLU(True),
            nn.Linear(channel // reduction, channel, bias=False), 
            nn.Sigmoid()
        )

    def forward(self, x):
        b, c, _, _, _ = x.size()
        y = self.fc(self.avg_pool(x).view(b, c)).view(b, c, 1, 1, 1)
        return x * y.expand_as(x)

class MultimodalFusionNetwork(nn.Module):
    def __init__(self):
        super(MultimodalFusionNetwork, self).__init__()
        self.img_encoder = nn.Sequential(
            nn.Conv3d(1, 16, kernel_size=3, stride=2, padding=1), nn.BatchNorm3d(16), nn.ReLU(True),
            nn.Conv3d(16, 32, kernel_size=3, stride=2, padding=1), nn.BatchNorm3d(32), nn.ReLU(True),
            nn.Conv3d(32, 64, kernel_size=3, stride=2, padding=1), nn.BatchNorm3d(64), nn.ReLU(True),
            nn.Conv3d(64, 128, kernel_size=3, stride=2, padding=1), nn.BatchNorm3d(128), nn.ReLU(True)
        )
        self.img_attention = SEBlock3D(128)
        
        self.img_flatten = nn.Sequential(
            nn.Flatten(), 
            nn.Linear(128 * 4 * 4 * 4, 128), 
            nn.ReLU(True)
        )
        self.clin_encoder = nn.Sequential(
            nn.Linear(4, 16), nn.BatchNorm1d(16), nn.ReLU(True),
            nn.Linear(16, 32), nn.BatchNorm1d(32), nn.ReLU(True)
        )
        self.classifier = nn.Sequential(
            nn.Linear(160, 64), nn.BatchNorm1d(64), nn.ReLU(True), nn.Dropout(0.5),
            nn.Linear(64, 1)
        )

    def forward(self, img, clin):
        img_features = self.img_flatten(self.img_attention(self.img_encoder(img)))
        clin_features = self.clin_encoder(clin)
        
        img_features = img_features.view(1, -1)
        clin_features = clin_features.view(1, -1)
        
        fused_representation = torch.cat((img_features, clin_features), dim=1)
        return self.classifier(fused_representation)

# ======================================================================================
# 3. Model Initialization
# ======================================================================================

model = MultimodalFusionNetwork().to(DEVICE)
WEIGHTS_PATH = "best_multimodal_model.pth" 

@app.on_event("startup")
def load_model_weights():
    if os.path.exists(WEIGHTS_PATH):
        model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
        print(f" System Log: Multimodal AI Architecture successfully initialized on {DEVICE}.")
    else:
        print(f" Critical Warning: Optimal weights '{WEIGHTS_PATH}' missing from directory.")
    model.eval()

# ======================================================================================
# 4. Core Inference
# ======================================================================================

def run_3d_ai_analysis(mri_path, sex=1.0, age=0.0, edu=0.0, hamd=0.0):
    original_img = nib.load(mri_path)
    original_data = original_img.get_fdata()
    
    original_data = np.squeeze(original_data)
    if original_data.ndim > 3:
        original_data = original_data[..., 0]
        
    original_shape = original_data.shape

    # Preprocessing
    img_norm = (original_data - np.min(original_data)) / (np.max(original_data) - np.min(original_data) + 1e-8)
    resizer_64 = Resize((64, 64, 64))
    
    img_resized = resizer_64(np.expand_dims(img_norm, 0))
    if torch.is_tensor(img_resized):
        img_resized = img_resized.cpu().numpy()
        
    img_resized = (img_resized - img_resized.mean()) / (img_resized.std() + 1e-8)
    
    input_tensor = torch.tensor(img_resized).unsqueeze(0).float().to(DEVICE)
    input_tensor.requires_grad = True

    clin_tensor = torch.tensor([[sex, age, edu, hamd]], dtype=torch.float32).to(DEVICE)

    # Hooks for Grad-CAM
    feature_maps = []
    gradients = []
    def forward_hook(module, input, output): feature_maps.append(output)
    def backward_hook(module, grad_in, grad_out): gradients.append(grad_out[0])

    target_layer = model.img_encoder[-3]
    fw_hook = target_layer.register_forward_hook(forward_hook)
    bw_hook = target_layer.register_full_backward_hook(backward_hook)

    # Forward Pass
    model.eval() 
    logit = model(input_tensor, clin_tensor)
    probability = torch.sigmoid(logit).item()

    # Backward Pass for Heatmap Generation
    model.zero_grad()
    logit.sum().backward()

    fw_hook.remove()
    bw_hook.remove()

    # Generate Heatmap (Grad-CAM)
    fmap = feature_maps[0].squeeze().cpu().detach().numpy()
    grad = gradients[0].squeeze().cpu().detach().numpy()
    
    weights = np.mean(grad, axis=(1, 2, 3))
    cam = np.zeros(fmap.shape[1:], dtype=np.float32)
    for i, w in enumerate(weights):
        cam += w * fmap[i]
        
    cam = np.maximum(cam, 0)

    # 1. Trilinear Interpolation to original MRI dimensions
    cam_tensor = torch.tensor(cam, dtype=torch.float32).unsqueeze(0).unsqueeze(0)
    heatmap_tensor = F.interpolate(
        cam_tensor,
        size=original_shape,
        mode='trilinear',
        align_corners=False
    )
    heatmap_matrix = heatmap_tensor.squeeze().numpy()

    # 2. Normalize Heatmap to [0, 1]
    h_max = np.max(heatmap_matrix)
    h_min = np.min(heatmap_matrix)
    if h_max - h_min > 0:
        heatmap_matrix = (heatmap_matrix - h_min) / (h_max - h_min)
    else:
        heatmap_matrix = np.zeros_like(heatmap_matrix)

    # 3. Create Structural Mask from original MRI

    orig_norm = (original_data - np.min(original_data)) / (np.max(original_data) - np.min(original_data) + 1e-8)
    
    # 4. GUIDED MULTIPLICATION (The Secret Sauce)

    heatmap_matrix = heatmap_matrix * orig_norm
    
    # 5. Final Polish: Sharpen and clean weak noise
    heatmap_matrix = np.power(heatmap_matrix, 2.0)
    heatmap_matrix[heatmap_matrix < 0.15] = 0.0

    diagnosis = "Depression Signs Detected" if probability > 0.5 else "Normal Brain Structure"
    confidence = round((probability if probability > 0.5 else 1 - probability) * 100, 2)

    return diagnosis, confidence, heatmap_matrix

# ======================================================================================
# 5. API Endpoints
# ======================================================================================

@app.post("/api/analyze")
async def analyze_mri(
    file: UploadFile = File(...),
    sex: float = Form(1.0),
    age: float = Form(0.0),
    edu: float = Form(0.0),
    hamd: float = Form(0.0)
):
    request_id = str(uuid.uuid4())
    temp_input = f"temp_input_{request_id}_{file.filename}"
    temp_heatmap = f"temp_result_heatmap_{request_id}.nii.gz"
    
    try:
        with open(temp_input, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        diagnosis, confidence, heatmap_data = run_3d_ai_analysis(
            temp_input, sex=sex, age=age, edu=edu, hamd=hamd
        )
        
        original_img = nib.load(temp_input)
        heatmap_img = nib.Nifti1Image(heatmap_data.astype(np.float32), original_img.affine)
        nib.save(heatmap_img, temp_heatmap)
        
        with open(temp_heatmap, "rb") as hf:
            heatmap_base64 = base64.b64encode(hf.read()).decode('utf-8')
        
        return {
            "diagnosis": diagnosis,
            "confidence": confidence,
            "heatmap": heatmap_base64
        }

    except Exception as e:
        print("\n CRITICAL ERROR IN AI PROCESSING:")
        traceback.print_exc() 
        raise HTTPException(status_code=500, detail="Internal AI Processing Error")

    finally:
        if os.path.exists(temp_input):
            os.remove(temp_input)
        if os.path.exists(temp_heatmap):
            os.remove(temp_heatmap)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

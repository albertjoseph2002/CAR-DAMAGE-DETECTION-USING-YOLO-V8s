import os
import yaml
import numpy as np
from PIL import Image

from detection import Detection

# Load class names from app.yaml
cfg_path = os.path.join(os.path.dirname(__file__), 'app.yaml')
with open(cfg_path, 'r', encoding='utf-8') as f:
    cfg = yaml.safe_load(f)

names = cfg.get('names')
classes = [names[k] for k in sorted(names, key=lambda x: int(x))]
print('Loaded classes count:', len(classes))
print('Sample mapping:', list(enumerate(classes))[:20])

# Load model
pt_path = os.path.abspath(os.path.join(__file__, '..', '..', 'best.pt'))
print('Using model:', pt_path)

# Run inference on a sample image
img_path = os.path.abspath(os.path.join(__file__, '..', '..', 'test_images', 'test', '0.jpg'))
print('Using image:', img_path)

img = Image.open(img_path).convert('RGB')
img_np = np.array(img)[:,:,::-1].copy()

det = Detection(model_path=pt_path, classes=classes)
res = det(img_np)
print('Result:', res)

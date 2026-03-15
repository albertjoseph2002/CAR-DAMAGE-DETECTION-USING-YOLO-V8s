from ultralytics import YOLO

# Load a model
model = YOLO("yolov8s.yaml")  # build a new model from scratch

# Use the model
results = model.train(data="config.yaml", epochs=5000)  # train the model

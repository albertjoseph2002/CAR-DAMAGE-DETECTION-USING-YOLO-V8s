import os
from typing import List, Tuple

import cv2
import numpy as np
from numpy import ndarray

# NOTE: Ultralytics YOLO is used for loading .pt / .pth models.
#       OpenCV DNN is used for ONNX models (legacy support).
try:
    from ultralytics import YOLO
    _HAS_ULTRALYTICS = True
except ImportError:
    _HAS_ULTRALYTICS = False


class Detection:
    def __init__(self,
                 model_path: str,
                 classes: List[str]):
        # Resolve model path relative to this file if needed.
        if not os.path.isabs(model_path):
            base_dir = os.path.dirname(__file__)
            model_path = os.path.join(base_dir, model_path)
        self.model_path = os.path.abspath(model_path)
        self.classes = classes
        self.model = self.__load_model()

    def __load_model(self):
        ext = os.path.splitext(self.model_path)[1].lower()
        if ext in {'.pt', '.pth'}:
            if not _HAS_ULTRALYTICS:
                raise ImportError(
                    "Ultralytics is required to load .pt/.pth models. "
                    "Install with `pip install ultralytics`."
                )
            return YOLO(self.model_path)

        # Fallback to ONNX runtime via OpenCV if model file is ONNX
        net = cv2.dnn.readNet(self.model_path)
        net.setPreferableTarget(cv2.dnn.DNN_TARGET_CUDA_FP16)
        net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
        return net

    def __extract_ouput(self,
                        preds: ndarray,
                        image_shape: Tuple[int, int],
                        input_shape: Tuple[int, int],
                        score: float = 0.1,
                        nms: float = 0.0,
                        confidence: float = 0.0
                        ) -> dict:
        class_ids, confs, boxes = list(), list(), list()

        image_height, image_width = image_shape
        input_height, input_width = input_shape
        x_factor = image_width / input_width
        y_factor = image_height / input_height

        rows = preds[0].shape[0]
        for i in range(rows):
            row = preds[0][i]
            conf = row[4]

            classes_score = row[4:]
            _, _, _, max_idx = cv2.minMaxLoc(classes_score)
            class_id = max_idx[1]
            if (classes_score[class_id] > score):
                confs.append(conf)
                label = self.classes[int(class_id)]
                class_ids.append(label)

                # extract boxes
                x, y, w, h = row[0].item(), row[1].item(), row[2].item(), row[3].item()
                left = int((x - 0.5 * w) * x_factor)
                top = int((y - 0.5 * h) * y_factor)
                width = int(w * x_factor)
                height = int(h * y_factor)
                box = np.array([left, top, width, height])
                boxes.append(box)

        r_class_ids, r_confs, r_boxes = list(), list(), list()
        indexes = cv2.dnn.NMSBoxes(boxes, confs, confidence, nms)
        for i in indexes:
            r_class_ids.append(class_ids[i])
            r_confs.append(confs[i] * 100)
            r_boxes.append(boxes[i].tolist())

        return {
            'boxes': r_boxes,
            'confidences': r_confs,
            'classes': r_class_ids
        }

    def __call__(self,
                 image: ndarray,
                 width: int = 640,
                 height: int = 640,
                 score: float = 0.1,
                 nms: float = 0.0,
                 confidence: float = 0.0
                 ) -> dict:
        # If using Ultralytics YOLO model (PyTorch .pt/.pth), use its inference pipeline.
        if _HAS_ULTRALYTICS and hasattr(self.model, 'predict'):
            results = self.model(image, conf=0.25)
            if len(results) == 0:
                return {'boxes': [], 'confidences': [], 'classes': []}

            r = results[0]

            def _to_numpy(x):
                if hasattr(x, 'cpu'):
                    x = x.cpu()
                if hasattr(x, 'numpy'):
                    x = x.numpy()
                return np.asarray(x)

            boxes_xyxy = _to_numpy(getattr(r.boxes, 'xyxy', []))
            confidences = _to_numpy(getattr(r.boxes, 'conf', []))
            class_ids = _to_numpy(getattr(r.boxes, 'cls', []))

            out_boxes, out_classes, out_confs = [], [], []
            for i, xyxy in enumerate(boxes_xyxy):
                x1, y1, x2, y2 = xyxy
                w = x2 - x1
                h = y2 - y1
                out_boxes.append([int(x1), int(y1), int(w), int(h)])
                cls_idx = int(class_ids[i]) if i < len(class_ids) else -1
                out_classes.append(self.classes[cls_idx] if 0 <= cls_idx < len(self.classes) else str(cls_idx))
                out_confs.append(float(confidences[i]) * 100 if i < len(confidences) else 0.0)

            return {
                'boxes': out_boxes,
                'confidences': out_confs,
                'classes': out_classes,
                'class_idxs': [int(x) for x in class_ids[: len(out_boxes)]]
            }

        # Fallback: use OpenCV DNN for ONNX
        blob = cv2.dnn.blobFromImage(
            image, 1 / 255.0, (width, height),
            swapRB=True, crop=False
        )
        self.model.setInput(blob)
        preds = self.model.forward()
        preds = preds.transpose((0, 2, 1))

        # extract output
        results = self.__extract_ouput(
            preds=preds,
            image_shape=image.shape[:2],
            input_shape=(height, width),
            score=score,
            nms=nms,
            confidence=confidence
        )
        return results

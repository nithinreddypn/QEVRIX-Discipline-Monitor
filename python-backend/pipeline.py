import os
import cv2
import numpy as np
import torch
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
from ultralytics import YOLO

# Initialize PyTorch device and ResNet-18 for face embedding extraction
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
weights = models.ResNet18_Weights.DEFAULT
resnet = models.resnet18(weights=weights)
resnet.fc = torch.nn.Identity()  # Remove final linear classifier layer
resnet.to(device)
resnet.eval()

# Image transforms for ResNet-18 face embedding input
face_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# Initialize YOLOv8 for person detection (downloads yolov8n.pt on first run)
yolo_model = YOLO("yolov8n.pt")

# Initialize OpenCV Haar Cascade for face detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

def detect_and_crop_person(image):
    """
    Runs YOLOv8 to detect a person in the image.
    Returns the cropped person region and the person confidence score.
    """
    results = yolo_model(image, verbose=False)
    best_box = None
    best_conf = 0.0

    for result in results:
        boxes = result.boxes
        for box in boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            # Class 0 in YOLO COCO is 'person'
            if cls_id == 0 and conf >= 0.6 and conf > best_conf:
                best_conf = conf
                best_box = box.xyxy[0].cpu().numpy()

    if best_box is not None:
        x1, y1, x2, y2 = map(int, best_box)
        # Add padding if possible
        h, w, _ = image.shape
        x1 = max(0, x1 - 10)
        y1 = max(0, y1 - 10)
        x2 = min(w, x2 + 10)
        y2 = min(h, y2 + 10)
        person_crop = image[y1:y2, x1:x2]
        return person_crop, best_conf
    
    return None, 0.0

def detect_face(person_crop):
    """
    Detects the largest face in the person crop using Haar Cascades.
    Returns the cropped face region and its bounding box (x, y, w, h).
    """
    gray = cv2.cvtColor(person_crop, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
    
    if len(faces) == 0:
        return None, None
    
    # Pick the largest face by area
    largest_face = max(faces, key=lambda f: f[2] * f[3])
    x, y, w, h = largest_face
    
    # Add a bit of padding around the face crop
    ph = person_crop.shape[0]
    pw = person_crop.shape[1]
    pad_x = int(w * 0.1)
    pad_y = int(h * 0.1)
    
    fx1 = max(0, x - pad_x)
    fy1 = max(0, y - pad_y)
    fx2 = min(pw, x + w + pad_x)
    fy2 = min(ph, y + h + pad_y)
    
    face_crop = person_crop[fy1:fy2, fx1:fx2]
    return face_crop, (x, y, w, h)

def get_face_embedding(face_crop):
    """
    Extracts a normalized 512-dimensional face embedding using ResNet-18.
    """
    rgb_face = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb_face)
    tensor = face_transform(pil_img).unsqueeze(0).to(device)
    
    with torch.no_grad():
        embedding = resnet(tensor)
        
    embedding_np = embedding.cpu().numpy().flatten()
    norm = np.linalg.norm(embedding_np)
    if norm > 0:
        embedding_np = embedding_np / norm
    return embedding_np

def calculate_cosine_similarity(emb1, emb2):
    """
    Computes cosine similarity between two face embeddings.
    """
    if emb1 is None or emb2 is None:
        return 0.0
    dot = np.dot(emb1, emb2)
    norm1 = np.linalg.norm(emb1)
    norm2 = np.linalg.norm(emb2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot / (norm1 * norm2))

def detect_lanyard_color(person_crop, face_bbox):
    """
    Extracts the chest region and looks for a strong, contiguous branch-color tag/lanyard.
    Returns (id_card_found, id_card_color_hex)
    """
    h, w, _ = person_crop.shape
    if face_bbox is not None:
        fx, fy, fw, fh = face_bbox
        # Chest is below the face
        ymin = min(h - 1, fy + fh)
        ymax = min(h, fy + fh + int(fh * 2.5))
        xmin = max(0, fx - int(fw * 0.5))
        xmax = min(w, fx + fw + int(fw * 0.5))
    else:
        # Fallback: middle upper chest region of the person
        ymin = int(h * 0.45)
        ymax = int(h * 0.85)
        xmin = int(w * 0.25)
        xmax = min(w, int(w * 0.75))
        
    chest_crop = person_crop[ymin:ymax, xmin:xmax]
    if chest_crop.size == 0:
        return False, None
        
    hsv = cv2.cvtColor(chest_crop, cv2.COLOR_BGR2HSV)
    
    # Count only vivid pixels. This prevents normal clothing, shadows, and denim
    # from being classified as an ID tag.
    h_vals = hsv[:, :, 0]
    s_vals = hsv[:, :, 1]
    v_vals = hsv[:, :, 2]
    
    sat_val_mask = (s_vals >= 95) & (v_vals >= 70) & (v_vals <= 235)

    color_masks = {
        "#3b82f6": sat_val_mask & (h_vals >= 92) & (h_vals <= 128),   # Blue
        "#10b981": sat_val_mask & (h_vals >= 38) & (h_vals < 84),     # Green
        "#f59e0b": sat_val_mask & (h_vals >= 16) & (h_vals < 34),     # Yellow
        "#ef4444": sat_val_mask & ((h_vals < 10) | (h_vals >= 170)),  # Red
    }
    
    total_pixels = chest_crop.shape[0] * chest_crop.shape[1]

    scores = []
    for color, mask in color_masks.items():
        count = int(np.sum(mask))
        component_ratio = largest_component_ratio(mask)
        scores.append((color, count, component_ratio))

    scores.sort(key=lambda item: item[1], reverse=True)
    best_color, best_count, best_component_ratio = scores[0]
    second_count = scores[1][1] if len(scores) > 1 else 0
    pixel_ratio = float(best_count) / total_pixels

    has_enough_pixels = pixel_ratio >= 0.035
    has_dominant_color = second_count == 0 or best_count >= second_count * 1.8
    has_contiguous_tag = best_component_ratio >= 0.012

    if has_enough_pixels and has_dominant_color and has_contiguous_tag:
        return True, best_color

    return False, None

def largest_component_ratio(mask):
    """
    Returns the largest connected component area as a ratio of the whole mask.
    A real lanyard/tag usually appears as a compact contiguous region; scattered
    blue/green/yellow/red pixels in clothing should not pass this check.
    """
    mask_u8 = mask.astype(np.uint8) * 255
    if mask_u8.size == 0 or np.count_nonzero(mask_u8) == 0:
        return 0.0

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask_u8, connectivity=8)
    if num_labels <= 1:
        return 0.0

    largest = int(np.max(stats[1:, cv2.CC_STAT_AREA]))
    return float(largest) / float(mask_u8.shape[0] * mask_u8.shape[1])

def run_pipeline(image_path, student_database_embeddings, similarity_threshold=0.6):
    """
    Runs the complete multi-stage AI pipeline:
    1. Person Detection
    2. Face Detection
    3. Face Recognition (cosine similarity)
    4. ID Card/Lanyard Color Detection
    5. Overall Confidence Calculation
    """
    # Live OpenCV inference path

    # 1. Load image
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Failed to read image at {image_path}")
        
    # 2. Person Detection
    person_crop, person_conf = detect_and_crop_person(img)
    if person_crop is None:
        # Fallback: Use the entire image frame if YOLO body detection misses
        person_crop = img
        person_conf = 0.5
        
    # 3. Face Detection
    face_crop, face_bbox = detect_face(person_crop)
    
    # 4. Face Recognition
    matched_student = None
    similarity_score = 0.0
    
    if face_crop is not None:
        emb = get_face_embedding(face_crop)
        best_student = None
        best_sim = 0.0
        
        for student_id, student_emb in student_database_embeddings.items():
            sim = calculate_cosine_similarity(emb, student_emb)
            if sim > best_sim:
                best_sim = sim
                best_student = student_id
                
        if best_sim >= similarity_threshold:
            matched_student = best_student
            similarity_score = best_sim
            
    # 5. ID Card Detection & Lanyard Color Identification
    id_card_found, detected_hex = detect_lanyard_color(person_crop, face_bbox)
    
    # 6. Overall Confidence Calculation
    # Formula:
    # - If a face is matched: Overall Confidence is 70% face similarity score + 30% YOLO person detection confidence.
    #   This gives primary weight to the high-precision facial identifier while anchoring it to the detection quality.
    # - If no face matches but person is found: Overall Confidence is 40% person detection confidence.
    if matched_student is not None:
        overall_confidence = float(0.7 * similarity_score + 0.3 * person_conf)
    else:
        overall_confidence = float(0.4 * person_conf)
        
    return {
        "person_detected": True,
        "face_detected": face_crop is not None,
        "matched_student_id": matched_student,
        "face_similarity": float(similarity_score) if face_crop is not None else 0.0,
        "id_card_found": id_card_found,
        "id_card_color": detected_hex,
        "confidence": overall_confidence
    }

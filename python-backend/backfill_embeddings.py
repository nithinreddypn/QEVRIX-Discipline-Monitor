import os
import cv2
import numpy as np
from supabase import create_client
from pipeline import detect_face, get_face_embedding

# Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

def run_backfill():
    print("="*60)
    print("      QEVRIX GUARDIAN - FACE EMBEDDINGS ONE-TIME BACKFILL      ")
    print("="*60)
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. "
            "Set them as environment variables before running backfill."
        )
    
    # Initialize Supabase client
    supabase = create_client(SUPABASE_URL, SERVICE_KEY)
    
    print("[Backfill] Fetching active student records...")
    try:
        s_res = supabase.table("students").select("id, full_name, profile_photo_url").eq("status", "active").execute()
        students = s_res.data
        print(f"  Found {len(students)} active student records.")
        
        success_count = 0
        for student in students:
            student_id = student["id"]
            photo_url = student["profile_photo_url"]
            
            if not photo_url:
                print(f"  [Skipped] Student {student['full_name']} has no profile photo.")
                continue
                
            print(f"  Processing student {student['full_name']} (Photo: {photo_url})...")
            temp_filename = f"temp_backfill_{student_id}.jpg"
            
            try:
                # Download registration photo
                with open(temp_filename, "wb") as f:
                    file_data = supabase.storage.from_("student-photos").download(photo_url)
                    f.write(file_data)
                
                # Compute embedding
                img = cv2.imread(temp_filename)
                if img is not None:
                    face_crop, _ = detect_face(img)
                    if face_crop is not None:
                        emb = get_face_embedding(face_crop)
                        
                        # Upsert to database
                        supabase.table("student_embeddings").upsert({
                            "student_id": student_id,
                            "embedding": emb.tolist(),
                            "model_version": f"resnet18:{photo_url}"
                        }, on_conflict="student_id").execute()
                        
                        print(f"    Success: Embedding saved to student_embeddings table.")
                        success_count += 1
                    else:
                        print(f"    [Warning] No face detected in profile photo.")
                else:
                    print(f"    [Error] Failed to read registration image.")
            except Exception as e:
                print(f"    [Error] Failed backfill processing: {e}")
            finally:
                if os.path.exists(temp_filename):
                    try:
                        os.remove(temp_filename)
                    except Exception:
                        pass
                        
        print(f"\n[Backfill] Completed! Successfully backfilled {success_count} student embeddings.")
    except Exception as e:
        print(f"[Backfill] Critical error running backfill: {e}")

if __name__ == "__main__":
    run_backfill()

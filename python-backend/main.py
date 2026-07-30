import os
import time
import sys
import datetime
import numpy as np
from supabase import create_client
from pipeline import run_pipeline, detect_face, get_face_embedding, cv2

# Configuration
SUPABASE_URL = "https://jrioxyykeqvmcnhitsta.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyaW94eXlrZXF2bWNuaGl0c3RhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTI4MTA5OSwiZXhwIjoyMTAwODU3MDk5fQ.M_WK2fKhoa26KA9jQotdZUQ2iCe8kXs4vwFvc_21ZiM"
MAX_RETRIES = 3
POLL_INTERVAL = 5 # seconds

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SERVICE_KEY)

# Global caches
student_embeddings = {}
student_info = {}
branch_cache = {}

def get_now_utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def load_student_database():
    """
    On startup, queries all active students, downloads their registration photos,
    computes face embeddings, and caches them in memory.
    """
    global student_embeddings, student_info, branch_cache
    print("[Startup] Caching branches...")
    try:
        b_res = supabase.table("branches").select("id, name, code, color_name, color_hex").execute()
        branch_cache = {b["id"]: b for b in b_res.data}
        print(f"  Loaded {len(branch_cache)} branches.")
    except Exception as e:
        print(f"  Error loading branches: {e}")

    print("[Startup] Pre-loading active student registrations & face database...")
    try:
        s_res = supabase.table("students").select("id, full_name, profile_photo_url, branch_id").eq("status", "active").execute()
        students = s_res.data
        print(f"  Found {len(students)} active student records.")

        # Try to query already persisted embeddings
        has_db_table = False
        db_embeddings = {}
        try:
            emb_res = supabase.table("student_embeddings").select("student_id, embedding, model_version").execute()
            db_embeddings = {e["student_id"]: e for e in emb_res.data}
            has_db_table = True
            print(f"  Found {len(db_embeddings)} persisted face embeddings in student_embeddings table.")
        except Exception as e:
            print(f"  [Info] student_embeddings table not available or empty (will generate in-memory fallbacks): {e}")

        for student in students:
            student_id = student["id"]
            photo_url = student["profile_photo_url"]
            student_info[student_id] = student
            
            if photo_url:
                expected_version = f"resnet18:{photo_url}"
                
                # If embedding already exists and model version matches, load it directly
                if student_id in db_embeddings and db_embeddings[student_id]["model_version"] == expected_version:
                    raw_emb = db_embeddings[student_id]["embedding"]
                    student_embeddings[student_id] = np.array(raw_emb, dtype=np.float32)
                    print(f"  Loaded persisted embedding for student: {student['full_name']}")
                    continue
                
                # Otherwise, download registration photo and extract embedding
                temp_filename = f"temp_reg_{student_id}.jpg"
                try:
                    print(f"  Generating/updating embedding for student: {student['full_name']}...")
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
                            student_embeddings[student_id] = emb
                            
                            # Upsert to database if table is available
                            if has_db_table:
                                try:
                                    supabase.table("student_embeddings").upsert({
                                        "student_id": student_id,
                                        "embedding": emb.tolist(),
                                        "model_version": expected_version
                                    }, on_conflict="student_id").execute()
                                    print(f"    Success: Persisted new embedding to database.")
                                except Exception as dbe:
                                    print(f"    [Warning] Failed to persist embedding: {dbe}")
                        else:
                            print(f"    [Warning] No face detected in registration photo for student: {student['full_name']}")
                    else:
                        print(f"    [Warning] Failed to read registration image for student: {student['full_name']}")
                except Exception as e:
                    print(f"    [Warning] Error generating embedding for student {student['full_name']}: {e}")
                finally:
                    if os.path.exists(temp_filename):
                        try:
                            os.remove(temp_filename)
                        except Exception:
                            pass
            else:
                print(f"  [Info] Student {student['full_name']} has no profile photo uploaded.")
        
        print(f"[Startup] Face database loading completed. {len(student_embeddings)} student embeddings cached in-memory.")
    except Exception as e:
        print(f"[Startup] Critical error loading face database: {e}")

def list_all_bucket_files(bucket_name, prefix=""):
    """
    Recursively lists all files in a Supabase Storage bucket.
    """
    files = []
    try:
        items = supabase.storage.from_(bucket_name).list(prefix)
        for item in items:
            name = item.get("name")
            is_folder = item.get("id") is None
            
            if is_folder:
                # Recursive call
                sub_prefix = f"{prefix}/{name}" if prefix else name
                files.extend(list_all_bucket_files(bucket_name, sub_prefix))
            else:
                path = f"{prefix}/{name}" if prefix else name
                # Ignore system hidden files
                if not name.startswith("."):
                    files.append(path)
    except Exception as e:
        print(f"Error listing bucket files at prefix '{prefix}': {e}")
    return files

def check_and_queue_new_uploads():
    """
    Checks the storage bucket for new image uploads and appends them
    to the processing_queue table in the database if not present.
    """
    print("[Watcher] Checking for new uploads in esp32-detections...")
    try:
        bucket_files = list_all_bucket_files("esp32-detections")
        print(f"  Found {len(bucket_files)} file(s) in esp32-detections bucket.")
        
        for file_path in bucket_files:
            # Check if this file path is already in the database queue
            q_res = supabase.table("processing_queue").select("id").eq("image_path", file_path).execute()
            
            if len(q_res.data) == 0:
                print(f"  New upload detected: {file_path}. Queuing...")
                supabase.table("processing_queue").insert({
                    "image_path": file_path,
                    "status": "queued",
                    "retry_count": 0
                }).execute()
    except Exception as e:
        print(f"[Watcher] Error checking/queuing new uploads: {e}")

def process_single_queue_item(item):
    """
    Processes a single queued image item through the pipeline.
    """
    row_id = item["id"]
    file_path = item["image_path"]
    retry_count = item["retry_count"]
    
    print(f"\n[Worker] Claimed queue item {row_id}: {file_path}")
    temp_img_path = f"temp_detect_{row_id}_{os.path.basename(file_path)}"
    
    try:
        # 1. Download image from esp32-detections bucket
        print(f"  Downloading frame from storage...")
        with open(temp_img_path, "wb") as f:
            file_data = supabase.storage.from_("esp32-detections").download(file_path)
            f.write(file_data)
            
        # 2. Run pipeline
        print(f"  Running AI processing pipeline...")
        result = run_pipeline(temp_img_path, student_embeddings)
        
        if result is None:
            # Person not detected: skip logging a detections row, mark done
            print("  No person detected. Discarding frame without logging detection record.")
            supabase.table("processing_queue").update({
                "status": "done",
                "finished_at": get_now_utc()
            }).eq("id", row_id).execute()
            return
            
        # 3. Resolve student and branch color match
        matched_student_id = result["matched_student_id"]
        student_name = None
        branch_id = None
        expected_branch_color = None
        color_match = None
        
        if matched_student_id is not None:
            # Get student and branch details
            s_details = student_info.get(matched_student_id)
            if s_details:
                student_name = s_details["full_name"]
                branch_id = s_details["branch_id"]
                
                if branch_id and branch_id in branch_cache:
                    expected_branch_color = branch_cache[branch_id]["color_hex"]
                    
        # Perform branch color check if ID card and expected color are present
        if result["id_card_found"] and expected_branch_color:
            color_match = result["id_card_color"] == expected_branch_color
            
        # 4. Resolve status
        # If student is matched, and ID card matches branch color, status is verified.
        # Otherwise it is flagged.
        status = "flagged"
        if matched_student_id is not None and result["id_card_found"] and color_match is True:
            status = "verified"
            
        # 5. Insert exactly ONE completed row into detections table using upsert to avoid duplicates
        print(f"  Inserting completed detection log into database (status: {status})...")
        try:
            supabase.table("detections").upsert({
                "student_id": matched_student_id,
                "student_name": student_name,
                "branch_id": branch_id,
                "image_url": f"esp32-detections/{file_path}",
                "id_card_found": result["id_card_found"],
                "id_card_color": result["id_card_color"],
                "expected_branch_color": expected_branch_color,
                "color_match": color_match,
                "face_similarity": result["face_similarity"],
                "confidence": result["confidence"],
                "status": status,
                "detection_time": get_now_utc(),
                "notification_sent": False
            }, on_conflict="image_url").execute()
        except Exception as upsert_err:
            print(f"  [Info] Detection for image_url '{file_path}' already exists, skipping: {upsert_err}")
        
        # 6. Mark the queue row completed
        print("  Queue item processed successfully.")
        supabase.table("processing_queue").update({
            "status": "done",
            "finished_at": get_now_utc()
        }).eq("id", row_id).execute()
        
    except Exception as e:
        print(f"  [Error] Processing failed for item {row_id}: {e}")
        # Auto-retry handling
        next_retry = retry_count + 1
        if next_retry < MAX_RETRIES:
            print(f"  Re-queuing item for retry ({next_retry}/{MAX_RETRIES})...")
            supabase.table("processing_queue").update({
                "status": "queued",
                "retry_count": next_retry
            }).eq("id", row_id).execute()
        else:
            print(f"  Exhausted all retries. Marking queue item as failed.")
            supabase.table("processing_queue").update({
                "status": "failed",
                "retry_count": next_retry,
                "finished_at": get_now_utc()
            }).eq("id", row_id).execute()
            
    finally:
        # Cleanup temporary downloaded image
        if os.path.exists(temp_img_path):
            try:
                os.remove(temp_img_path)
            except Exception:
                pass

def process_queue():
    """
    Claims and processes the oldest queued or retryable failed item.
    """
    try:
        # Query oldest item that is queued or failed but within retries limit
        q_res = supabase.table("processing_queue") \
            .select("*") \
            .or_(f"status.eq.queued,and(status.eq.failed,retry_count.lt.{MAX_RETRIES})") \
            .order("created_at", desc=False) \
            .limit(1) \
            .execute()
            
        if len(q_res.data) > 0:
            item = q_res.data[0]
            row_id = item["id"]
            prev_status = item["status"]
            
            # Atomic state change to avoid race conditions
            claim_res = supabase.table("processing_queue") \
                .update({
                    "status": "processing",
                    "started_at": get_now_utc()
                }) \
                .eq("id", row_id) \
                .eq("status", prev_status) \
                .execute()
                
            if len(claim_res.data) > 0:
                process_single_queue_item(claim_res.data[0])
                return True # Handled an item
                
    except Exception as e:
        print(f"Error querying/processing queue: {e}")
    return False

def main():
    print("="*60)
    print("      QEVRIX GUARDIAN - AI PIPELINE BACKGROUND WORKER      ")
    print("="*60)
    
    # 1. Preload registration photos and embeddings
    load_student_database()
    
    # 2. Main processing daemon loop
    print("\n[Daemon] Starting worker polling loop...")
    last_reconciliation_time = time.time()
    
    while True:
        try:
            # Step A: Scan bucket and queue new uploads
            check_and_queue_new_uploads()
            
            # Step B: Drain queue
            processed_any = True
            while processed_any:
                processed_any = process_queue()
                
            # Step C: Periodically (every 30 seconds) reconcile student embeddings
            current_time = time.time()
            if current_time - last_reconciliation_time > 30:
                print("\n[Daemon] Reconciling student embeddings database cache...")
                load_student_database()
                last_reconciliation_time = current_time
                
            # Sleep until next poll
            print(f"[Daemon] Queue idle. Sleeping for {POLL_INTERVAL} seconds...")
            time.sleep(POLL_INTERVAL)
            
        except KeyboardInterrupt:
            print("\n[Daemon] Stopping worker loop. Exiting...")
            sys.exit(0)
        except Exception as e:
            print(f"[Daemon] Unexpected error: {e}")
            time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()

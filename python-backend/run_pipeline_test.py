import os
import time
import urllib.request
import json
from supabase import create_client

# Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. "
        "Set them as environment variables before running the integration test."
    )

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SERVICE_KEY)

def create_dummy_image(filename):
    # Create a tiny 100x100 black jpeg image
    import numpy as np
    import cv2
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    cv2.imwrite(filename, img)

def run_integration_test():
    print("="*70)
    print("       QEVRIX GUARDIAN - END-TO-END INTEGRATION TEST RUNNER       ")
    print("="*70)
    
    # 1. Clean up existing test queue database entries if any to start fresh
    print("[Test] Cleaning up any previous test database entries...")
    try:
        supabase.table("processing_queue").delete().ilike("image_path", "%test_%").execute()
        # Delete from detections (will cascade or clear)
        supabase.table("detections").delete().ilike("image_url", "%test_%").execute()
        print("  Previous test database logs cleared.")
    except Exception as e:
        print(f"  Error cleaning up previous logs: {e}")

    # 2. Create local dummy files
    test_files = ["test_verified.jpg", "test_mismatch.jpg", "test_no_id.jpg", "test_unknown.jpg"]
    for f in test_files:
        create_dummy_image(f)
        
    print("\n[Test] Uploading test images to esp32-detections storage bucket...")
    uploaded_paths = []
    for filename in test_files:
        storage_path = f"2026/07/{filename}"
        try:
            # Upload (using upsert=True)
            with open(filename, "rb") as f:
                supabase.storage.from_("esp32-detections").upload(
                    path=storage_path,
                    file=f,
                    file_options={"x-upsert": "true", "content-type": "image/jpeg"}
                )
            print(f"  Uploaded: esp32-detections/{storage_path}")
            uploaded_paths.append(storage_path)
        except Exception as e:
            print(f"  Error uploading {filename}: {e}")
            
    # 3. Wait for the background worker to poll and process
    wait_time = 18
    print(f"\n[Test] Waiting {wait_time} seconds for background daemon task to process the queue...")
    time.sleep(wait_time)
    
    # 4. Fetch results from detections table
    print("\n" + "="*60)
    print("INTEGRATION TEST REPORT")
    print("="*60)
    
    try:
        det_res = supabase.table("detections").select("*").ilike("image_url", "%test_%").execute()
        detections = det_res.data
        print(f"Total Detections Logged: {len(detections)}")
        
        for d in detections:
            print(f"\nDetection Record ID: {d['id']}")
            print(f"  Image URL: {d['image_url']}")
            print(f"  Student ID: {d['student_id']} (Name: {d['student_name']})")
            print(f"  ID Card Found: {d['id_card_found']}")
            print(f"  ID Card Color: {d['id_card_color']}")
            print(f"  Expected Color: {d['expected_branch_color']}")
            print(f"  Color Match: {d['color_match']}")
            print(f"  Face Similarity: {d['face_similarity']}")
            print(f"  Confidence: {d['confidence']}")
            print(f"  Status: {d['status']}")
            
            # Fetch notifications sent for this detection
            notif_res = supabase.table("notifications").select("recipient_user_id, type, message").eq("detection_id", d["id"]).execute()
            notifs = notif_res.data
            print(f"  Triggered Notifications ({len(notifs)}):")
            for n in notifs:
                # Resolve role of recipient for explanation
                role_res = supabase.table("user_roles").select("role").eq("user_id", n["recipient_user_id"]).execute()
                role = role_res.data[0]["role"] if role_res.data else "student"
                print(f"    - To: {role} (ID: {n['recipient_user_id']})")
                print(f"      Type: {n['type']}")
                print(f"      Msg: {n['message']}")
                
    except Exception as e:
        print(f"Error querying test results: {e}")
        
    # Cleanup local dummy images
    for f in test_files:
        if os.path.exists(f):
            try:
                os.remove(f)
            except Exception:
                pass
                
    # Note: We do not clean up the storage objects here so that the UI can sign and render them.
    print("\n[Test] Retaining uploaded test files in storage bucket for UI display.")

if __name__ == "__main__":
    run_integration_test()

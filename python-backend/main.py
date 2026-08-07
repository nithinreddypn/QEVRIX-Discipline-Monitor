import os
import time
import sys
import datetime
import numpy as np
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from supabase import create_client
from pipeline import run_pipeline, detect_face, get_face_embedding, cv2

# Load .env file from root directory if running locally
def load_env():
    try:
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip().strip('"').strip("'")
                        os.environ[key] = val
            print(f"[Env] Successfully loaded environment variables from {env_path}")
    except Exception as e:
        print(f"[Env Loader] Warning: Could not load .env file: {e}")

load_env()

# Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
MAX_RETRIES = 3
POLL_INTERVAL = 5 # seconds

if not SUPABASE_URL or not SERVICE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. "
        "Set them as environment variables before starting the worker."
    )

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
        s_res = supabase.table("students").select("id, full_name, profile_photo_url, branch_id, email").eq("status", "active").execute()
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

def get_ist_now():
    utc_now = datetime.datetime.now(datetime.timezone.utc)
    ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    return utc_now.astimezone(ist_tz)

def check_entry_time(detection_time_iso):
    """
    Parses detection time and converts it to IST (UTC+5:30).
    Returns (is_late, ist_time_str)
    College start time: 9:00 AM
    College end time: 3:30 PM
    """
    try:
        t_str = detection_time_iso.replace("Z", "+00:00")
        dt_utc = datetime.datetime.fromisoformat(t_str)
        ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
        dt_ist = dt_utc.astimezone(ist_tz)
        hour = dt_ist.hour
        minute = dt_ist.minute
        # Permitted entry is up to 9:00 AM.
        # Late if after 9:00 AM
        is_late = (hour > 9) or (hour == 9 and minute > 0)
        ist_time_str = dt_ist.strftime("%I:%M %p")
        return is_late, ist_time_str
    except Exception as e:
        print(f"[Time Check] Error parsing detection time {detection_time_iso}: {e}")
        # Fallback to current local time
        dt_ist = get_ist_now()
        hour = dt_ist.hour
        minute = dt_ist.minute
        is_late = (hour > 9) or (hour == 9 and minute > 0)
        return is_late, dt_ist.strftime("%I:%M %p")

def send_student_notification_email(student_email, student_name, reason, detection_time_str):
    if not student_email:
        print("[Email] No email found for student. Skipping.")
        return False
        
    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = os.environ.get("SMTP_PORT")
    smtp_secure = os.environ.get("SMTP_SECURE", "true") == "true"
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    smtp_from = os.environ.get("SMTP_FROM", f'"Qevrix Discipline Monitor" <{smtp_user}>')
    
    if not smtp_host or not smtp_user or not smtp_pass:
        print("[Email] SMTP configuration incomplete. Cannot send email.")
        return False
        
    try:
        port = int(smtp_port) if smtp_port else (465 if smtp_secure else 587)
    except ValueError:
        port = 465 if smtp_secure else 587
        
    print(f"[Email] Sending notification to student {student_name} ({student_email}) for: {reason}...")
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Discipline Notice: Entry Sighting Flagged - QEVRIX"
    msg["From"] = smtp_from
    msg["To"] = student_email
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Official Campus Entry Notice</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="580px" style="max-width: 580px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025); border-collapse: separate;">
              
              <!-- Header Bar -->
              <tr>
                <td style="background-color: #ffffff; padding: 32px 32px 20px 32px; border-bottom: 1px solid #f1f5f9;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; font-family: sans-serif;">
                        <span style="color: #22c55e;">QEVRIX</span> GUARDIAN
                      </td>
                      <td align="right" style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-family: sans-serif;">
                        Official Sighting Notice
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Alert Banner -->
              <tr>
                <td style="padding: 32px 32px 0 32px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; overflow: hidden;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <span style="font-size: 14px; font-weight: 700; color: #991b1b; display: block; margin-bottom: 4px; font-family: sans-serif;">Campus Entry Notice</span>
                        <span style="font-size: 13px; color: #7f1d1d; line-height: 1.5; display: block; font-family: sans-serif;">
                          Your campus entry has been logged with one or more security/discipline infractions.
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="padding: 24px 32px 32px 32px; font-family: sans-serif;">
                  <p style="font-size: 15px; font-weight: 500; color: #0f172a; margin-top: 0; margin-bottom: 16px;">
                    Dear <strong>{student_name}</strong>,
                  </p>
                  <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
                    This email is to notify you that our automated entry monitoring system recorded a campus entry with the following details:
                  </p>

                  <!-- Details Table -->
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 24px; border-collapse: collapse;">
                    <tr style="background-color: #f8fafc;">
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e5e7eb; width: 35%;">Parameter</td>
                      <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; border-bottom: 1px solid #e5e7eb;">Details</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #334155; border-bottom: 1px solid #f1f5f9;">Student Name</td>
                      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">{student_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #334155; border-bottom: 1px solid #f1f5f9;">Arrival Time</td>
                      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">{detection_time_str} IST</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #334155; border-bottom: 1px solid #f1f5f9;">Campus Hours</td>
                      <td style="padding: 12px 16px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">09:00 AM - 03:30 PM</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #334155; vertical-align: top;">Infraction Sighted</td>
                      <td style="padding: 12px 16px; font-size: 13px; color: #ef4444; font-weight: 600; line-height: 1.4;">
                        {reason}
                      </td>
                    </tr>
                  </table>

                  <!-- Guideline Section -->
                  <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 24px; margin-bottom: 12px;">Official Campus Regulations</h3>
                  <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
                    <li style="margin-bottom: 8px;">Every student must visibly wear their official department branch ID card (with the correct branch color lanyard) at all times when entering and navigating the campus.</li>
                    <li style="margin-bottom: 8px;">Official class hours begin at <strong>9:00 AM</strong>. Arriving after this time is classified as a late entry infraction.</li>
                    <li style="margin-bottom: 8px;">Consistent failure to comply with ID card and arrival policies will be escalated to department heads and coordinators.</li>
                  </ul>
                </td>
              </tr>

              <!-- Footer Section -->
              <tr>
                <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #f1f5f9;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="font-size: 11px; line-height: 1.5; color: #94a3b8; font-family: sans-serif;">
                        <strong>Department of Information Science and Engineering</strong><br />
                        Global Academy of Technology (GAT)<br />
                        Rajajinagar, Bengaluru, Karnataka, India
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-top: 16px; font-size: 10px; color: #cbd5e1; font-family: sans-serif; text-align: center;">
                        This is an automated notification. Please do not reply directly to this email.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """
    
    msg.attach(MIMEText(html_content, "html"))
    
    try:
        if smtp_secure:
            server = smtplib.SMTP_SSL(smtp_host, port)
        else:
            server = smtplib.SMTP(smtp_host, port)
            server.starttls()
            
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, student_email, msg.as_string())
        server.quit()
        print(f"[Email] Successfully sent email notification to {student_email}")
        return True
    except Exception as e:
        print(f"[Email] Failed to send email to {student_email}: {e}")
        return False

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
        student_email = None
        
        if matched_student_id is not None:
            # Get student and branch details
            s_details = student_info.get(matched_student_id)
            if s_details:
                student_name = s_details["full_name"]
                branch_id = s_details["branch_id"]
                student_email = s_details.get("email")
                
                if branch_id and branch_id in branch_cache:
                    expected_branch_color = branch_cache[branch_id]["color_hex"]
                    
        # Perform branch color check if ID card and expected color are present
        if result["id_card_found"] and expected_branch_color:
            color_match = result["id_card_color"] == expected_branch_color
            
        # Check time bounds
        detection_time_str = get_now_utc()
        is_late, ist_time_str = check_entry_time(detection_time_str)
        
        # 4. Resolve status
        # If student is matched, ID card matches branch color, AND they are in-time, status is verified.
        # Otherwise (missing ID, mismatched color, or late entry) it is flagged.
        status = "flagged"
        if matched_student_id is not None and result["id_card_found"] and color_match is True and not is_late:
            status = "verified"
            
        # Send email if recognized student violates ID card requirement or entry time bounds
        if matched_student_id is not None and student_email:
            reasons = []
            if not result["id_card_found"]:
                reasons.append("Missing ID card (not worn)")
            if is_late:
                reasons.append(f"Late entry (entered at {ist_time_str}, after class start time of 9:00 AM)")
                
            if reasons:
                reason_text = " and ".join(reasons)
                send_student_notification_email(
                    student_email=student_email,
                    student_name=student_name,
                    reason=reason_text,
                    detection_time_str=ist_time_str
                )
            
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
                "detection_time": detection_time_str,
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

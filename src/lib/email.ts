import { createServerFn } from "@tanstack/react-start";

type ServerRole = "student" | "teacher" | "admin";
type Caller = { userId: string; roles: ServerRole[] };

function getServerConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Server configuration incomplete.");
  }

  return { supabaseUrl, supabaseServiceKey, supabaseAnonKey };
}

async function createAdminClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const { supabaseUrl, supabaseServiceKey, supabaseAnonKey } = getServerConfig();
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { apikey: supabaseAnonKey } },
  });
}

async function getCaller(supabaseAdmin: Awaited<ReturnType<typeof createAdminClient>>): Promise<Caller> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const authHeader = request?.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  if (!token) throw new Error("Unauthorized.");

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  const userId = userData.user?.id;
  if (userError || !userId) throw new Error("Unauthorized.");

  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (roleError) throw roleError;
  return { userId, roles: (roleRows ?? []).map((row) => row.role as ServerRole) };
}

function hasAnyRole(caller: Caller, allowed: ServerRole[]) {
  return caller.roles.some((role) => allowed.includes(role));
}

async function requireRole(
  supabaseAdmin: Awaited<ReturnType<typeof createAdminClient>>,
  allowed: ServerRole[],
) {
  const caller = await getCaller(supabaseAdmin);
  if (!hasAnyRole(caller, allowed)) throw new Error("Forbidden.");
  return caller;
}

async function assertCanDecideStudent(
  supabaseAdmin: Awaited<ReturnType<typeof createAdminClient>>,
  caller: Caller,
  studentId: string,
) {
  if (caller.roles.includes("admin")) return;
  if (!caller.roles.includes("teacher")) throw new Error("Forbidden.");

  const [{ data: teacher }, { data: student }] = await Promise.all([
    supabaseAdmin.from("teachers").select("branch_id").eq("user_id", caller.userId).maybeSingle(),
    supabaseAdmin.from("students").select("branch_id").eq("id", studentId).maybeSingle(),
  ]);

  if (!teacher?.branch_id || !student?.branch_id || teacher.branch_id !== student.branch_id) {
    throw new Error("Forbidden.");
  }
}

export const sendRecoveryEmail = createServerFn({ method: "POST" })
  .validator((data: { email: string; redirectTo: string }) => {
    if (!data.email || typeof data.email !== "string") {
      throw new Error("Email is required");
    }
    if (!data.redirectTo || typeof data.redirectTo !== "string") {
      throw new Error("Redirect link is required");
    }
    return data;
  })
  .handler(async ({ data: { email, redirectTo } }) => {
    // Dynamically import server-side packages to prevent client-side bundler errors
    const { createClient } = await import("@supabase/supabase-js");
    const nodemailer = (await import("nodemailer")).default;

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[Email Server] Config missing: URL =", !!supabaseUrl, "Key =", !!supabaseServiceKey);
      throw new Error("The server auth configuration is incomplete.");
    }

    const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

    // 1. Initialize Supabase Admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          apikey: supabaseAnonKey,
        },
      },
    });

    // 2. Generate a secure recovery link via Supabase Auth Admin directly
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: redirectTo,
      },
    });

    if (linkError) {
      console.error("[Email Server] Error generating recovery link:", linkError);
      
      // If the email is not registered, we exit silently for security (preventing user enumeration)
      if (linkError.message?.toLowerCase().includes("user not found") || linkError.message?.toLowerCase().includes("not found")) {
        console.log(`[Email Server] User not found for email: ${email}. Exiting silently.`);
        return { success: true };
      }
      
      throw new Error("Failed to generate password recovery link.");
    }

    const actionLink = linkData.properties.action_link;

    // 4. Configure Nodemailer transport using Google SMTP credentials
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === "true", // defaults to false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // 5. Send recovery email
    const mailOptions = {
      from: process.env.SMTP_FROM || (process.env.SMTP_USER ? `"Qevrix Discipline Monitor" <${process.env.SMTP_USER}>` : `"Qevrix Discipline Monitor"`),
      to: email,
      subject: "Reset Your Password - QEVRIX",
      html: `
        <div style="font-family: sans-serif; max-width: 550px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1e293b;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 24px; font-weight: bold; color: #22c55e; letter-spacing: -0.025em;">QEVRIX</span>
          </div>
          <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px;">Set your new password</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
            We received a request to reset the password for your QEVRIX account. Please click the button below to configure your new credentials:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionLink}" style="background-color: #22c55e; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(34, 197, 94, 0.2);">Reset Password</a>
          </div>
          <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-top: 24px;">
            If you did not request this email, you can safely ignore it. Your password will remain unchanged.
          </p>
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
          <p style="font-size: 11px; line-height: 1.4; color: #94a3b8; margin: 0;">
            This email was sent automatically by Qevrix Guardian.<br />
            Department of Information Science and Engineering · Global Academy of Technology
          </p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`[Email Server] Recovery email successfully sent to ${email}`);
      return { success: true };
    } catch (sendError) {
      console.error("[Email Server] Nodemailer dispatch failed:", sendError);
      throw new Error("The mail server was unable to send your password reset email.");
    }
  });

export const notifyTeacherNewStudent = createServerFn({ method: "POST" })
  .validator((data: { studentId: string }) => {
    if (!data.studentId || typeof data.studentId !== "string") {
      throw new Error("Student ID is required");
    }
    return data;
  })
  .handler(async ({ data: { studentId } }) => {
    const supabaseAdmin = await createAdminClient();
    const caller = await requireRole(supabaseAdmin, ["student", "teacher", "admin"]);

    // 1. Get the student details (include approval_email_sent check here, server-side)
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id, full_name, usn, branch_id, email, status, approval_email_sent")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      console.error("[Email Server] Error fetching student details:", studentError);
      throw new Error("Student not found.");
    }

    if (!caller.roles.includes("admin") && !caller.roles.includes("teacher")) {
      const { data: ownStudent } = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("id", studentId)
        .eq("user_id", caller.userId)
        .maybeSingle();
      if (!ownStudent) throw new Error("Forbidden.");
    }

    if (caller.roles.includes("teacher") && !caller.roles.includes("admin")) {
      await assertCanDecideStudent(supabaseAdmin, caller, studentId);
    }

    // Guard: don't re-send if already sent
    if (student.approval_email_sent) {
      console.log(`[Email Server] Teacher notification already sent for student ${studentId}. Skipping.`);
      return { success: true };
    }

    console.log(`[Email Server] Processing teacher notification for student: ${student.full_name} (${student.usn}), branch_id: ${student.branch_id}`);

    // 2. Get the branch details
    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("code, name")
      .eq("id", student.branch_id)
      .single();

    const branchLabel = branch ? `${branch.code} - ${branch.name}` : "Unknown Branch";
    console.log(`[Email Server] Student branch: ${branchLabel}`);

    // 3. Find the teachers of that branch
    const { data: teachers, error: teachersError } = await supabaseAdmin
      .from("teachers")
      .select("full_name, email, status")
      .eq("branch_id", student.branch_id);

    if (teachersError) {
      console.error("[Email Server] Error fetching branch teachers:", teachersError);
    }

    const activeTeachers = (teachers ?? []).filter(t => t.email);
    console.log(`[Email Server] Found ${activeTeachers.length} teachers for branch ${student.branch_id}:`, activeTeachers.map(t => t.email));

    if (activeTeachers.length === 0) {
      console.warn(`[Email Server] No teachers found for branch ${student.branch_id}. Cannot send notification.`);
      // Still mark as sent so we don't keep retrying
      await supabaseAdmin
        .from("students")
        .update({ approval_email_sent: true })
        .eq("id", studentId);
      return { success: true };
    }

    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465,
      secure: process.env.SMTP_SECURE !== "false", // defaults to true for 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Send notification email to each teacher
    for (const teacher of activeTeachers) {
      const mailOptions = {
        from: process.env.SMTP_FROM || (process.env.SMTP_USER ? `"Qevrix Discipline Monitor" <${process.env.SMTP_USER}>` : `"Qevrix Discipline Monitor"`),
        to: teacher.email,
        subject: "New Student Signup Awaiting Approval - QEVRIX",
        html: `
          <div style="font-family: sans-serif; max-width: 550px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 24px; font-weight: bold; color: #22c55e; letter-spacing: -0.025em;">QEVRIX</span>
            </div>
            <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px;">Student Signup Awaiting Approval</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
              Hello ${teacher.full_name},
            </p>
            <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
              A new student has registered for your department and is awaiting approval:
            </p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin-bottom: 24px; font-size: 14px; color: #334155;">
              <strong>Student Name:</strong> ${student.full_name}<br/>
              <strong>USN:</strong> ${student.usn}<br/>
              <strong>Branch / Department:</strong> ${branchLabel}<br/>
              <strong>Email:</strong> ${student.email}
            </div>
            <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
              Please log in to the Qevrix Dashboard to review and approve their registration.
            </p>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
            <p style="font-size: 11px; line-height: 1.4; color: #94a3b8; margin: 0;">
              This notification email was sent automatically by Qevrix Guardian.
            </p>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`[Email Server] ✅ Teacher notification email sent to ${teacher.email}`);
      } catch (err) {
        console.error(`[Email Server] ❌ Failed to send email to teacher ${teacher.email}:`, err);
      }
    }

    // 4. Update the student record to mark email sent
    const { error: updateErr } = await supabaseAdmin
      .from("students")
      .update({ approval_email_sent: true })
      .eq("id", studentId);

    if (updateErr) {
      console.error("[Email Server] Failed to mark approval_email_sent:", updateErr);
    } else {
      console.log(`[Email Server] ✅ Marked approval_email_sent=true for student ${studentId}`);
    }

    return { success: true };
  });

export const decideStudentApproval = createServerFn({ method: "POST" })
  .validator((data: { studentId: string; status: "active" | "rejected"; rejectionReason?: string; decidedBy?: string }) => {
    if (!data.studentId || typeof data.studentId !== "string") {
      throw new Error("Student ID is required");
    }
    if (!data.status || (data.status !== "active" && data.status !== "rejected")) {
      throw new Error("Invalid status");
    }
    return data;
  })
  .handler(async ({ data: { studentId, status, rejectionReason, decidedBy } }) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server configuration incomplete.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { apikey: supabaseAnonKey } },
    });

    // 1. Get the student details
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id, full_name, email, usn")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      console.error("[Email Server] Student not found for decision:", studentError);
      throw new Error("Student profile not found.");
    }

    // Format audit message for who processed this approval
    const decName = decidedBy || "Administrator";
    const formattedReason = status === "rejected"
      ? `Rejected by ${decName} (Reason: ${rejectionReason || "No reason provided"})`
      : `Approved by ${decName}`;

    // 2. Update the student status in the database
    const { error: updateError } = await supabaseAdmin
      .from("students")
      .update({
        status,
        rejection_reason: formattedReason
      })
      .eq("id", studentId);

    if (updateError) {
      console.error("[Email Server] Error updating student status:", updateError);
      throw new Error("Failed to update student profile.");
    }

    // 2.5. Insert audit log notification
    try {
      const { data: admin } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();
      const recipient = admin?.user_id || studentId;

      if (recipient) {
        await supabaseAdmin.from("notifications").insert({
          recipient_user_id: recipient,
          type: "system_audit",
          message: `${decName} updated student ${student.full_name} (${student.usn}) status to ${status === "active" ? "Approved" : "Rejected"}.${status === "rejected" ? ` Reason: ${rejectionReason || "No reason"}` : ""}`,
        });
      }
    } catch (auditErr) {
      console.error("[Email Server] Failed to insert audit log notification:", auditErr);
    }

    // 3. Send the custom SMTP email to the student
    if (student.email) {
      const nodemailer = await import("nodemailer");

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465,
        secure: process.env.SMTP_SECURE !== "false",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const isApproved = status === "active";
      const subject = isApproved ? "Account Approved - QEVRIX" : "Account Registration Update - QEVRIX";
      const appUrl = "http://localhost:5173";

      const mailHtml = isApproved 
        ? `
          <div style="font-family: sans-serif; max-width: 550px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 24px; font-weight: bold; color: #22c55e; letter-spacing: -0.025em;">QEVRIX</span>
            </div>
            <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px;">Account Registration Approved!</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
              Hello ${student.full_name},
            </p>
            <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
              We are pleased to inform you that your QEVRIX account registration (USN: ${student.usn}) has been approved by your department!
            </p>
            <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
              You can now log in to the dashboard to view your discipline records, notifications, and analytics.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/login" style="background-color: #22c55e; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block;">Log In to Dashboard</a>
            </div>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
            <p style="font-size: 11px; line-height: 1.4; color: #94a3b8; margin: 0;">
              This notification email was sent automatically by Qevrix Guardian.
            </p>
          </div>
        `
        : `
          <div style="font-family: sans-serif; max-width: 550px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 24px; font-weight: bold; color: #ef4444; letter-spacing: -0.025em;">QEVRIX</span>
            </div>
            <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px;">Account Registration Update</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
              Hello ${student.full_name},
            </p>
            <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
              We regret to inform you that your QEVRIX account registration (USN: ${student.usn}) was not approved by your department.
            </p>
            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 15px; border-radius: 6px; margin-bottom: 24px; font-size: 14px; color: #991b1b;">
              <strong>Reason for Rejection:</strong> ${rejectionReason || "Please verify your registration details."}
            </div>
            <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
              Please contact your department teacher or administrator for further information.
            </p>
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
            <p style="font-size: 11px; line-height: 1.4; color: #94a3b8; margin: 0;">
              This notification email was sent automatically by Qevrix Guardian.
            </p>
          </div>
        `;

      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || (process.env.SMTP_USER ? `"Qevrix Discipline Monitor" <${process.env.SMTP_USER}>` : `"Qevrix Discipline Monitor"`),
          to: student.email,
          subject: subject,
          html: mailHtml,
        });
        console.log(`[Email Server] Status notification email sent to student ${student.email}`);
      } catch (err) {
        console.error(`[Email Server] Failed to send email to student ${student.email}:`, err);
      }
    }

    return { success: true };
  });

/**
 * Creates the student record, profile, and user_role on the server
 * using the service role key. This bypasses the database trigger
 * which may not have been set up correctly.
 */
export const createStudentRecord = createServerFn({ method: "POST" })
  .validator((data: {
    userId: string;
    email: string;
    fullName: string;
    role: "student" | "teacher";
    usn?: string;
    branchId?: string;
    semester?: number;
    phone?: string;
  }) => {
    if (!data.userId) throw new Error("userId is required");
    if (!data.email) throw new Error("email is required");
    if (!data.fullName) throw new Error("fullName is required");
    return data;
  })
  .handler(async ({ data }) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[Server] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      throw new Error("Server configuration incomplete.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { apikey: supabaseAnonKey } },
    });

    console.log(`[Server] Creating records for ${data.role}: ${data.fullName} (${data.email})`);

    // 1. Check if profile already exists (trigger may have partially succeeded)
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", data.userId)
      .single();

    if (!existingProfile) {
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: data.userId,
          email: data.email,
          full_name: data.fullName,
          phone: data.phone || "",
        });
      if (profileErr) {
        console.error("[Server] Profile insert error:", profileErr);
        // Don't throw — continue, profile might already exist
      } else {
        console.log("[Server] Profile created");
      }
    } else {
      console.log("[Server] Profile already exists");
    }

    // 2. Insert user role if not exists
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", data.userId)
      .single();

    if (!existingRole) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: data.userId,
          role: data.role,
        });
      if (roleErr) {
        console.error("[Server] Role insert error:", roleErr);
      } else {
        console.log(`[Server] Role '${data.role}' created`);
      }
    } else {
      console.log("[Server] Role already exists");
    }

    // 3. Insert role-specific record
    if (data.role === "student") {
      // Check if student record already exists
      const { data: existingStudent } = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("user_id", data.userId)
        .single();

      if (!existingStudent) {
        const { error: studentErr } = await supabaseAdmin
          .from("students")
          .insert({
            user_id: data.userId,
            full_name: data.fullName,
            usn: data.usn || "UNKNOWN",
            email: data.email,
            phone: data.phone || null,
            branch_id: data.branchId || null,
            semester: data.semester || null,
            status: "pending_approval",
          });
        if (studentErr) {
          console.error("[Server] Student insert error:", studentErr);
          throw new Error(`Failed to create student record: ${studentErr.message}`);
        }
        console.log("[Server] Student record created successfully");
      } else {
        console.log("[Server] Student record already exists");
      }
    } else if (data.role === "teacher") {
      const { data: existingTeacher } = await supabaseAdmin
        .from("teachers")
        .select("id")
        .eq("user_id", data.userId)
        .single();

      if (!existingTeacher) {
        const { error: teacherErr } = await supabaseAdmin
          .from("teachers")
          .insert({
            user_id: data.userId,
            full_name: data.fullName,
            email: data.email,
            phone: data.phone || null,
            branch_id: data.branchId || null,
            status: "active",
          });
        if (teacherErr) {
          console.error("[Server] Teacher insert error:", teacherErr);
          throw new Error(`Failed to create teacher record: ${teacherErr.message}`);
        }
        console.log("[Server] Teacher record created successfully");
      } else {
        console.log("[Server] Teacher record already exists");
      }
    }

    return { success: true };
  });

/**
 * Fetches pending students using service role (bypasses RLS).
 * Only returns data if the caller is a teacher.
 */
export const fetchPendingStudents = createServerFn({ method: "GET" })
  .handler(async () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server configuration incomplete.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { apikey: supabaseAnonKey } },
    });

    const { data, error } = await supabaseAdmin
      .from("students")
      .select("id, full_name, usn, semester, phone, email, profile_photo_url, created_at, status, rejection_reason, branch_id")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Server] Error fetching students:", error);
      throw new Error("Failed to fetch students.");
    }

    return data ?? [];
  });

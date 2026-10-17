import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFriendlyErrorMessage(error: any, fallback = "An unexpected error occurred. Please try again.") {
  if (!error) return fallback;

  const message = error.message || (typeof error === "string" ? error : "");

  // Suppress loud console.error for expected user-entry states, use console.warn instead
  const isCommonUserError = 
    message.includes("Invalid login credentials") || 
    message.includes("Email not confirmed") || 
    message.includes("User not found");

  if (isCommonUserError) {
    console.warn("[Auth System Info]:", message);
  } else {
    // Log genuine system or unexpected errors
    console.error("[Auth System Error]:", error);
  }

  if (!message || message === "{}" || message.includes("Internal Server Error") || message.includes("500") || message.includes("Database error")) {
    return "The server encountered an error processing your request. Please try again in a few moments or contact support.";
  }

  if (message.includes("Invalid login credentials")) {
    return "Incorrect email or password. Please verify your details and try again.";
  }
  if (
    message.includes("Password should contain") ||
    message.includes("Password is too weak") ||
    message.includes("password must contain") ||
    message.includes("password should have") ||
    message.includes("Password does not meet")
  ) {
    return "Password does not meet security requirements. It must include at least 8 characters, an uppercase letter, a lowercase letter, a number, and a symbol (!@#$%).";
  }
  if (
    message.includes("Failed to fetch") ||
    message.includes("ERR_INTERNET_DISCONNECTED") ||
    message.includes("NetworkError") ||
    message.includes("AuthRetryableFetchError")
  ) {
    return "Unable to connect to the authentication server. Please check your internet connection and try again.";
  }
  if (message.includes("Email not confirmed")) {
    return "Your email address has not been verified yet. Please check your inbox for the verification link.";
  }
  if (message.includes("User not found")) {
    return "No account was found with this email address.";
  }
  if (message.includes("rate limit") || message.includes("Too many requests")) {
    return "Too many requests. Please wait a bit before trying again.";
  }

  return message;
}

export function validatePasswordPolicy(password: string): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter (a-z).";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter (A-Z).";
  }
  if (!/\d/.test(password)) {
    return "Password must contain at least one number (0-9).";
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return "Password must contain at least one special symbol (!@#$%^&*...).";
  }
  return null;
}


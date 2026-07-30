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

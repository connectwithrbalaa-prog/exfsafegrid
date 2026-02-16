import { z } from "zod";

/** Max file size for hazard photo uploads: 5MB */
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

/** Allowed MIME types for hazard photos */
export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const subscriberSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be under 100 characters"),
  email: z.string().trim().email("Invalid email").max(255).or(z.literal("")),
  phone: z.string().trim().max(20, "Phone must be under 20 characters").regex(/^[+\d\s()-]*$/, "Invalid phone format").or(z.literal("")),
  zip_code: z.string().regex(/^\d{5}$/, "Must be a 5-digit ZIP"),
  preferred_channel: z.enum(["email", "sms", "both"]),
});

export const manualAlertSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(1000, "Message must be under 1000 characters"),
  zips: z.array(z.string()).min(1, "Select at least one ZIP code"),
  severity: z.enum(["critical", "high", "warning", "info"]),
});

export const hazardReportSchema = z.object({
  hazard_type: z.string().min(1, "Select a hazard type"),
  description: z.string().trim().max(2000, "Description must be under 2000 characters").optional(),
  customer_name: z.string().trim().max(100).optional(),
});

export function validatePhoto(file: File): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return `Unsupported file type. Allowed: JPEG, PNG, WebP, HEIC`;
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return `File too large. Maximum size is ${MAX_PHOTO_SIZE / 1024 / 1024}MB`;
  }
  return null;
}

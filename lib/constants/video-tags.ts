// ============================================================
// Shared constants for video tagging
// Place at: lib/constants/video-tags.ts (or wherever your constants live)
// ============================================================

export const VIDEO_CATEGORIES = [
  { value: "webinar", label: "Webinar" },
  { value: "operative_technique", label: "Operative Technique" },
  { value: "endoscopy", label: "Endoscopy" },
  { value: "conference", label: "Conference" },
  { value: "lecture", label: "Lecture" },
] as const;

export type VideoCategory = (typeof VIDEO_CATEGORIES)[number]["value"];

// Same subspecialty list used across events, videos, fellowships, etc.
export const SUBSPECIALTIES = [
  "Cancer - Colon",
  "Cancer - Rectal",
  "Cancer - Anal",
  "Cancer - Advanced",
  "Peritoneal Malignancy",
  "IBD",
  "Abdominal Wall",
  "Pelvic Floor",
  "Proctology",
  "Fistula",
  "Intestinal Failure",
  "Emergency",
  "Trauma",
  "Research",
  "Endoscopy",
  "Training",
  "Radiology",
  "Robotic",
  "Laparoscopic",
  "Open",
  "TAMIS",
  "General",
] as const;

export type Subspecialty = (typeof SUBSPECIALTIES)[number];
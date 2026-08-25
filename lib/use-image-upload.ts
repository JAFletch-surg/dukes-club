'use client'

// Images are just files — useFileUpload does the work, this name keeps
// reading right at the image-only call sites.
export { useFileUpload as useImageUpload } from '@/lib/use-file-upload'

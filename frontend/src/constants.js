export const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/sg-as-price-list.firebasestorage.app/o/Screenshot%202026-02-04%20021131.png?alt=media'

// Maps the UploadArea tab labels to their routes.
export const TAB_ROUTES = {
  'Client Requirement': '/crd',
  'Business Requirement': '/brd',
  'Internal Requirement': '/ird',
  'Product Requirement': '/prd',
}

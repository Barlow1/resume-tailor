// Z-index scale for consistent layering across the app
// base(0-9): inline elements within panels
// dropdown(10-19): dropdowns, tooltips
// panel(20-49): slide-out panels, overlays within builder
// toolbar(50-99): floating toolbar, action bars
// nav(100-149): navigation, persistent UI
// widget(150-199): onboarding widget, non-blocking overlays
// modal(200-249): all modals (subscribe, creation, job, AI assistant)
// system(250-299): system-level overlays (spotlight, error boundaries)

export const Z_INDEX = {
  base: 'z-0',
  dropdown: 'z-10',
  panel: 'z-20',
  toolbar: 'z-50',
  nav: 'z-[100]',
  widget: 'z-[150]',
  modal: 'z-[200]',
  modalBackdrop: 'z-[199]',
  system: 'z-[250]',
} as const

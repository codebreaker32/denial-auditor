// The demo has no real accounts. Signing in only sets a flag in this browser so the app opens on reload.
const KEY = "da.demo-session"

export const DEMO = {
  workspace: "Example Spine & Joint Clinic",
  workspaceNote: "synthetic",
  user: "Jordan Reyes",
  role: "Billing specialist",
} as const

export function hasSession(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}
export function startSession() {
  try {
    window.localStorage.setItem(KEY, "1")
  } catch {
    /* storage blocked: the session lasts for this page only */
  }
  memory = true
}
export function endSession() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* nothing stored */
  }
  memory = false
}
let memory = false
// A shared deep link can carry ?demo=1 to open straight into the demo workspace (there is no real account to skip).
function demoLink(): boolean {
  if (typeof window === "undefined" || !/[?&]demo=1\b/.test(window.location.hash)) return false
  startSession()
  return true
}
export const signedIn = () => memory || hasSession() || demoLink()

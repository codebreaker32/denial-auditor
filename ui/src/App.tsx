import { MotionConfig } from "framer-motion"
import { Component, lazy, Suspense, useEffect, type ReactNode } from "react"
import { TooltipProvider } from "@/components/skiper/skiper101"
import { useHash } from "@/lib/router"

// Route-level chunks: the landing, the sign-in and the signed-in app each load on their own.
const Landing = lazy(() => import("@/landing/Landing"))
const Login = lazy(() => import("@/app/Login").then((m) => ({ default: m.Login })))
const AppRoute = lazy(() => import("@/app/Routes"))
// The approved mockup, kept for reference.
const CompB = lazy(() => import("@/comps/b/Comp"))

// A screen that is mid-edit can fail to import; say so instead of showing a white page.
class Boundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main style={{ fontFamily: "Geist, system-ui", padding: 48, color: "#4c4e47", lineHeight: 1.5 }}>
        This screen didn't load. Refresh the page; if it keeps happening, the API on port 8600 may be down.
      </main>
    )
  }
}

export default function App() {
  const hash = useHash()
  const route = hash.startsWith("#/comp/") ? "comp" : hash.startsWith("#/login") ? "login" : hash.startsWith("#/app") ? "app" : "landing"
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={80}>
        <Boundary resetKey={route}>
          <Suspense fallback={<div style={{ minHeight: "100dvh", background: route === "landing" ? "#0b0c0a" : undefined }} />}>
            {route === "landing" && <Landing />}
            {route === "login" && <Login />}
            {route === "app" && <AppRoute path={hash} />}
            {route === "comp" && <CompB />}
          </Suspense>
        </Boundary>
      </TooltipProvider>
    </MotionConfig>
  )
}

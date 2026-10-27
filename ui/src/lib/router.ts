// Hash routes: #/ landing, #/login, #/app[/c/case_id | /checks | /live | /how], #/comp/b (reference mockup).
import { useEffect, useState } from "react"

export function useHash() {
  const [hash, setHash] = useState(() => window.location.hash || "#/")
  useEffect(() => {
    const on = () => setHash(window.location.hash || "#/")
    window.addEventListener("hashchange", on)
    return () => window.removeEventListener("hashchange", on)
  }, [])
  return hash
}

export function go(to: string) {
  if (window.location.hash !== to) window.location.hash = to
}

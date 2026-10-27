// The signed-in app's routes, loaded as one chunk after sign-in.
import { useEffect } from "react"
import { go } from "@/lib/router"
import { signedIn } from "@/lib/session"
import { Shell } from "@/app/Shell"
import { Checks, How, Live } from "@/app/Pages"
import { Queue } from "@/features/queue/Queue"

export default function AppRoute({ path }: { path: string }) {
  const ok = signedIn()
  useEffect(() => {
    if (!ok) go("#/login")
  }, [ok])
  if (!ok) return null
  const m = path.match(/^#\/app\/c\/(case_\d+)/)
  if (m) return <Shell section="worklist"><Queue caseId={m[1]} /></Shell>
  if (path.startsWith("#/app/checks")) return <Shell section="checks"><Checks /></Shell>
  if (path.startsWith("#/app/live")) return <Shell section="live"><Live /></Shell>
  if (path.startsWith("#/app/how")) return <Shell section="how"><How /></Shell>
  return <Shell section="worklist"><Queue caseId={null} /></Shell>
}

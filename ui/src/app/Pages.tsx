// The other app sections. Each lives in its own feature folder; this file only routes to them.
import { useHash } from "@/lib/router"
import { CheckList, CheckView } from "@/features/check/Checks"
import { Live as LiveRun } from "@/features/live/Live"
import { How as HowItWorks } from "@/features/how/How"

// #/app/checks lists the saved checks; #/app/checks/case_009 opens one.
export function Checks() {
  const hash = useHash()
  const id = hash.match(/^#\/app\/checks\/(case_\d+)/)?.[1] ?? null
  return id ? <CheckView key={id} id={id} /> : <CheckList />
}

export function Live() {
  return <LiveRun />
}

export function How() {
  return <HowItWorks />
}

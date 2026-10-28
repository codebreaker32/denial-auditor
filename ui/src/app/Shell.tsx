// The signed-in app: a quiet rail with the demo workspace, the four sections and the user menu.
import { ChevronsUpDown, ClipboardCheck, Inbox, LogOut, PlayCircle, Route } from "lucide-react"
import type { ReactNode } from "react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCases, useDrift } from "@/lib/api"
import { fmtDate, initials } from "@/lib/data"
import { go } from "@/lib/router"
import { DEMO, endSession } from "@/lib/session"
import { Glyph, SkipLink, Wordmark } from "@/features/ui"
import { AppToaster } from "@/features/toast"
import "./app.css"

const NAV = [
  { key: "worklist", href: "#/app", label: "Worklist", short: "Worklist", icon: Inbox },
  { key: "checks", href: "#/app/checks", label: "Prior-auth checks", short: "Checks", icon: ClipboardCheck },
  { key: "live", href: "#/app/live", label: "Run live", short: "Run live", icon: PlayCircle },
  { key: "how", href: "#/app/how", label: "How it works", short: "How", icon: Route },
]

export function Shell({ section, children }: { section: string; children: ReactNode }) {
  const { data } = useCases()
  const drift = useDrift().data
  const open = data?.cases.length ?? 0
  const changed = drift?.items.filter((i) => i.affects_case).length ?? 0
  const signOut = () => {
    endSession()
    go("#/login")
  }
  return (
    <div className="shell">
      <SkipLink />
      <aside className="rail" aria-label="Main">
        <a href="#/" className="rail-brand" aria-label="Denial Auditor home">
          <Wordmark />
        </a>
        <DropdownMenu>
          <DropdownMenuTrigger className="ws" title="Switch workspace">
            <span className="avatar t-ink ws-av" aria-hidden="true">SJ</span>
            <span className="ws-t">
              <b>{DEMO.workspace}</b>
              <span>Demo workspace · {DEMO.workspaceNote}</span>
            </span>
            <ChevronsUpDown size={15} strokeWidth={1.7} className="ws-x" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="menu w-[248px]">
            <DropdownMenuLabel className="menu-l">Workspaces</DropdownMenuLabel>
            <DropdownMenuItem className="menu-i">
              <span className="avatar t-ink ws-av" aria-hidden="true">SJ</span> {DEMO.workspace}
              <Glyph name="check" size={13} className="ml-auto t-ink" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <p className="menu-note">This demo has one workspace of synthetic patients. Real practices would see theirs here.</p>
          </DropdownMenuContent>
        </DropdownMenu>

        <nav className="rail-nav">
          {NAV.map((n) => (
            <a key={n.key} href={n.href} className="rail-i" aria-current={section === n.key ? "page" : undefined}>
              <n.icon size={17} strokeWidth={1.6} aria-hidden="true" />
              <span className="rail-l">{n.label}</span>
              <span className="rail-s" aria-hidden="true">{n.short}</span>
              {n.key === "worklist" && open > 0 && <span className="rail-n mono num">{open}</span>}
            </a>
          ))}
        </nav>

        <p className="rail-watch">
            <Glyph name={changed ? "half" : "check"} size={13} className={changed ? "t-warn" : "t-pos"} />
            <span>
              {drift ? (changed ? `${changed} cited policies changed` : `All ${drift.items.length} cited policies are current`) : "Policy watch"}
              {drift?.checked_at && <span className="rail-sub">Checked {fmtDate(drift.checked_at.slice(0, 10))}</span>}
            </span>
          </p>

        <div className="rail-foot">
          <DropdownMenu>
            <DropdownMenuTrigger className="me" title="Account">
              <span className="avatar t-quiet" aria-hidden="true">{initials(DEMO.user)}</span>
              <span className="me-t">
                <b>{DEMO.user}</b>
                <span>{DEMO.role}</span>
              </span>
              <ChevronsUpDown size={15} strokeWidth={1.7} className="ws-x" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="menu w-[232px]">
              <DropdownMenuLabel className="menu-l">Demo user, no real account</DropdownMenuLabel>
              <DropdownMenuItem className="menu-i" onSelect={() => go("#/")}>Back to the overview</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="menu-i" onSelect={signOut}>
                <LogOut size={14} strokeWidth={1.7} /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main className="main" id="main" tabIndex={-1}>
        <div className="notice" role="note">
          <span>
            <b>Synthetic data, no real patients.</b> Deadlines count from the demo review date{data ? `, ${fmtDate(data.as_of)}` : ""}.
          </span>
          <span className="notice-r">CPT © American Medical Association. All rights reserved.</span>
        </div>
        {children}
      </main>
      <AppToaster />
    </div>
  )
}

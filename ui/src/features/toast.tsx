// Toasts (work-state changes with an undo, copies, exports). One container for the whole app, mounted in the shell,
// so a toast survives switching cases. Sonner, styled as an ink chip (.tst in app/app.css).
import { Toaster, toast } from "sonner"

export function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      gap={8}
      offset={20}
      mobileOffset={12}
      duration={5000}
      toastOptions={{ unstyled: true, classNames: { toast: "tst", title: "tst-t", description: "tst-d", actionButton: "tst-a" } }}
    />
  )
}

export function notify(title: string, undo?: () => void, description?: string) {
  toast(title, {
    description,
    action: undo ? { label: "Undo", onClick: undo } : undefined,
  })
}

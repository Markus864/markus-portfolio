import { ReactNode } from "react"
import { AppSidebar } from "./AppSidebar"

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground" data-testid="layout-container">
      <AppSidebar />
      <main className="flex-1 px-8 py-6" data-testid="layout-main">
        {children}
      </main>
    </div>
  )
}

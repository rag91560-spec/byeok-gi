"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { UpdateBanner } from "@/components/UpdateBanner"
import { SyncWorker } from "@/components/SyncWorker"

/** Routes that render without Sidebar/UpdateBanner (standalone windows) */
const BARE_ROUTES = ["/overlay", "/region-select"]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBare = BARE_ROUTES.some((r) => pathname.startsWith(r))

  if (isBare) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <UpdateBanner />
        <SyncWorker />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

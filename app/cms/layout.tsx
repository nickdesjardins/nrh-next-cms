"use client"

import React, { type ReactNode, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, FileText, PenTool, Users, Settings, ChevronRight, LogOut, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-full w-full py-20">
    <div className="relative">
      <div className="h-16 w-16 rounded-full border-t-4 border-b-4 border-primary animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full bg-background"></div>
      </div>
    </div>
  </div>
)

type NavItemProps = {
  href: string
  icon: React.ElementType
  children: React.ReactNode
  isActive?: boolean
  adminOnly?: boolean
  isAdmin?: boolean
}

const NavItem = ({ href, icon: Icon, children, isActive, adminOnly, isAdmin }: NavItemProps) => {
  if (adminOnly && !isAdmin) return null

  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
          isActive
            ? "bg-primary/10 text-primary dark:bg-primary/20"
            : "text-slate-600 hover:text-primary hover:bg-primary/5 dark:text-slate-300 dark:hover:bg-primary/10",
        )}
      >
        <Icon className="h-5 w-5" />
        <span>{children}</span>
        {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
      </Link>
    </li>
  )
}

export default function CmsLayout({ children }: { children: ReactNode }) {
  const { user, role, isLoading, isAdmin, isWriter } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const pathname = typeof window !== "undefined" ? window.location.pathname : ""

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/sign-in?redirect=/cms/dashboard")
      } else if (!isWriter && !isAdmin) {
        router.push("/unauthorized?reason=insufficient_role_in_layout")
      }
    }
  }, [user, role, isLoading, router, isAdmin, isWriter])

  // Override parent layout constraints
  useEffect(() => {
    // Find the parent container with max-width constraint
    const parentContainer = document.querySelector(".max-w-7xl")
    if (parentContainer) {
      // Remove the max-width constraint and adjust padding
      parentContainer.classList.remove("max-w-7xl", "p-5")
      parentContainer.classList.add("w-full", "p-0")
    }
  }, [])

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!user || (!isWriter && !isAdmin)) {
    return <LoadingSpinner />
  }

  // Get user initials for avatar
  const getInitials = () => {
    if (!user?.email) return "U"
    return user.email.charAt(0).toUpperCase()
  }

  const getRoleColor = () => {
    if (isAdmin) return "bg-amber-500"
    if (isWriter) return "bg-emerald-500"
    return "bg-sky-500"
  }

  return (
    <div className="w-full flex flex-col md:flex-row">
      {/* Mobile sidebar toggle */}
      <div className="fixed bottom-4 left-4 z-[100] md:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="bg-white shadow-md dark:bg-slate-800 rounded-full h-12 w-12"
        >
          {sidebarOpen ? <ChevronRight className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 bg-white shadow-lg transition-transform duration-300 ease-in-out dark:bg-slate-800 dark:border-r dark:border-slate-700",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="p-4 h-16">
            <div className="flex items-center gap-2 px-2">
              <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold">
                CMS
              </div>
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70 dark:from-primary dark:to-primary/80">
                Content Hub
              </h2>
            </div>
          </div>

          <Separator className="mb-4" />

          {/* Navigation */}
          <nav className="px-3 flex-1 overflow-y-auto">
            <ul className="space-y-1.5">
              <NavItem href="/cms/dashboard" icon={LayoutDashboard} isActive={pathname === "/cms/dashboard"}>
                Dashboard
              </NavItem>
              <NavItem href="/cms/pages" icon={FileText} isActive={pathname === "/cms/pages"}>
                Pages
              </NavItem>
              <NavItem href="/cms/posts" icon={PenTool} isActive={pathname === "/cms/posts"}>
                Posts
              </NavItem>

              {isAdmin && (
                <>
                  <div className="mt-6 mb-2">
                    <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                      Administration
                    </p>
                  </div>
                  <NavItem
                    href="/cms/users"
                    icon={Users}
                    isActive={pathname === "/cms/users"}
                    adminOnly
                    isAdmin={isAdmin}
                  >
                    Manage Users
                  </NavItem>
                  <NavItem
                    href="/cms/settings"
                    icon={Settings}
                    isActive={pathname === "/cms/settings"}
                    adminOnly
                    isAdmin={isAdmin}
                  >
                    Settings
                  </NavItem>
                </>
              )}
            </ul>
          </nav>

          {/* User info */}
          <div className="mt-auto p-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-white shadow-sm dark:border-slate-700">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate dark:text-slate-200">{user.email}</p>
                <div className="flex items-center gap-1.5">
                  <div className={cn("h-2 w-2 rounded-full", getRoleColor())}></div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{role}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn("flex-1 transition-all duration-300 ease-in-out w-full", sidebarOpen ? "md:ml-0" : "ml-0")}>
        {/* Page header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 mb-6">
          <div className="flex items-center justify-between h-16 px-6">
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              {pathname.includes("/dashboard")
                ? "Dashboard"
                : pathname.includes("/pages")
                  ? "Pages"
                  : pathname.includes("/posts")
                    ? "Posts"
                    : pathname.includes("/users")
                      ? "User Management"
                      : pathname.includes("/settings")
                        ? "Settings"
                        : "CMS"}
            </h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="hidden md:flex">
                Help
              </Button>
              <Button size="sm">New Content</Button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="px-6 pb-6 w-full">{children}</div>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}

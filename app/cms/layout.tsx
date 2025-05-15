// app/cms/layout.tsx
"use client"

import React, { type ReactNode, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard, FileText, PenTool, Users, Settings, ChevronRight, LogOut, Menu, ListTree, Image as ImageIconLucide, X, Languages as LanguagesIconLucide // Added LanguagesIconLucide
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

// ... (LoadingSpinner and NavItem components remain the same)
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
  writerOnly?: boolean
  isAdmin?: boolean
  isWriter?: boolean
}

const NavItem = ({ href, icon: Icon, children, isActive, adminOnly, writerOnly, isAdmin, isWriter }: NavItemProps) => {
  if (adminOnly && !isAdmin) return null
  if (writerOnly && !isWriter && !isAdmin) return null

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

  useEffect(() => {
    const parentLayoutMain = document.querySelector('body > div > main > div.flex-1.w-full.flex.flex-col.items-center');
    if (parentLayoutMain) {
      parentLayoutMain.classList.remove("max-w-7xl");
    }
    const mainScreenChild = document.querySelector('main.min-h-screen > div.flex-1.w-full');
     if (mainScreenChild) {
        mainScreenChild.classList.remove("max-w-7xl");
    }
  }, [])


  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!user || (!isWriter && !isAdmin)) {
    return <LoadingSpinner />;
  }

  const getInitials = () => user?.email?.charAt(0).toUpperCase() || "U";
  const getRoleColor = () => isAdmin ? "bg-amber-500" : isWriter ? "bg-emerald-500" : "bg-sky-500";

  let pageTitle = "CMS";
  if (pathname === "/cms/dashboard") pageTitle = "Dashboard";
  else if (pathname.startsWith("/cms/pages/new")) pageTitle = "New Page";
  else if (pathname.startsWith("/cms/pages/") && pathname.endsWith("/edit")) pageTitle = "Edit Page";
  else if (pathname.startsWith("/cms/pages")) pageTitle = "Pages";
  else if (pathname.startsWith("/cms/posts/new")) pageTitle = "New Post";
  else if (pathname.startsWith("/cms/posts/") && pathname.endsWith("/edit")) pageTitle = "Edit Post";
  else if (pathname.startsWith("/cms/posts")) pageTitle = "Posts";
  else if (pathname.startsWith("/cms/navigation/new")) pageTitle = "New Navigation Item";
  else if (pathname.startsWith("/cms/navigation/") && pathname.endsWith("/edit")) pageTitle = "Edit Navigation Item";
  else if (pathname.startsWith("/cms/navigation")) pageTitle = "Navigation";
  else if (pathname.startsWith("/cms/media/") && pathname.endsWith("/edit")) pageTitle = "Edit Media Item";
  else if (pathname.startsWith("/cms/media")) pageTitle = "Media Library";
  else if (pathname.startsWith("/cms/users/") && pathname.endsWith("/edit")) pageTitle = "Edit User Profile";
  else if (pathname.startsWith("/cms/users")) pageTitle = "User Management";
  else if (pathname.startsWith("/cms/settings/languages/new")) pageTitle = "New Language"; // New
  else if (pathname.startsWith("/cms/settings/languages") && pathname.includes("/edit")) pageTitle = "Edit Language"; // New
  else if (pathname.startsWith("/cms/settings/languages")) pageTitle = "Language Settings"; // New
  else if (pathname.startsWith("/cms/settings")) pageTitle = "Settings";


  return (
    <div className="w-full flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950">
      <div className="fixed bottom-4 left-4 z-[100] md:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="bg-white shadow-lg dark:bg-slate-800 rounded-full h-12 w-12"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <aside
        className={cn(
          "fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-white shadow-lg transition-transform duration-300 ease-in-out dark:bg-slate-900 dark:border-r dark:border-slate-700/60",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0 md:top-0 md:h-screen",
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b dark:border-slate-700/60 h-16 flex items-center">
            <div className="flex items-center gap-2 px-2">
              <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold">
                NRH
              </div>
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70 dark:from-primary dark:to-primary/80">
                CMS
              </h2>
            </div>
          </div>

          <nav className="px-3 py-4 flex-1 overflow-y-auto">
            <ul className="space-y-1.5">
              <NavItem href="/cms/dashboard" icon={LayoutDashboard} isActive={pathname === "/cms/dashboard"} isAdmin={isAdmin} isWriter={isWriter}>
                Dashboard
              </NavItem>
              <NavItem href="/cms/pages" icon={FileText} isActive={pathname.startsWith("/cms/pages")} writerOnly isAdmin={isAdmin} isWriter={isWriter}>
                Pages
              </NavItem>
              <NavItem href="/cms/posts" icon={PenTool} isActive={pathname.startsWith("/cms/posts")} writerOnly isAdmin={isAdmin} isWriter={isWriter}>
                Posts
              </NavItem>
              <NavItem href="/cms/media" icon={ImageIconLucide} isActive={pathname.startsWith("/cms/media")} writerOnly isAdmin={isAdmin} isWriter={isWriter}>
                Media
              </NavItem>

              {isAdmin && (
                <>
                  <div className="mt-6 mb-2">
                    <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                      Administration
                    </p>
                  </div>
                  <NavItem href="/cms/navigation" icon={ListTree} isActive={pathname.startsWith("/cms/navigation")} adminOnly isAdmin={isAdmin}>
                    Navigation
                  </NavItem>
                  <NavItem href="/cms/users" icon={Users} isActive={pathname.startsWith("/cms/users")} adminOnly isAdmin={isAdmin}>
                    Manage Users
                  </NavItem>
                  <NavItem href="/cms/settings/languages" icon={LanguagesIconLucide} isActive={pathname.startsWith("/cms/settings/languages")} adminOnly isAdmin={isAdmin}>
                    Languages
                  </NavItem>
                  <NavItem href="/cms/settings" icon={Settings} isActive={pathname.startsWith("/cms/settings") && !pathname.startsWith("/cms/settings/languages")} adminOnly isAdmin={isAdmin}>
                    Other Settings
                  </NavItem>
                </>
              )}
            </ul>
          </nav>

          <div className="mt-auto p-4 border-t border-slate-200 dark:border-slate-700/60">
            {/* User info ... */}
             <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-white shadow-sm dark:border-slate-700">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate dark:text-slate-200">{user?.email}</p>
                <div className="flex items-center gap-1.5">
                  <div className={cn("h-2 w-2 rounded-full", getRoleColor())}></div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{role}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className={cn("flex-1 transition-all duration-300 ease-in-out w-full min-h-screen", sidebarOpen ? "md:ml-64" : "md:ml-0")}>
        <div className="bg-background dark:bg-slate-800/30 border-b border-border h-16 flex items-center px-6 sticky top-0 z-30 w-full">
            <Button variant="ghost" size="icon" className="md:hidden mr-3 -ml-2" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <Menu className="h-5 w-5" />
            </Button>
           <h1 className="text-lg font-semibold text-foreground">
              {pageTitle}
            </h1>
        </div>
        <div className="p-6 w-full">
            {children}
        </div>
      </main>
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}
    </div>
  )
}

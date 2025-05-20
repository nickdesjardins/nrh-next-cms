// app/cms/layout.tsx
"use client"

import React, { type ReactNode, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard, FileText, PenTool, Users, Settings, ChevronRight, LogOut, Menu, ListTree, Image as ImageIconLucide, X, Languages as LanguagesIconLucide
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { signOutAction } from "@/app/actions";

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-full w-full py-20">
    <div className="relative">
      <div className="h-16 w-16 rounded-full border-t-4 border-b-4 border-primary animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full bg-background"></div>
      </div>
    </div>
  </div>
);

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
};


export default function CmsLayout({ children }: { children: ReactNode }) {
  const { user, profile, role, isLoading, isAdmin, isWriter } = useAuth();
  const router = useRouter();
  // CMS sidebar should be closed by default on mobile
  const [cmsSidebarOpen, setCmsSidebarOpen] = React.useState(false); 
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/sign-in?redirect=/cms/dashboard");
      } else if (!isWriter && !isAdmin) {
        router.push("/unauthorized?reason=insufficient_role_in_layout");
      }
    }
  }, [user, role, isLoading, router, isAdmin, isWriter]);

  useEffect(() => {
    const mainLayoutElement = document.querySelector('body > div > main > div.flex-1.w-full.flex.flex-col.items-center');
    if (mainLayoutElement) {
      mainLayoutElement.classList.remove('max-w-7xl');
      (mainLayoutElement as HTMLElement).style.padding = '0';
    }
     const mainScreenChild = document.querySelector('main.min-h-screen > div.flex-1.w-full');
     if (mainScreenChild) {
        mainScreenChild.classList.remove("max-w-7xl");
    }

    // Ensure CMS sidebar is open on desktop by default if preferred, adjust based on screen size.
    // This example keeps it collapsible on mobile, respects `md:sticky` for desktop.
    const handleResize = () => {
      if (window.innerWidth >= 768) { // 'md' breakpoint
        setCmsSidebarOpen(true); // Or keep it as is if you want it to remember its state on desktop
      } else {
        // On mobile, if it was forced open by resize, ensure it's closed unless explicitly opened by user
        // This part is tricky; usually, you don't force it closed on resize to mobile,
        // but let the `useState(false)` be the default for mobile.
        // If you want it open by default on desktop:
        // setCmsSidebarOpen(window.innerWidth >= 768);
      }
    };
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);

  }, []);


  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user || (!isWriter && !isAdmin)) {
    // This will likely show the spinner due to the redirect logic in useEffect
    return <LoadingSpinner />;
  }

  const getInitials = () => {
    if (profile?.full_name) return profile.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    if (profile?.username) return profile.username.substring(0,2).toUpperCase();
    return user?.email?.charAt(0).toUpperCase() || "U";
  }
  const getRoleColor = () => isAdmin ? "bg-amber-500" : isWriter ? "bg-emerald-500" : "bg-sky-500";

  let pageTitle = "Dashboard";
  if (pathname === "/cms/dashboard") pageTitle = "Dashboard";
  else if (pathname.startsWith("/cms/pages/new")) pageTitle = "New Page";
  else if (pathname.startsWith("/cms/pages/") && pathname.endsWith("/edit")) pageTitle = "Edit Page";
  else if (pathname.startsWith("/cms/pages")) pageTitle = "Pages";
  else if (pathname.startsWith("/cms/posts/new")) pageTitle = "New Post";
  else if (pathname.startsWith("/cms/posts/") && pathname.endsWith("/edit")) pageTitle = "Edit Post";
  else if (pathname.startsWith("/cms/posts")) pageTitle = "Posts";
  else if (pathname.startsWith("/cms/navigation/new")) pageTitle = "New Navigation Item";
  else if (pathname.startsWith("/cms/navigation/") && pathname.includes("/edit")) pageTitle = "Edit Navigation Item";
  else if (pathname.startsWith("/cms/navigation")) pageTitle = "Navigation";
  else if (pathname.startsWith("/cms/media/") && pathname.endsWith("/edit")) pageTitle = "Edit Media Item";
  else if (pathname.startsWith("/cms/media")) pageTitle = "Media Library";
  else if (pathname.startsWith("/cms/users/") && pathname.endsWith("/edit")) pageTitle = "Edit User Profile";
  else if (pathname.startsWith("/cms/users")) pageTitle = "User Management";
  else if (pathname.startsWith("/cms/settings/languages/new")) pageTitle = "New Language";
  else if (pathname.startsWith("/cms/settings/languages") && pathname.includes("/edit")) pageTitle = "Edit Language";
  else if (pathname.startsWith("/cms/settings/languages")) pageTitle = "Language Settings";
  else if (pathname.startsWith("/cms/settings")) pageTitle = "Settings";


  return (
    <div className="w-full flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 min-h-screen">
      {/* CMS Mobile Toggle Button */}
      <div className="fixed bottom-4 right-4 z-[60] md:hidden"> {/* Lowered z-index for toggle slightly, ResponsiveNav is z-50 for content */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCmsSidebarOpen(!cmsSidebarOpen)}
          className="bg-white shadow-lg dark:bg-slate-800 rounded-full h-12 w-12"
        >
          {cmsSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* CMS Sidebar */}
      <aside
        className={cn(
          "fixed md:sticky top-0 left-0 h-screen w-64 bg-white shadow-lg transition-transform duration-300 ease-in-out dark:bg-slate-900 dark:border-r dark:border-slate-700/60",
          "md:translate-x-0", // Default behavior for medium screens and up
          cmsSidebarOpen ? "translate-x-0" : "-translate-x-full", // Controls mobile visibility
          "z-30" // CMS Sidebar z-index (ResponsiveNav uses z-40 for its sliding container, z-50 for overlay/content)
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b dark:border-slate-700/60 h-16 flex items-center shrink-0">
            <Link href="/cms/dashboard" className="flex items-center gap-2 px-2">
              <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold">
                NRH
              </div>
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70 dark:from-primary dark:to-primary/80">
                CMS
              </h2>
            </Link>
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
                </>
              )}
            </ul>
          </nav>

          <div className="mt-auto p-3 border-t border-slate-200 dark:border-slate-700/60 shrink-0">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.username || user?.email} />
                <AvatarFallback className="bg-primary/10 text-primary font-medium">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-slate-700 dark:text-slate-200">{profile?.full_name || profile?.username || user?.email}</p>
                <div className="flex items-center gap-1.5">
                  <div className={cn("h-2 w-2 rounded-full", getRoleColor())}></div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{role}</p>
                </div>
              </div>
              <form action={signOutAction}>
                <Button type="submit" variant="ghost" size="icon" className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300" title="Sign Out">
                    <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area for CMS */}
      <div className="flex-1 transition-all duration-300 ease-in-out w-full">
        {/* CMS Header bar */}
        <header className="bg-background dark:bg-slate-800/30 border-b border-border h-16 flex items-center px-6 sticky top-0 z-20 w-full shrink-0"> {/* CMS Header z-index below CMS sidebar */}
            <Button variant="ghost" size="icon" className="md:hidden mr-3 -ml-2" onClick={() => setCmsSidebarOpen(!cmsSidebarOpen)}>
                <Menu className="h-5 w-5" />
            </Button>
           <h1 className="text-lg font-semibold text-foreground">
              {pageTitle}
            </h1>
        </header>
        <main className="p-6 w-full overflow-y-auto h-[calc(100vh-4rem)]">
            {children}
        </main>
      </div>

      {/* CMS Sidebar Overlay - z-index lower than CMS sidebar */}
      {cmsSidebarOpen && ! (window.innerWidth >= 768) && ( // Only show overlay on mobile when cmsSidebarOpen
        <div 
            className="fixed inset-0 bg-black/30 z-20 md:hidden" // z-index below CMS sidebar (z-30) but above content
            onClick={() => setCmsSidebarOpen(false)} 
        />
      )}
    </div>
  )
}
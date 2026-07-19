"use client";import { usePathname } from "next/navigation";import { AppProvider } from "@/components/app-provider";import { AppShell } from "@/components/layout/app-shell";
export function ClientLayout({children}:{children:React.ReactNode}){const path=usePathname();return <AppProvider>{path==="/login"?children:<AppShell>{children}</AppShell>}</AppProvider>}

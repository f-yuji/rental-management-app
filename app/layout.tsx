import type { Metadata } from "next";import "./globals.css";import "./purchase.css";import { ClientLayout } from "./client-layout";
export const metadata:Metadata={title:"賃貸管理",description:"賃貸物件・貸地・資材置場管理"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ja"><body><ClientLayout>{children}</ClientLayout></body></html>}

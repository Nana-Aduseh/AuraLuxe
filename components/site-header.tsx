"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/header";

export default function SiteHeader() {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return <Header />;
}
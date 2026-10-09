"use client";

import { BrandLogo } from "@/components/shared/BrandLogo";

export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 text-white">
        <div>
          <BrandLogo height={40} priority className="rounded-md" />
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">People operations, simplified.</h2>
          <p className="mt-4 text-white/80 text-lg">Attendance, requests, and team insights in one place.</p>
        </div>
        <p className="text-sm text-white/60">© Analytico Technologies</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 bg-muted-bg">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <BrandLogo height={36} priority className="rounded-md" />
          </div>
          <div className="bg-white rounded-2xl shadow-elevated p-8 border border-border/50">
            <h1 className="text-2xl font-semibold text-center mb-1">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground text-center mb-6">{subtitle}</p>}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

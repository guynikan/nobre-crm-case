import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { AppHeader } from "./app-header";
import { Providers } from "./providers";
import "./globals.css";

const sans = Roboto({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-roboto" });
const mono = Roboto_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-roboto-mono" });

export const metadata: Metadata = {
  title: "Nobre CRM · Funil de vendas",
  description: "Funil comercial de brindes corporativos do Grupo Nobre",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable}`}>
      <body className="bg-paper font-sans text-ink antialiased">
        <Providers>
          <AppHeader />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}

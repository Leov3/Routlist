import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routlis",
  description: "Botonera modular de audios para operacion",
  icons: {
    icon: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/platform-branding/favicon`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-surface text-on-surface font-sans transition-colors duration-300">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

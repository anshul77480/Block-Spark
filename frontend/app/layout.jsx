import "./globals.css";
import { Toaster } from "@/components/toast";

export const metadata = {
  title: "BlockSpark — Insider Threat SOC",
  description: "Insider Threat Detection & Response console",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-base font-sans text-ink antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}

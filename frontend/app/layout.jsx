import "./globals.css";
import { Toaster } from "@/components/toast";

export const metadata = {
  title: "BlockSpark — Insider Threat SOC",
  description: "Insider Threat Detection & Response console",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23080b12'/><path d='M50 12 L82 28 L50 44 L18 28 Z M18 28 V64 L50 80 V44 Z M82 28 V64 L50 80' fill='none' stroke='%2300df9a' stroke-width='6' stroke-linejoin='round'/><path d='M50 25 L65 43 H52 L58 63 L35 45 H48 Z' fill='%2300df9a'/></svg>",
  },
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

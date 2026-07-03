import "./globals.css";

export const metadata = {
  title: "Insider Threat SOC",
  description: "Insider Threat Detection & Response POC",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-soc-bg text-slate-200 antialiased">{children}</body>
    </html>
  );
}

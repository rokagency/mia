import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mia",
  description: "Embedded chat agents for businesses.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

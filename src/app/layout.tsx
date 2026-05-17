import "./globals.css";
import type { Metadata } from "next";
import { getActiveBusiness } from "@/lib/active-business";

const TITLES = {
  es: (name: string) => `${name} — Mesa de entrada`,
  en: (name: string) => `${name} — Front Desk`,
};

const DESCRIPTIONS = {
  es: (name: string) =>
    `Hablá con Mia, la asistente virtual de ${name}, sobre turnos, tratamientos y consultas.`,
  en: (name: string) =>
    `Talk to Mia, the virtual receptionist for ${name}, about hours, services, and booking.`,
};

export async function generateMetadata(): Promise<Metadata> {
  const { business } = await getActiveBusiness();
  return {
    title: TITLES[business.language](business.name),
    description: DESCRIPTIONS[business.language](business.name),
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { business } = await getActiveBusiness();
  return (
    <html lang={business.language}>
      {/* suppressHydrationWarning silences the noise from browser extensions
          (Bitdefender, ColorZilla, etc.) that inject attributes into <body>
          after SSR. Only suppresses warnings on this one element. */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

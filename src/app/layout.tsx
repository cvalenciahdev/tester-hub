import type { Metadata } from "next";
import { TranslationProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Tester Hub",
    template: "%s · Tester Hub",
  },
  description: "Un espacio para descubrir apps en beta y encontrar testers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>
        <TranslationProvider>{children}</TranslationProvider>
      </body>
    </html>
  );
}

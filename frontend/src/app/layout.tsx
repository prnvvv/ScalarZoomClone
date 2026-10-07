import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/primitives.css";
import "@/styles/shell.css";
import "@/styles/dashboard.css";
import "@/styles/meeting.css";
import "@/styles/auth.css";
import { ToastProvider } from "@/components/common/ToastProvider";
import { authLocalization } from "@/lib/auth-appearance";

export const metadata: Metadata = {
  title: {
    default: "Scalar Meet",
    template: "%s | Scalar Meet",
  },
  description:
    "Video meetings made simple - start, schedule and join meetings from your browser.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b5cff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider localization={authLocalization}>
          <ToastProvider>{children}</ToastProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
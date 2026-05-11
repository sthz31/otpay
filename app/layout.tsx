import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "OTPay | Your phone number is your wallet",
    template: "%s | OTPay",
  },
  description:
    "OTPay lets you send, request, and approve stablecoin payments on Solana using a phone number instead of a wallet address.",
  icons: {
    icon: "/otpay.png",
    shortcut: "/otpay.png",
    apple: "/otpay.png",
    other: [
      { rel: "icon", url: "/otpay.png" },
      { rel: "mask-icon", url: "/otpay.png", color: "#A3E16C" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="icon" href="/otpay.png" type="image/png" />
        <link rel="apple-touch-icon" href="/otpay.png" />
        <meta name="theme-color" content="#A3E16C" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

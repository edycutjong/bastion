import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bastion.edycu.dev"),
  title: "Bastion — ZK compliance gateway for the Casper ecosystem",
  description:
    "An agentic compliance gateway where users prove they're KYC-compliant via a Groth16 ZK proof (no identity revealed), and a monitoring agent autonomously revokes them the moment they're not. Part of the Vouch suite on Casper.",
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: "Bastion — ZK compliance gateway for the Casper ecosystem",
    description: "An agentic compliance gateway where users prove they're KYC-compliant via a Groth16 ZK proof.",
    url: "https://bastion.edycu.dev",
    siteName: "Bastion",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Bastion",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bastion — ZK compliance gateway for the Casper ecosystem",
    description: "An agentic compliance gateway where users prove they're KYC-compliant via a Groth16 ZK proof.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

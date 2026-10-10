import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
// Yeni oluşturduğumuz anket butonunu içe aktarıyoruz
import FloatingSurveyButton from "./components/FloatingSurveyButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flick Bilet",
  description: "Ankara Medipol Sinema ve Tiyatro Topluluğu Bilet Sistemi",
  metadataBase: new URL('https://flickbilet.vercel.app'), 
  openGraph: {
    title: "Flick Bilet",
    description: "",
    images: [
      {
        url: '/opengraph-image.png',
        width: 300,
        height: 300,
        alt: 'Flick Bilet Logo',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr" // Dil desteğini Türkçe olarak güncelledim
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Driver.js (İnteraktif Rehber) CSS ve JS Linkleri */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.css"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/driver.js@1.3.1/dist/driver.js.iife.js"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Sayfa içerikleri burada render edilir */}
        {children}

        {/* 
          Anket Butonu: Sayfa içeriğinin altında tanımlansa da 
          CSS'indeki 'fixed' özelliği sayesinde ekranda sabit durur.
        */}
        <FloatingSurveyButton />
      </body>
    </html>
  );
}

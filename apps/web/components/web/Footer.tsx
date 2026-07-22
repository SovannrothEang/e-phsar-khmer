"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { IconBrandFacebook, IconPlayerPlayFilled,IconChevronUp } from "@tabler/icons-react";
import { FaFacebookF } from "react-icons/fa6";

import Image from "next/image";

export default function Footer() {
  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <>
      {showBackToTop && (
        <Button
          onClick={scrollToTop}
          className=" fixed bottom-6
          right-4 xl:right-[calc((100vw-1280px)/2-80px)]
          z-50
          size-12
          rounded-full
          bg-card border-border text-foreground
          shadow-lg
          hover:scale-105 hover:shadow-xl
          transition-all duration-300
          cursor-pointer"
          aria-label="Back to top"
        >
          <IconChevronUp className="scale-140" stroke={2}/>
        </Button>
      )}
      <footer className="bg-[#00a0e9] text-white pt-6 pb-6 mt-0">
        <div className="max-w-7xl mx-auto px-4 md:px-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold mb-4 text-base">Follow PSA-Khmer</h3>
              <div className="space-y-4 text-sm ">
                <a
                  href="https://www.facebook.com/khmer24.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-full hover:underline"
                >
                  <div className="flex items-center justify-center rounded-full bg-blue-500 w-7 h-7">
                    <IconBrandFacebook className="text-white scale-100" />
                  </div>
                  <span className="text-sm  text-white">Facebook</span>
                </a>
                <a
                  href="https://www.youtube.com/@Khmer24app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 hover:underline"
                >
                  <div className="flex items-center justify-center rounded-sm bg-red-500 w-7 h-5">
                    <IconPlayerPlayFilled className="text-white scale-50" />
                  </div>
                  <span className="text-sm font-medium text-white">
                    Youtube
                  </span>
                </a>
              </div>
            </div>

            {/* Customer Service */}
            <div>
              <h3 className="font-bold mb-4 text-base">Customer Service</h3>
              <ul className="space-y-3 text-sm px-2">
                <li>
                  <Link href="/contact-us" className="hover:underline">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link href="/privacy-policy" className="hover:underline">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/membership" className="hover:underline">
                    Membership
                  </Link>
                </li>
                <li>
                  <Link href="/account-deletion" className="hover:underline">
                    Account Deletion
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4 text-base">Useful Information</h3>
              <ul className="space-y-3 text-sm px-2">
                <li>
                  <Link href="/safety-tips" className="hover:underline">
                    Safety Tips
                  </Link>
                </li>
                <li>
                  <Link href="/posting-rule" className="hover:underline">
                    Posting Rule
                  </Link>
                </li>
                <li>
                  <Link href="/feedback" className="hover:underline">
                    Feedback
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4 text-base">
                Download PSA-NPIC app for FREE
              </h3>
              <div className="flex gap-3">
                <div className="bg-white p-1 rounded-sm">
                  <Image
                    src="https://www.khmer24.com/v2026.05.28/icon/khmer24-qr-code.png"
                    alt="QR"
                    width={100}
                    height={100}
                    unoptimized
                    className="w-26 h-26"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Link href="/">
                    <Image
                      src="https://www.khmer24.com/v2026.05.28/icon/appstore.png"
                      alt="App Store"
                      width={120}
                      height={38}
                      unoptimized
                      className="h-8 w-32"
                    />
                  </Link>
                  <Link href="/">
                    <Image
                      src="https://www.khmer24.com/v2026.05.28/icon/playstore.png"
                      alt="Play Store"
                      width={120}
                      height={38}
                      unoptimized
                      className="h-8 w-32"  
                    />
                  </Link>
                  <Link href="/">
                    <Image
                      src="https://www.khmer24.com/v2026.05.28/icon/app-gallery.png"
                      alt="App Gallery"
                      width={120}
                      height={38}
                      unoptimized
                      className="h-8 w-32"
                    />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center mt-3 flex-wrap justify-end">
            <span className="text-sm">We Accept:</span>
            {[
              "https://www.khmer24.com/icon/ABA.svg",
              "https://www.khmer24.com/icon/khqr.svg",
              "https://www.khmer24.com/icon/Visa.svg",
              "https://www.khmer24.com/icon/Mastercard.svg",
              "https://www.khmer24.com/icon/UPI.svg",
              "https://www.khmer24.com/icon/JCB.svg",
            ].map((src, i) => (
              <div
                key={i}
                className="bg-card/0 rounded-sm px-1 h-8 flex items-center"
              >
                <Image
                  src={src}
                  alt="payment"
                  loading="eager"
                  unoptimized
                  className="h-6 w-auto object-contain"
                  width={40}
                  height={20}
                />
              </div>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}

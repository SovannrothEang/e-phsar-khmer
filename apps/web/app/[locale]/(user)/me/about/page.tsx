
import { BadgeCheck, Globe, PhoneCall, MapPin, Mail } from 'lucide-react';
import { notFound } from "next/navigation"
import { currentUser } from '@/lib/user';

export default function AboutProfile() {

  if (!currentUser) {
    notFound();
  }
  return (
    <div className="h-full bg-muted pb-40 pt-2">
      <div className="max-w-7xl mx-auto pt-4">
        <h1 className="text-2xl font-medium">About</h1>
        <main className="max-w-7xl mx-auto pt-5">
          <div className="bg-card rounded-sm p-4 shadow-sm">
            <p className="font-medium text-base px-3 pt-3">Overview</p>
            <div className="flex px-3 pt-4">
              <BadgeCheck className="text-muted-foreground scale-90" />
              {currentUser.verified ? (
                <p className="text-muted-foreground ml-3">Verified</p>
              ) : (
                <p className="text-muted-foreground ml-3">Not Verified</p>
              )}
            </div>
            <div className="border-t border-muted-foreground/30 mt-3 mb-4 px-3" />
            <div className="flex px-3">
              <PhoneCall className="text-muted-foreground scale-90" />
              {currentUser.phone?.map((phone, index) => (
                <p key={index} className="text-[#00a0e9] hover:underline ml-3 cursor-pointer">{phone}</p>
              ))}
            </div>
            <div className="border-t border-muted-foreground/30 mt-3 mb-4 px-3" />
            <div className="flex px-3">
              <Mail className="text-muted-foreground scale-90" />
              <p className="text-[#00a0e9] ml-3 cursor-pointer">{currentUser.email}</p>
            </div>
            <div className="border-t border-muted-foreground/30 mt-3 mb-4 px-3" />
            <div className="flex px-3">
              <Globe className="text-muted-foreground scale-90" />
              <a href={currentUser.userlink} className="text-[#00a0e9] hover:underline ml-3 cursor-pointer">{currentUser.userlink}</a>
            </div>
            <div className="border-t border-muted-foreground/30 mt-3 mb-4 px-3" />
            <div className="flex px-3">
              <MapPin className="text-muted-foreground scale-90" />
              <p className="text-[#00a0e9] ml-3 cursor-pointer">{currentUser.locations}</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
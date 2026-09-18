import { Globe, MapPin, CircleCheckBig } from "lucide-react";
import { IconPhone, IconMailFilled } from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { User } from "@/lib/user";

export default function AboutProfile({ user }: { user: User }) {
  return (
    <div className="bg-muted">
      <div className="max-w-7xl mx-auto pb-50 px-4 pt-3">
        <h1 className="text-2xl font-medium">About</h1>
        <main className="max-w-7xl mx-auto mt-6">
          <div className="bg-card rounded-sm p-3 pb-10 space-y-3 shadow-sm">
            <p className="font-medium text-lg px-3 pt-3">Overview</p>

            <div className="flex items-center gap-2 px-3 pt-4">
              <CircleCheckBig className="text-muted-foreground scale-90" />
              {user.verified ? "Verified" : "Not Verified"}
            </div>
            {/* Wrapped in a container with px-3 to match the icon alignment */}
            <div className="px-3">
              <Separator className="my-3" />
            </div>

            <div className="flex items-center gap-2 px-3">
              <IconPhone className="text-muted-foreground scale-90" />
              {user.phone}
            </div>
            <div className="px-3">
              <Separator />
            </div>

            <div className="flex items-center gap-2 px-3">
              <IconMailFilled className="text-muted-foreground scale-90" />
              <a href={`mailto:${user.email}`} className="text-[#00a0e9]">
                {user.email}
              </a>
            </div>
            <div className="px-3">
              <Separator />
            </div>

            <div className="flex items-center gap-2 px-3">
              <Globe className="text-muted-foreground scale-90" />
              <a
                href={user.userlink}
                target="_self"
                rel="noreferrer"
                className="text-[#00a0e9] hover:underline truncate"
              >
                {user.userlink}
              </a>
            </div>
            <div className="px-3">
              <Separator />
            </div>

            <div className="flex items-center gap-2 px-3">
              <MapPin className="text-muted-foreground scale-90" />
              {user.locations}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

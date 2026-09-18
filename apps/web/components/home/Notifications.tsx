import { IconBellFilled } from "@tabler/icons-react";

const notifications = [
  {
    id: 1,
    message: "You have been logged in on a new device.",
    date: "15, Apr 2026",
    isUnread: true,
  },
  {
    id: 2,
    message: "You have been logged in on a new device.",
    date: "30, Mar 2026",
    isUnread: true,
  },
  {
    id: 3,
    message: "You have been logged in on a new device.",
    date: "30, Mar 2026",
    isUnread: true,
  },
  {
    id: 4,
    message: "You have been logged in on a new device.",
    date: "30, Mar 2026",
    isUnread: false,
  },
  {
    id: 5,
    message: "You have been logged in on a new device.",
    date: "29, Mar 2026",
    isUnread: true,
  },
  {
    id: 6,
    message: "You have been logged in on a new device.",
    date: "29, Mar 2026",
    isUnread: true,
  },
  {
    id: 7,
    message: "You have been logged in on a new device.",
    date: "29, Mar 2026",
    isUnread: false,
  },
  {
    id: 8,
    message: "You have been logged in on a new device.",
    date: "29, Mar 2026",
    isUnread: true,
  },
  {
    id: 9,
    message: "You have been logged in on a new device.",
    date: "29, Mar 2026",
    isUnread: false,
  },
  {
    id: 10,
    message: "You have been logged in on a new device.",
    date: "29, Mar 2026",
    isUnread: true,
  },
];

export default function Notifications() {
  return (
    <div className="min-h-screen bg-muted py-6 px-4">
      {/* Removed overflow-hidden here to allow sticky to work relative to the viewport */}
      <div className="max-w-[980px] mx-auto bg-background rounded-sm shadow-sm border border-muted relative">
        {/* Header Section */}
        <div className="flex items-center justify-between p-4 border-b border-muted sticky top-0 z-10 bg-background">
          <h1 className="text-xl font-semibold text-foreground">
            Notifications
          </h1>
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <IconBellFilled />
          </button>
        </div>

        <ul className="divide-y divide-background">
          {notifications.map((notif) => (
            <li key={notif.id} className="relative group">
              <div
                className={`flex items-start p-4 cursor-pointer transition-colors 
                  ${notif.isUnread ? "bg-muted hover:bg-gray-200" : "bg-background hover:bg-gray-200"}`}
              >
                {/* Bell Icon Circle */}
                <div className="flex-shrink-0 w-14 h-14 bg-muted rounded-full flex items-center justify-center ">
                  <IconBellFilled />
                </div>

                {/* Text Content */}
                <div className="ml-4 flex-1">
                  <p className="text-foreground  text-[17px] leading-tight mb-1">
                    {notif.message}
                  </p>
                  <p className="text-xs text-gray-600 font-medium">
                    {notif.date}
                  </p>
                </div>

                {/* Individual Action Button */}
                <button className=" group-hover:opacity-800 p-3 hover:bg-gray-500 rounded-full transition-all text-gray-400">
                  <IconBellFilled className="text-xl" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {/* Loading Spinner / Footer */}
        {/* <div className="py-8 flex flex-col items-center justify-center border-t border-gray-50">
          <Icon
            icon="svg-spinners:bars-rotate-fade"
            className="text-3xl text-blue-500 mb-2"
          />
          <span className="text-sm text-gray-500 font-medium">Loading...</span>
        </div> */}
      </div>
      <h1 className="item-center text-center text-gray-400  py-4">
        No more result!
      </h1>
    </div>
  );
}

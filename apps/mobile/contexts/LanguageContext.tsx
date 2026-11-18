import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setApiLocale } from "@/lib/api/client";

export type LanguageCode = "en" | "km";

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: any;
}

export const LANGUAGES: LanguageOption[] = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: require("@/assets/images/en-language.png"),
  },
  {
    code: "km",
    name: "Khmer",
    nativeName: "ខ្មែរ",
    flag: require("@/assets/images/kh-language.png"),
  },
];

// Dictionary translations for UI
const en = {
  settings: "Settings",
  language: "Language",
  theme: "Theme",
  notifications: "Notifications",
  notification: "Notification",
  account: "Account",
  postAd: "Post Ad",
  search: "Search...",
  categories: "Categories",
  subcategories: "Subcategories",
  brands: "Brands",
  brand: "Brand",
  models: "Models",
  all: "All",
  filters: "Filters",
  sort: "Sort",
  price: "Price",
  salary: "Salary",
  location: "Location",
  fullTime: "Full-time",
  partTime: "Part-time",
  internship: "Internship",
  freelance: "Freelance",
  showMore: "Show More",
  condition: "Condition",
  description: "Description",
  contactSeller: "Contact Seller",
  saveChanges: "Save Changes",
  deleteListing: "Delete Listing",
  selectLanguage: "Change Language",
  home: "Home",
  chat: "Chat",
  sell: "Sell",
  accountProfile: "Account Profile",
  nearbyListings: "Nearby Listings",
  nearbyTitle: "Nearby",
  nearbyPrompt: "Enable your location to show the listings near you.",
  nearbyAllow: "Allow Location Access",
  nearbyDenied: "Location is off. Allow it to see nearby ads.",
  nearbyBlocked: "Location is blocked. Enable it in Settings.",
  nearbyOpenSettings: "Open Settings",
  nearbyRetry: "Try again",
  nearbyEmpty: "No ads near you yet.",
  nearbyError: "Could not load nearby ads.",
  latestAds: "Latest Ads",
  trending: "Trending",
  seeAll: "See All",
  more: "More",
  less: "Less",
  viewFullSpecs: "View full specs",
  specifications: "Specifications",
  specsLoading: "Loading specifications…",
  trustedSpecs: "Trusted specs",
  trustedSpecsNote:
    "Specifications entered and maintained by PhsarKhmer staff.",
  productNotFound: "Product not found",
  specsEmpty: "No specifications available for this model yet.",
  specsLoadError: "Could not load the specifications.",
  retry: "Try again",
  goBack: "Go Back",
  typeMessage: "Type a message…",
  searchChats: "Search chats",
  loadMore: "Load more",
  noNotificationsYet: "No notifications yet.",
  deleteAllNotifications: "Delete all notifications",
  markAllRead: "Mark all as read",
  notificationSettings: "Notification settings",
  cancel: "Cancel",
  couldNotLoadCategories: "Could not load categories.",
  sayHello: "Say hello — messages are end-to-end encrypted.",
} as const;

export type TranslationKey = keyof typeof en;

const km: Record<TranslationKey, string> = {
  settings: "ការកំណត់",
  language: "ភាសា",
  theme: "រចនាប័ទ្ម",
  notifications: "ការជូនដំណឹង",
  notification: "ការជូនដំណឹង",
  account: "គណនី",
  postAd: "ចុះផ្សាយទំនិញ",
  search: "ស្វែងរក...",
  categories: "ជំពូកទំនិញ",
  subcategories: "ប្រភេទរង",
  brands: "ម៉ាក",
  brand: "ម៉ាក",
  models: "ម៉ូឌែល",
  all: "ទាំងអស់",
  filters: "តម្រង",
  sort: "តម្រៀប",
  price: "តម្លៃ",
  salary: "ប្រាក់ខែ",
  location: "ទីតាំង",
  fullTime: "ពេញម៉ោង",
  partTime: "ក្រៅម៉ោង",
  internship: "ហាត់ការ",
  freelance: "Freelance",
  showMore: "បង្ហាញបន្ថែមទៀត",
  condition: "លក្ខខណ្ឌ",
  description: "ការពិពណ៌នា",
  contactSeller: "ទាក់ទងអ្នកលក់",
  saveChanges: "រក្សាទុកការផ្លាស់ប្តូរ",
  deleteListing: "លុបទំនិញនេះ",
  selectLanguage: "ជ្រើសរើសភាសា",
  home: "ទំព័រដើម",
  chat: "សារ",
  sell: "លក់",
  accountProfile: "គណនីរបស់ខ្ញុំ",
  nearbyListings: "ទំនិញនៅជិតអ្នក",
  nearbyTitle: "នៅជិតអ្នក",
  nearbyPrompt: "បើកទីតាំងរបស់អ្នក ដើម្បីបង្ហាញការផ្សាយជិតអ្នក។",
  nearbyAllow: "អនុញ្ញាតឱ្យចូលប្រើទីតាំង",
  nearbyDenied: "ទីតាំងត្រូវបានបិទ។ អនុញ្ញាត ដើម្បីមើលការផ្សាយជិតអ្នក។",
  nearbyBlocked: "ទីតាំងត្រូវបានហាមឃាត់។ បើកវានៅក្នុងការកំណត់។",
  nearbyOpenSettings: "បើកការកំណត់",
  nearbyRetry: "ព្យាយាមម្ដងទៀត",
  nearbyEmpty: "មិនទាន់មានការផ្សាយជិតអ្នកទេ។",
  nearbyError: "មិនអាចផ្ទុកការផ្សាយជិតអ្នកបានទេ។",
  latestAds: "ទំនិញថ្មីៗ",
  trending: "កំពុងពេញនិយម",
  seeAll: "មើលទាំងអស់",
  more: "បន្ថែម",
  less: "តិចជាង",
  viewFullSpecs: "មើលលក្ខណៈបច្ចេកទេសពេញលេញ",
  specifications: "លក្ខណៈបច្ចេកទេស",
  specsLoading: "កំពុងផ្ទុកលក្ខណៈបច្ចេកទេស…",
  trustedSpecs: "ផ្ទៀងផ្ទាត់",
  trustedSpecsNote:
    "លក្ខណៈបច្ចេកទេសត្រូវបានបញ្ចូល និងថែទាំដោយក្រុមការងារ PhsarKhmer។",
  productNotFound: "រកមិនឃើញផលិតផល",
  specsEmpty: "មិនទាន់មានលក្ខណៈបច្ចេកទេសសម្រាប់ម៉ូដែលនេះទេ។",
  specsLoadError: "មិនអាចផ្ទុកលក្ខណៈបច្ចេកទេសបានទេ។",
  retry: "ព្យាយាមម្ដងទៀត",
  goBack: "ត្រឡប់ក្រោយ",
  typeMessage: "វាយសារ…",
  searchChats: "ស្វែងរកការសន្ទនា",
  loadMore: "មើលបន្ថែម",
  noNotificationsYet: "មិនទាន់មានការជូនដំណឹងទេ។",
  deleteAllNotifications: "លុបការជូនដំណឹងទាំងអស់",
  markAllRead: "សម្គាល់ទាំងអស់ថាបានអាន",
  notificationSettings: "ការកំណត់ការជូនដំណឹង",
  cancel: "បោះបង់",
  couldNotLoadCategories: "មិនអាចផ្ទុកប្រភេទទំនិញបានទេ។",
  sayHello: "ជម្រាបសួរ — សារត្រូវបានអ៊ិនគ្រីបពីចុងដល់ចុង។",
};

const translations: Record<LanguageCode, Record<TranslationKey, string>> = {
  en,
  km,
};

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: TranslationKey) => string;
  currentLanguageObj: LanguageOption;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
  currentLanguageObj: LANGUAGES[0],
});

const LANGUAGE_STORAGE_KEY = "phsarkhmer.language";

const isLanguageCode = (value: string | null): value is LanguageCode =>
  value === "en" || value === "km";

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<LanguageCode>("en");
  const [hydrated, setHydrated] = useState(false);

  // Restore the choice before the first screen paints, and put the stored
  // locale on the API client (it would otherwise reset to en on every launch).
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        const next = isLanguageCode(stored) ? stored : "en";
        setLanguageState(next);
        setApiLocale(next);
      })
      .catch(() => {
        // Unreadable storage: fall back to the default locale.
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep `Accept-Language` on every API call in step with the app locale.
  const setLanguage = (lang: LanguageCode): void => {
    setLanguageState(lang);
    setApiLocale(lang);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang).catch(() => {
      // The in-memory choice still applies for this session.
    });
  };

  const t = (key: TranslationKey): string => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  const currentLanguageObj =
    LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  if (!hydrated) return null;

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        currentLanguageObj,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

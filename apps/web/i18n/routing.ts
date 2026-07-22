
import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({

  locales: ["en", "km", "zh", "ko", "id", "vi"],

  defaultLocale: "en",

  pathnames: {
    "/": {
      en: "/",
      km: "/",
      zh: "/",
      ko: "/",
      id: "/",
      vi: "/",
    },
    "/login": {},
    "/register": {},
    "/forgot-password": {},

    "/category": {
    },

    "/category/[categorySlug]": {
    },

    "/category/[categorySlug]/[subcategorySlug]": {
    },

    "/category/[categorySlug]/[subcategorySlug]/[brandOrType]": {
    },

    "/category/[categorySlug]/[subcategorySlug]/[brandOrType]/[modelSlug]": {
    },

    "/post": {},
    "/[slug]": {
    },
    "/sell": {},

    "/about": {},
    "/contact": {
      en: "/contact",
      km: "/contact-haha",
      zh: "/kontaktiere-mich",
    },

    "/all-ads": {
      en: "/all-ads",
      km: "/all-ads",
      zh: "/all-ads",
    },

    "/dashboard": {},
    "/dashboard/categories": {},
    "/dashboard/subcategories": {},
    "/dashboard/attributes": {},
    "/dashboard/attributes/brands": {},
    "/dashboard/attributes/models": {},
    "/dashboard/attributes/bodytypes": {},
    "/dashboard/attributes/enginetypes": {},
    "/dashboard/attributes/vehicletypes": {},
    "/dashboard/attributes/accessories": {},
    "/dashboard/attributes/types": {},
    "/dashboard/attributes/jobtypes": {},
    "/dashboard/attributes/networks": {},
    "/dashboard/attributes/bathrooms": {},
    "/dashboard/attributes/bedrooms": {},
    "/dashboard/attributes/facings": {},
    "/dashboard/attributes/experiences": {},
    "/dashboard/attributes/storages": {},
    "/dashboard/attributes/screensizes": {},
    "/dashboard/attributes/rams": {},
    "/dashboard/attributes/cpus": {},
    "/dashboard/attributes/vgas": {},
    "/dashboard/attributes/colors": {},
    "/dashboard/attributes/years": {},
    "/dashboard/team": {},
    "/dashboard/users": {},
    "/dashboard/users-subscription": {},
    "/dashboard/subscription": {},
    "/dashboard/subscription/categories": {},
    "/dashboard/subscription/packages": {},
    "/dashboard/subscription/terms": {},
    "/dashboard/subscription/plans": {},
    "/dashboard/report": {},
    "/dashboard/report/users": {},
    "/dashboard/report/posts": {},
    "/dashboard/feedback": {},

    "/me": {
    },
    "/me/about": {},
    "/me/applied-jobs": {},
    "/me/billing-addresses": {},
    "/me/job-applications": {},
    "/me/likes": {},
    "/me/saved": {},
    "/me/subscriptions": {},

    "/[username]": {

    },
    "/[username]/about": {
      
    },
    "/membership": {  
     
    },

    "/premium-account": {
     
    },

    "/premium-account/[category]": {
    },
    "/checkout": {},
    "/settings": {},
    "/settings/edit-profile": {},
    "/settings/change-password": {},
    "/settings/change-username": {},
    "/settings/change-phone": {},
    "/settings/passkeys": {},
    "/settings/privacy": {},
    "/settings/devices": {},
    "/billing-addresses": {},
    "/billing-addresses/add": {},
    "/notifications": {},
    "/chats":{},
    "/contact-us": {
    },

    "/account-deletion": {
    },
    "/privacy-policy": {
    },

    "/feedback": {},

    "/posting-rule": {
    },

    "/safety-tips": {
    },

  }
});

export type Locale = (typeof routing.locales)[number];
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
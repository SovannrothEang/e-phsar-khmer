import type { ImageSourcePropType } from "react-native";

/**
 * Bundled category art, keyed by the backend category slug. The backend's
 * `icon` is often a dead storage object; the app keeps its own artwork for the
 * home grid (the web renders the backend icon, or nothing).
 */
const CATEGORY_IMAGES: Record<string, ImageSourcePropType> = {
  "cars-and-vehicles": require("@/assets/images/s-cars-and-vehicles.webp"),
  "phones-and-tablets": require("@/assets/images/s-mobile-phones-tablets.webp"),
  "computers-and-accessories": require("@/assets/images/s-computer-and-accessories.webp"),
  "electronics-and-appliances": require("@/assets/images/s-electronics-appliances.webp"),
  "home-and-land": require("@/assets/images/s-property-housing-rentals.webp"),
  jobs: require("@/assets/images/s-jobs.webp"),
  services: require("@/assets/images/s-services.webp"),
  "fashion-and-beauty": require("@/assets/images/s-fashion-beauty.webp"),
  "furniture-and-decor": require("@/assets/images/s-furniture-decor.webp"),
  "books-sports-and-hobbies": require("@/assets/images/s-books-sports-hobbies.webp"),
  pets: require("@/assets/images/s-pets.webp"),
  foods: require("@/assets/images/s-foods.webp"),
};

export function categoryImage(slug: string): ImageSourcePropType | undefined {
  return CATEGORY_IMAGES[slug];
}

import ReactionAdsPanel from "./reaction-ads-panel";

/** `/me/likes` — the listings this account liked, newest first. */
export default function LikedAds() {
  return <ReactionAdsPanel side="likes" />;
}

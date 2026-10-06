import ReactionAdsPanel from "./reaction-ads-panel";

/** `/me/saved` — the listings this account saved, newest first. */
export default function SavedAds() {
  return <ReactionAdsPanel side="saves" />;
}

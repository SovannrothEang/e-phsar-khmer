/**
 * The profile's `?tab=` view.
 *
 * The followers/following lists used to be their own routes, so opening one
 * re-rendered the whole profile around it. They are now a parameter on the
 * profile itself, and this is the one place that reads and writes it — the
 * counts in the header and the panel's own tabs both go through here, so they
 * cannot disagree about the name or the shape of the URL.
 */

/** The two lists a profile can show in place of its feed. */
export type ProfileTab = "following" | "followers";

/** The param a profile's `?tab=` reads, whatever it happens to be set to. */
export function readProfileTab(params: {
  get(key: string): string | null;
}): ProfileTab | null {
  const tab = params.get("tab");
  // Anything else — including a value someone hand-edited in — is the feed,
  // which is the page's default view rather than an error state.
  return tab === "following" || tab === "followers" ? tab : null;
}

/**
 * Show a list without navigating to it.
 *
 * Raw history rather than the router: the profile reads `searchParams`, so a
 * real navigation would re-render it on the server and throw away whatever the
 * visitor had open. Next routes `pushState` through the router anyway (so
 * `useSearchParams` consumers see the new URL), but it restores the tree it
 * already has instead of refetching — and pushing rather than replacing is what
 * gives the Back arrow something to step to.
 *
 * It is called from click handlers and never from an effect: on first mount
 * Next has not patched `history` yet, so an early call lands on the native one
 * with `data === null`, which wipes that entry's state and leaves Back dead.
 */
export function pushProfileTab(tab: ProfileTab): void {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  window.history.pushState(null, "", url);
}

/** Build the href a count links to, so middle-click and copy still work. */
export function profileTabHref(pathname: string, tab: ProfileTab): string {
  const url = new URLSearchParams({ tab });
  return `${pathname}?${url.toString()}`;
}

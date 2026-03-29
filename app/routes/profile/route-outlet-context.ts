/** Passed from `profile/layout` into `<Outlet context={...} />` for child routes (e.g. FAQ). */
export type ProfileLayoutOutletContext = {
  faqHeaderMode?: "full" | "compact";
};

/**
 * WebKit/Blink render the native `<select>` indicator in a fixed inset, so
 * horizontal padding usually does not separate the chevron from the border.
 *
 * Chevron + `padding-right` live in `app/app.css` as `.stg-native-select-chevron`
 * so they are not dropped when Tailwind’s `content` paths omit `app/utils/`.
 *
 * Pair with `pl-3` (or equivalent) instead of `px-3` so `padding-right` here is
 * not overridden by a conflicting `pr-*` from `px-3` in the stylesheet.
 */
export const NATIVE_SELECT_APPEARANCE_CLASS = "stg-native-select-chevron";

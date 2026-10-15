import { cache } from "react";

/**
 * The current instant, fixed for the duration of one request.
 *
 * `Date.now()` called directly in a component is impure: two reads during the
 * same render can disagree, so two "2h ago" labels on one page can be computed
 * from different instants. `cache()` memoises per request, so every relative
 * timestamp on a page is measured from the same moment — and the components
 * that consume it stay pure functions of their props.
 */
export const requestNow = cache((): number => Date.now());

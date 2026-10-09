/**
 * Creates the TanStack router with a shared React Query client in context.
 */
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { clearQueryCacheOnUserChange } from "@/lib/auth-query-cache";

export const getRouter = () => {
  const queryClient = new QueryClient();
  // Drop cached data when the signed-in account changes (sign-out or a different user).
  clearQueryCacheOnUserChange(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

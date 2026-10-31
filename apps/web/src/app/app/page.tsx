"use client";

import { useEffect } from "react";

/** App root redirect — visits to app.circuitsprotocol.com bare root redirect to /dashboard. */
export default function AppRoot() {
  useEffect(() => {
    window.location.replace("/dashboard");
  }, []);

  return <div className="flex min-h-[50vh] items-center justify-center text-sm text-text-secondary">Redirecting to Dashboard…</div>;
}

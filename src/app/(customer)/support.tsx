import * as React from "react";

import { RequireAuth } from "@/components/shared/role-guard";
import { SupportScreen } from "@/components/shared/support-screen";

export default function Screen() {
  return (
    <RequireAuth>
      <SupportScreen title="Help & support" />
    </RequireAuth>
  );
}

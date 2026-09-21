import * as React from "react";

import { RiderGate } from "@/components/shared/rider-gate";
import { SupportScreen } from "@/components/shared/support-screen";

/**
 * Inside the rider shell, not at `/support`.
 *
 * Deliberate, and carried over from the web app: linking a rider to the
 * customer support page dropped them behind the customer navigation, complete
 * with a cart and a restaurant list.
 */
export default function Screen() {
  return <RiderGate>{() => <SupportScreen />}</RiderGate>;
}

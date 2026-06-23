import { Suspense } from "react";

import { WebcamCheckScreen } from "@/features/webcam/webcam-check-screen";

export default function WebcamCheckPage() {
  return (
    <Suspense fallback={null}>
      <WebcamCheckScreen />
    </Suspense>
  );
}

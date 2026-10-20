import { Suspense } from "react";
import { PipelinePage } from "@/features/pipeline/pipeline-page";
import { Spinner } from "@/shared/ui/states";

export default function Home() {
  // useSearchParams needs a Suspense boundary so the shell can still be prerendered.
  return (
    <Suspense fallback={<div className="p-6"><Spinner /></div>}>
      <PipelinePage />
    </Suspense>
  );
}

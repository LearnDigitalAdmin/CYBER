/**
 * Mounted once at /desk/* in routes/AppRoutes.tsx. Routes are generated from the module registry, so adding a
 * desk tool never requires editing this file or the router.
 */
import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Frame from "./Frame";
import DeskHome from "./DeskHome";
import { DESK_MODULES } from "./registry";

const Loading = () => (
  <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading">
    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
  </div>
);

export default function DeskApp() {
  return (
    <Frame>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route index element={<DeskHome />} />
          {DESK_MODULES.map((m) => <Route key={m.path} path={`${m.path}/*`} element={<m.component />} />)}
          <Route path="*" element={<Navigate to="/desk" replace />} />
        </Routes>
      </Suspense>
    </Frame>
  );
}

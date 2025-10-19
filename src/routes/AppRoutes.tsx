// // AppRoutes.tsx
// import { Routes, Route, Navigate, useLocation } from "react-router-dom";
// import { motion } from "framer-motion";

// // Pages
// import HomePage from "../pages/HomePage";
// import ExplorePage from "../pages/ExplorePage";
// import AuthPage from "../pages/AuthPage";
// import SignupPage from "../pages/SignupPage";
// // import VerifyAccountPage from "../pages/VerifyAccountPage";
// import Dashboard from "../pages/DashboardLayout";
// import { useEffect, useState } from "react";
// import { onAuthStateChanged, type User } from "firebase/auth";
// import { auth } from "../services/firebaseService";
// // import TermsPage from "../pages/TermsPage";
// // import ContactPage from "../pages/ContactPage";
// // import { Loader } from "../components/global/Loader";

// /**
//  * AppRoutes:
//  * - Defines all main routes.
//  * - Protects authenticated pages (dashboard, verify, etc).
//  * - Handles animated route transitions.
//  */

// const AppRoutes: React.FC = () => {
//   const [user, setUser] = useState<User | null>(null);
//   //const [loading, setLoading] = useState(true);
//   const location = useLocation();

//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
//         console.log('Auth state changed:', firebaseUser);
//       setUser(firebaseUser);
//       //setLoading(false);
//     });
//     return () => unsubscribe();
//   }, []);

//   //if (loading) return <Loader message="Checking authentication..." />;

//   const ProtectedRoute = ({ children }: { children: React.ReactNode }) =>
//    user ? <>{children}</> : <Navigate to="/signin" replace />;

//   return (
//     <motion.div
//       key={location.pathname}
//       initial={{ opacity: 0, y: 10 }}
//       animate={{ opacity: 1, y: 0 }}
//       exit={{ opacity: 0, y: -10 }}
//       transition={{ duration: 0.25, ease: "easeOut" }}
//       className="min-h-screen bg-gray-50 text-gray-900"
//     >
//       <Routes location={location}>
//         {/* Public Routes */}
//         <Route path="/" element={<HomePage />} />
//         <Route path="/explore" element={<ExplorePage />} />
//         <Route path="/signin" element={<AuthPage />} />
//         <Route path="/signup" element={<SignupPage />} />
//         {/* <Route path="/terms" element={<TermsPage />} />
//         <Route path="/contact" element={<ContactPage />} /> */}

//         {/* Protected Routes */}
//         {/* <Route
//           path="/verify"
//           element={
//             <ProtectedRoute>
//               <VerifyAccountPage />
//             </ProtectedRoute>
//           }
//         />*/}
//         <Route
//           path="/dashboard/*"
//           element={
//             <ProtectedRoute>
//               <Dashboard />
//             </ProtectedRoute>
//           }
//         /> 

//         {/* Fallback */}
//         <Route path="*" element={<Navigate to="/" replace />} />
//       </Routes>
//     </motion.div>
//   );
// };

// export default AppRoutes;

// AppRoutes.tsx
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

// Pages
import HomePage from "../pages/HomePage";
import ExplorePage from "../pages/ExplorePage";
import AuthPage from "../pages/AuthPage";
import SignupPage from "../pages/SignupPage";
import Dashboard from "../pages/DashboardLayout";
import { useAuth } from "../context/authContext";
import UploadsPage from "../pages/Uploads";
import AddServices from "../pages/AddServices";
import FormPage from "../pages/Form";

/**
 * AppRoutes:
 * - Defines all main routes.
 * - Protects authenticated pages (dashboard, verify, etc).
 * - Handles animated route transitions.
 */

const AppRoutes: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  // Wait for initial auth check before rendering routes
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) =>
    currentUser ? <>{children}</> : <Navigate to="/signin" replace />;

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="min-h-screen bg-gray-50 text-gray-900"
    >
      <Routes location={location}>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/signin" element={<AuthPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/upload" element={<UploadsPage />} />
        <Route path="/services" element={<AddServices />} />
        <Route path="/form" element={<FormPage />} />
        {/* <Route path="/terms" element={<TermsPage />} />
        <Route path="/contact" element={<ContactPage />} /> */}

        {/* Protected Routes */}
        {/* <Route
          path="/verify"
          element={
            <ProtectedRoute>
              <VerifyAccountPage />
            </ProtectedRoute>
          }
        />*/}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        /> 

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </motion.div>
  );
};

export default AppRoutes;
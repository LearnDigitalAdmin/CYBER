// ============================================
// App.tsx
// ============================================

import { BrowserRouter } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import AppRoutes from "./routes/AppRoutes";
//import { DataProvider } from "./context/dataContext";
//import { Loader } from "./components/global/Loader";
import "./index.css";

/**
 * Root entry point of Cogvana Cyber PWA.
 * Wraps routes with Firebase context, framer-motion transitions,
 * and handles splash/loading before routes mount.
 */
const App: React.FC = () => {
  //const [isLoading, setIsLoading] = useState(true);

  // Simple initial splash delay (can be replaced by auth observer)
  // useEffect(() => {
  //   const timer = setTimeout(() => setIsLoading(false), 800);
  //   return () => clearTimeout(timer);
  // }, []);

  //if (isLoading) return <Loader message="Loading Cogvana Cyber..." />;

  return (
    <BrowserRouter>
      {/* <DataProvider> */}
        <AnimatePresence mode="wait">
          <AppRoutes />
        </AnimatePresence>
      {/* </DataProvider> */}
    </BrowserRouter>
  );
};

export default App;
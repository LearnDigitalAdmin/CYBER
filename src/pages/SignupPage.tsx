import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import AuthMethods from "../components/auth/AuthMethods";

/**
 * Low-friction signup: Google or phone (SMS code) only. Everything else (names, ID number, email, address) is
 * filled in afterwards on /complete-profile. Strict verification stays on Samuhia Desk.
 */
const SignupPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <motion.div
        className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-xl p-6 w-full max-w-md text-white"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm opacity-80">It takes a few seconds</p>
        </div>

        <AuthMethods onSuccess={(isNew) => navigate(isNew ? "/complete-profile" : "/dashboard")} />

        <div className="text-center mt-6 text-sm">
          <p>
            Already have an account?{" "}
            <a href="/signin" className="text-green-400 hover:underline">
              Sign In
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;

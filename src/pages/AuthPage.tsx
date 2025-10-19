import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, LogIn, X } from "lucide-react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../services/firebaseService";
import { useNavigate } from "react-router-dom";

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage("");
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage("Password reset email sent! Check your inbox.");
      setTimeout(() => {
        setShowResetModal(false);
        setResetEmail("");
        setResetMessage("");
      }, 3000);
    } catch (err: any) {
      setResetMessage(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <motion.div
        className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-xl p-6 w-full max-w-md text-white"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Sign In</h1>
          <p className="text-sm opacity-80">Using Email and Password</p>
        </div>

        <form onSubmit={handleEmailLogin}>
          <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 mb-4">
            <Mail className="w-5 h-5 text-gray-400 mr-2" />
            <input
              type="email"
              placeholder="Email address"
              className="bg-transparent flex-1 outline-none text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 mb-4">
            <Lock className="w-5 h-5 text-gray-400 mr-2" />
            <input
              type="password"
              placeholder="Password"
              className="bg-transparent flex-1 outline-none text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="text-right mb-4">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="text-sm text-green-400 hover:underline focus:outline-none"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center"
          >
            <LogIn className="mr-2 w-5 h-5" />
            {loading ? "Processing..." : "Sign In"}
          </button>
        </form>

        {message && <p className="mt-3 text-sm text-center text-yellow-300">{message}</p>}

        <div className="text-center mt-6 text-sm">
          <p>
            No account?{" "}
            <a href="/signup" className="text-green-400 hover:underline">
              Sign Up
            </a>
          </p>
        </div>
      </motion.div>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {showResetModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowResetModal(false)}
          >
            <motion.div
              className="bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md text-white"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Reset Password</h2>
                <button
                  onClick={() => setShowResetModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <p className="text-sm text-gray-400 mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handlePasswordReset}>
                <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 mb-4">
                  <Mail className="w-5 h-5 text-gray-400 mr-2" />
                  <input
                    type="email"
                    placeholder="Email address"
                    className="bg-transparent flex-1 outline-none text-white"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>

                {resetMessage && (
                  <p className={`mb-4 text-sm text-center ${resetMessage.includes('sent') ? 'text-green-400' : 'text-yellow-300'}`}>
                    {resetMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg transition"
                >
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuthPage;
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Mail, Lock, LogIn } from "lucide-react";
import { signInWithEmailAndPassword, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "../services/firebaseService";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

const AuthPage: React.FC = () => {
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const toggleMode = () => setIsEmailMode(!isEmailMode);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setupRecaptcha = async () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      );
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setupRecaptcha();
    setLoading(true);
    try {
      const confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmation(confirmationResult);
      setMessage("OTP sent! Check your phone.");
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await confirmation.confirm(otp);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setMessage("Invalid OTP");
    } finally {
      setLoading(false);
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
          <p className="text-sm opacity-80">
            {isEmailMode ? "Using Email and Password" : "Using Phone Number (OTP)"}
          </p>
        </div>

        <form onSubmit={isEmailMode ? handleEmailLogin : confirmation ? verifyOtp : handlePhoneLogin}>
          {!isEmailMode ? (
            <>
              <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 mb-4">
                <Phone className="w-5 h-5 text-gray-400 mr-2" />
                <input
                  type="tel"
                  placeholder="+254700000000"
                  className="bg-transparent flex-1 outline-none text-white"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              {confirmation && (
                <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 mb-4">
                  <Lock className="w-5 h-5 text-gray-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Enter OTP"
                    className="bg-transparent flex-1 outline-none text-white"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
                </div>
              )}
            </>
          ) : (
            <>
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
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg transition flex items-center justify-center"
          >
            <LogIn className="mr-2 w-5 h-5" />
            {loading ? "Processing..." : confirmation ? "Verify OTP" : "Sign In"}
          </button>
        </form>

        <div id="recaptcha-container"></div>

        {message && <p className="mt-3 text-sm text-center text-yellow-300">{message}</p>}

        <div className="text-center mt-6 text-sm">
          <button
            onClick={toggleMode}
            className="text-green-400 hover:underline focus:outline-none"
          >
            {isEmailMode ? "Use Phone instead" : "Use Email instead"}
          </button>
          <p className="mt-2">
            No account?{" "}
            <a href="/signup" className="text-green-400 hover:underline">
              Sign Up
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;

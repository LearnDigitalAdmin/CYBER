import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { sendEmailVerification, signOut, verifyBeforeUpdateEmail } from "firebase/auth";
import { auth } from "../services/firebaseService";
import { useAuth } from "../context/authContext";
import { apiMessage, updateAgentProfile, type ProfilePatch } from "../services/signupApi";
import { toLocalKePhone } from "../utils/phone";

interface Constituency {
  n: string;
  w: string[];
}
interface County {
  n: string;
  k: Constituency[];
}

const input = "w-full bg-gray-800 rounded-lg px-3 py-2 text-white outline-none placeholder-gray-500";
const label = "block text-xs text-gray-300 mb-1";
const EMAIL_RE = /^\S+@\S+\.\S+$/;

/**
 * Shown right after signup and required until finished: accounts created by the new signup are sent here by the
 * route gate (AppRoutes) until every required detail is present. Older accounts are never gated; for them this page
 * is just an optional edit form. Address is typed/selected by hand (county -> constituency -> ward), never taken from
 * the device location.
 */
const CompleteProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, firestoreUser, refreshUser } = useAuth();

  const [counties, setCounties] = useState<County[]>([]);
  const [name, setName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [email, setEmail] = useState("");
  const [shopName, setShopName] = useState("");
  const [county, setCounty] = useState("");
  const [constituency, setConstituency] = useState("");
  const [ward, setWard] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [emailVerified, setEmailVerified] = useState(!!currentUser?.emailVerified);
  const prefilled = useRef(false);
  const refreshRef = useRef(refreshUser);
  refreshRef.current = refreshUser;

  const stored = (firestoreUser ?? {}) as Record<string, string | boolean | undefined>;
  const gated = stored.profileComplete === false;
  const savedPending = typeof stored.pendingEmail === "string" ? stored.pendingEmail : "";

  const isGoogle = !!currentUser?.providerData.some((p) => p.providerId === "google.com");
  const phoneLocked = !!currentUser?.phoneNumber; // phone sign-in number is the login, not editable here
  const emailLocked = isGoogle; // Google controls this email

  useEffect(() => {
    let alive = true;
    import("../data/kenyaAdmin.json").then((m) => {
      if (alive) setCounties(m.default as County[]);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Prefill once from the saved profile
  useEffect(() => {
    if (prefilled.current || !firestoreUser) return;
    prefilled.current = true;
    const u = firestoreUser as Record<string, string | undefined>;
    setName(u.name ?? currentUser?.displayName ?? "");
    setIdNumber(u.id && u.id !== u.uid ? u.id : "");
    setPhone(u.phone ?? "");
    setAltPhone(u.altPhone ?? "");
    setShopName(u.shopName ?? "");
    setCounty(u.county ?? "");
    setConstituency(u.constituency ?? "");
    setWard(u.ward ?? "");
    setAddressLine(u.addressLine ?? "");
    setEmail(currentUser?.email ?? u.pendingEmail ?? u.email ?? "");
  }, [firestoreUser, currentUser]);

  // When the person comes back from the email link: reload the Auth user and copy the now-verified email to the profile.
  const savedEmail = (firestoreUser as { email?: string } | null)?.email ?? "";
  useEffect(() => {
    const sync = async () => {
      const u = auth.currentUser;
      if (!u) return;
      try {
        await u.reload();
      } catch {
        return;
      }
      setEmailVerified(u.emailVerified);
      if (u.email && u.emailVerified && u.email.toLowerCase() !== savedEmail.toLowerCase()) {
        try {
          await updateAgentProfile({});
          await refreshRef.current();
        } catch {
          /* the next save will retry */
        }
      }
    };
    void sync();
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, [savedEmail]);

  const constituencies = useMemo(() => counties.find((c) => c.n === county)?.k ?? [], [counties, county]);
  const wards = useMemo(() => constituencies.find((k) => k.n === constituency)?.w ?? [], [constituencies, constituency]);

  const resendVerification = async () => {
    if (!currentUser) return;
    setError("");
    try {
      if (currentUser.email && !emailVerified) {
        await sendEmailVerification(currentUser);
        setNotice(`Verification link sent to ${currentUser.email}.`);
      } else if (savedPending) {
        await verifyBeforeUpdateEmail(currentUser, savedPending);
        setNotice(`Verification link sent to ${savedPending}.`);
      }
    } catch (err) {
      setError(apiMessage(err, "Could not send the link. Try again in a few minutes."));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError("");
    setNotice("");

    const target = email.trim().toLowerCase();
    const hasEmail = !!currentUser.email || !!savedPending || (!emailLocked && !!target);
    if (name.trim().length < 2) return setError("Enter your full name");
    if (!/^[A-Za-z0-9]{5,15}$/.test(idNumber.replace(/\s/g, ""))) return setError("Enter your ID number (5-15 letters or digits)");
    if (!phoneLocked && !toLocalKePhone(phone)) return setError("Enter your Safaricom phone number");
    if (altPhone && !toLocalKePhone(altPhone)) return setError("Alternative phone must be a valid Kenyan mobile number");
    if (!hasEmail) return setError("Enter your email address");
    if (!emailLocked && target && !EMAIL_RE.test(target)) return setError("Enter a valid email address");
    if (!county || !constituency || !ward) return setError("Select your county, constituency and ward");
    if (!addressLine.trim()) return setError("Enter your street, building or landmark");

    const patch: ProfilePatch = { name, id: idNumber, altPhone, shopName, county, constituency, ward, addressLine };
    if (!phoneLocked) patch.phone = phone;

    setSaving(true);
    try {
      let result = await updateAgentProfile(patch);

      let pending = "";
      if (!emailLocked && target && target !== (currentUser.email ?? "").toLowerCase() && target !== savedPending.toLowerCase()) {
        try {
          // Mails a link to the NEW address. The sign-in email only changes (and is copied to the profile) once it is opened.
          await verifyBeforeUpdateEmail(currentUser, target);
          pending = target;
        } catch (err) {
          const code = (err as { code?: string }).code;
          await refreshUser();
          if (code === "auth/email-already-in-use") {
            setError("That email is already taken by another account. Use a different email. Your other details were saved.");
          } else if (code === "auth/requires-recent-login") {
            setError("For security, sign out and sign in again, then add your email. Your other details were saved.");
          } else {
            setError(apiMessage(err, "Could not send the verification link. Your other details were saved."));
          }
          return;
        }
        result = await updateAgentProfile({ pendingEmail: pending });
      }

      await refreshUser();
      if (!result.profileComplete) {
        setError(`Still needed: ${result.missing.join(", ")}`);
        return;
      }
      if (pending) {
        setNotice(`We sent a verification link to ${pending}. Open it to confirm your email, then continue.`);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(apiMessage(err, "Could not save your details. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 py-8">
      <motion.form
        onSubmit={handleSave}
        className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-xl p-6 w-full max-w-lg text-white"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Complete your profile</h1>
          <p className="text-sm opacity-80">
            {gated ? "Please finish your details to continue. Fields marked * are required." : "Keep your details up to date. Fields marked * are required."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={label}>Full name *</label>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="As on your ID" />
          </div>
          <div>
            <label className={label}>ID number *</label>
            <input className={input} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="National ID" />
          </div>
          <div>
            <label className={label}>Business name (optional)</label>
            <input className={input} value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </div>
          <div>
            <label className={label}>Phone (Safaricom) * {phoneLocked && "(your sign-in number)"}</label>
            <input
              className={`${input} ${phoneLocked ? "opacity-60" : ""}`}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              readOnly={phoneLocked}
              placeholder="0712345678"
            />
          </div>
          <div>
            <label className={label}>Alternative phone (optional)</label>
            <input className={input} type="tel" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} placeholder="0712345678" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>
              Email *{" "}
              {currentUser.email ? (
                <span className={emailVerified ? "text-green-400" : "text-yellow-300"}>
                  {emailVerified ? "(verified)" : "(not verified)"}
                </span>
              ) : (
                savedPending && <span className="text-yellow-300">(link sent, not verified yet)</span>
              )}
            </label>
            <input
              className={`${input} ${emailLocked ? "opacity-60" : ""}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={emailLocked}
              placeholder="you@example.com"
            />
            {!emailLocked && (
              <p className="text-xs text-gray-400 mt-1">
                We email a link to confirm it. Once confirmed you can also sign in with this email.
              </p>
            )}
            {((currentUser.email && !emailVerified) || (!currentUser.email && savedPending)) && (
              <button type="button" onClick={resendVerification} className="text-xs text-green-400 hover:underline mt-1">
                Resend verification link
              </button>
            )}
          </div>

          <div>
            <label className={label}>County *</label>
            <select
              className={input}
              value={county}
              onChange={(e) => {
                setCounty(e.target.value);
                setConstituency("");
                setWard("");
              }}
            >
              <option value="">Select county</option>
              {counties.map((c) => (
                <option key={c.n} value={c.n}>
                  {c.n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Constituency *</label>
            <select
              className={input}
              value={constituency}
              disabled={!county}
              onChange={(e) => {
                setConstituency(e.target.value);
                setWard("");
              }}
            >
              <option value="">Select constituency</option>
              {constituencies.map((k) => (
                <option key={k.n} value={k.n}>
                  {k.n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Ward / location *</label>
            <select className={input} value={ward} disabled={!constituency} onChange={(e) => setWard(e.target.value)}>
              <option value="">Select ward</option>
              {wards.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Street / building / landmark *</label>
            <input className={input} value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="e.g. Moi Avenue, Plaza 3" />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-center text-yellow-300">{error}</p>}
        {notice && <p className="mt-4 text-sm text-center text-green-300">{notice}</p>}

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {gated ? (
            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition"
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition"
            >
              {notice ? "Continue to dashboard" : "Back to dashboard"}
            </button>
          )}
        </div>
      </motion.form>
    </div>
  );
};

export default CompleteProfilePage;

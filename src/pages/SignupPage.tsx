import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, MapPin, User, Mail, Phone, FileText, Building, CheckCircle, AlertCircle, Camera, ArrowRight, ArrowLeft } from "lucide-react";
import { auth, db, storage } from "../services/firebaseService";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const SignupPage: React.FC = () => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    type: "Freelancer",
    name: "",
    id: "",
    phone: "",
    altPhone: "",
    email: "",
    password: "",
    address: "",
    shopName: "",
    shopPhone: "",
    shopEmail: "",
    shopLocation: "",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [kraFile, setKraFile] = useState<File | null>(null);
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null);
  const [shopFile, setShopFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError(false);
      },
      () => {
        setLocationError(true);
        setErrors(prev => [...prev, "Location access is required. Please enable location services."]);
      }
    );
  }, []);

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors([]);
  };

  const validateStep = (currentStep: number): boolean => {
    const newErrors: string[] = [];

    if (currentStep === 1) {
      if (!form.type) newErrors.push("Account type is required");
      if (!form.name.trim()) newErrors.push("Full name is required");
      if (!form.id.trim()) newErrors.push("National ID number is required");
      if (!form.phone.trim()) newErrors.push("Phone number is required");
      if (!form.phone.match(/^\+254\d{9}$/)) newErrors.push("Phone must be in format +254XXXXXXXXX");
      if (form.altPhone && !form.altPhone.match(/^\+254\d{9}$/)) newErrors.push("Alternative phone must be in format +254XXXXXXXXX");
    }

    if (currentStep === 2) {
      if (!form.email.trim()) newErrors.push("Email address is required");
      if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) newErrors.push("Valid email address is required");
      if (!form.password) newErrors.push("Password is required");
      if (form.password.length < 6) newErrors.push("Password must be at least 6 characters");
      if (!form.address.trim()) newErrors.push("Full address is required");
      if (!coords) newErrors.push("Location coordinates are required. Please enable location services.");
    }

    if (currentStep === 3 && form.type === "Cyber") {
      if (!form.shopName.trim()) newErrors.push("Shop name is required for Cyber Café");
      if (!form.shopPhone.trim()) newErrors.push("Shop phone is required for Cyber Café");
      if (!form.shopPhone.match(/^\+254\d{9}$/)) newErrors.push("Shop phone must be in format +254XXXXXXXXX");
      if (!form.shopEmail.trim()) newErrors.push("Shop email is required for Cyber Café");
      if (!form.shopEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) newErrors.push("Valid shop email is required");
      if (!form.shopLocation.trim()) newErrors.push("Shop location is required for Cyber Café");
    }

    if (currentStep === 4) {
      if (!passportPhoto) newErrors.push("Passport photo is required");
      if (passportPhoto && !passportPhoto.type.startsWith('image/')) newErrors.push("Passport photo must be an image file");
      if (!idFile) newErrors.push("National ID upload is required");
      if (!kraFile) newErrors.push("KRA PIN certificate is required");
      if (kraFile && kraFile.type !== 'application/pdf') newErrors.push("KRA PIN certificate must be a PDF file");
      if (form.type === "Cyber" && !shopFile) newErrors.push("Shop front photo is required for Cyber Café");
      if (shopFile && !shopFile.type.startsWith('image/')) newErrors.push("Shop photo must be an image file");
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setErrors([]);
    setStep(step - 1);
  };

  const uploadFile = async (file: File, path: string) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const generateNextPID = async (): Promise<string> => {
    try {
      const agentsRef = collection(db, "agents");
      const q = query(agentsRef, orderBy("pId", "desc"), limit(1));
      const querySnapshot = await getDocs(q);

      let nextNumber = 1234;

      if (!querySnapshot.empty) {
        const lastDoc = querySnapshot.docs[0];
        const lastPID = lastDoc.data().pId;
        const lastNumber = parseInt(lastPID.replace("COG-", ""), 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      return `COG-${nextNumber}`;
    } catch (error) {
      console.error("Error generating PID:", error);
      return `COG-${Date.now().toString().slice(-6)}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(4)) return;

    setLoading(true);
    setErrors([]);

    try {
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password);
      
      const passportUrl = passportPhoto ? await uploadFile(passportPhoto, `uploads/${user.uid}/passport`) : "";
      const idUrl = idFile ? await uploadFile(idFile, `uploads/${user.uid}/id`) : "";
      const kraUrl = kraFile ? await uploadFile(kraFile, `uploads/${user.uid}/kra`) : "";
      const shopUrl = form.type === "Cyber" && shopFile ? await uploadFile(shopFile, `uploads/${user.uid}/shop`) : "";

      const nextPID = await generateNextPID();

      const { password, ...formWithoutPassword } = form;

      const data = {
        ...formWithoutPassword,
        uid: user.uid,
        pId: nextPID,
        coords,
        uploads: { passportUrl, idUrl, kraUrl, shopUrl },
        isVerified: true,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "agents", user.uid), data);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setErrors([err.message || "An error occurred during signup"]);
    } finally {
      setLoading(false);
    }
  };

  const stepVariants = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 }
  };

  const totalSteps = form.type === "Cyber" ? 4 : 4;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <motion.div
        className="bg-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 w-full max-w-3xl text-white border border-white/10"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Create Your Account
          </h1>
          <p className="text-center text-gray-400 text-sm">Step {step} of {totalSteps}</p>
          
          <div className="flex gap-2 mt-4">
            {[...Array(totalSteps)].map((_, i) => (
              <motion.div
                key={i}
                className={`h-2 flex-1 rounded-full ${i + 1 <= step ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-gray-700'}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: i * 0.1 }}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl"
            >
              {errors.map((error, idx) => (
                <p key={idx} className="text-sm text-red-300 flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </p>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" /> Personal Information
                </h2>

                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"
                  required
                >
                  <option value="Freelancer">Freelancer</option>
                  <option value="Cyber">Cyber Café</option>
                </select>

                <div className="flex items-center bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus-within:border-blue-500 transition-colors">
                  <User className="w-5 h-5 text-gray-400 mr-3" />
                  <input
                    name="name"
                    placeholder="Full Name *"
                    value={form.name}
                    onChange={handleChange}
                    className="bg-transparent flex-1 outline-none"
                    required
                  />
                </div>

                <input
                  name="id"
                  placeholder="National ID Number *"
                  value={form.id}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"
                />

                <div className="flex items-center bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus-within:border-blue-500 transition-colors">
                  <Phone className="w-5 h-5 text-gray-400 mr-3" />
                  <input
                    name="phone"
                    placeholder="Phone (+254XXXXXXXXX) *"
                    value={form.phone}
                    onChange={handleChange}
                    className="bg-transparent flex-1 outline-none"
                    required
                  />
                </div>

                <div className="flex items-center bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus-within:border-blue-500 transition-colors">
                  <Phone className="w-5 h-5 text-gray-400 mr-3" />
                  <input
                    name="altPhone"
                    placeholder="Alternative Phone (+254XXXXXXXXX)"
                    value={form.altPhone}
                    onChange={handleChange}
                    className="bg-transparent flex-1 outline-none"
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5" /> Account & Location Details
                </h2>

                <div className="flex items-center bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus-within:border-blue-500 transition-colors">
                  <Mail className="w-5 h-5 text-gray-400 mr-3" />
                  <input
                    name="email"
                    type="email"
                    placeholder="Email Address *"
                    value={form.email}
                    onChange={handleChange}
                    className="bg-transparent flex-1 outline-none"
                    required
                  />
                </div>

                <input
                  type="password"
                  name="password"
                  placeholder="Password (min 6 characters) *"
                  value={form.password}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"
                />

                <textarea
                  name="address"
                  placeholder="Full Physical Address *"
                  value={form.address}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors resize-none"
                />

                <div className={`p-4 rounded-xl border ${coords ? 'bg-green-500/10 border-green-500/50' : 'bg-amber-500/10 border-amber-500/50'}`}>
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-5 h-5 ${coords ? 'text-green-400' : 'text-amber-400'}`} />
                    <span className="text-sm">
                      {coords ? `Location captured: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : 'Waiting for location access...'}
                    </span>
                  </div>
                  {locationError && (
                    <p className="text-xs text-amber-300 mt-2">Please enable location services to continue</p>
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && form.type === "Cyber" && (
              <motion.div
                key="step3"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5" /> Cyber Café Information
                </h2>

                <div className="flex items-center bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus-within:border-blue-500 transition-colors">
                  <Building className="w-5 h-5 text-gray-400 mr-3" />
                  <input
                    name="shopName"
                    placeholder="Cyber Café Name *"
                    value={form.shopName}
                    onChange={handleChange}
                    className="bg-transparent flex-1 outline-none"
                    required={form.type === "Cyber"}
                  />
                </div>

                <div className="flex items-center bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus-within:border-blue-500 transition-colors">
                  <Phone className="w-5 h-5 text-gray-400 mr-3" />
                  <input
                    name="shopPhone"
                    placeholder="Shop Phone (+254XXXXXXXXX) *"
                    value={form.shopPhone}
                    onChange={handleChange}
                    className="bg-transparent flex-1 outline-none"
                    required={form.type === "Cyber"}
                  />
                </div>

                <div className="flex items-center bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus-within:border-blue-500 transition-colors">
                  <Mail className="w-5 h-5 text-gray-400 mr-3" />
                  <input
                    name="shopEmail"
                    type="email"
                    placeholder="Shop Email Address *"
                    value={form.shopEmail}
                    onChange={handleChange}
                    className="bg-transparent flex-1 outline-none"
                    required={form.type === "Cyber"}
                  />
                </div>

                <div className="flex items-center bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 focus-within:border-blue-500 transition-colors">
                  <MapPin className="w-5 h-5 text-gray-400 mr-3" />
                  <input
                    name="shopLocation"
                    placeholder="Shop Physical Location *"
                    value={form.shopLocation}
                    onChange={handleChange}
                    className="bg-transparent flex-1 outline-none"
                    required={form.type === "Cyber"}
                  />
                </div>
              </motion.div>
            )}

            {step === (form.type === "Cyber" ? 4 : 3) && (
              <motion.div
                key="step4"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" /> Document Uploads
                </h2>

                <label className="block bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 cursor-pointer hover:border-blue-500 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <Camera className="w-5 h-5 text-blue-400" />
                    <span className="text-sm font-medium">Passport Photo (Image) *</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPassportPhoto(e.target.files?.[0] || null)}
                    className="text-sm text-gray-400"
                    required
                  />
                  {passportPhoto && <span className="text-xs text-green-400 flex items-center gap-1 mt-2"><CheckCircle className="w-3 h-3" /> {passportPhoto.name}</span>}
                </label>

                <label className="block bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 cursor-pointer hover:border-blue-500 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <span className="text-sm font-medium">National ID (Image/PDF) *</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                    className="text-sm text-gray-400"
                    required
                  />
                  {idFile && <span className="text-xs text-green-400 flex items-center gap-1 mt-2"><CheckCircle className="w-3 h-3" /> {idFile.name}</span>}
                </label>

                <label className="block bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 cursor-pointer hover:border-blue-500 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <Upload className="w-5 h-5 text-blue-400" />
                    <span className="text-sm font-medium">KRA PIN Certificate (PDF ONLY) *</span>
                  </div>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setKraFile(e.target.files?.[0] || null)}
                    className="text-sm text-gray-400"
                    required
                  />
                  {kraFile && kraFile.type === 'application/pdf' && (
                    <span className="text-xs text-green-400 flex items-center gap-1 mt-2"><CheckCircle className="w-3 h-3" /> {kraFile.name}</span>
                  )}
                  {kraFile && kraFile.type !== 'application/pdf' && (
                    <span className="text-xs text-red-400 flex items-center gap-1 mt-2"><AlertCircle className="w-3 h-3" /> File must be PDF</span>
                  )}
                </label>

                {form.type === "Cyber" && (
                  <label className="block bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 cursor-pointer hover:border-blue-500 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                      <Building className="w-5 h-5 text-blue-400" />
                      <span className="text-sm font-medium">Shop Front Photo (Image) *</span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setShopFile(e.target.files?.[0] || null)}
                      className="text-sm text-gray-400"
                      required
                    />
                    {shopFile && <span className="text-xs text-green-400 flex items-center gap-1 mt-2"><CheckCircle className="w-3 h-3" /> {shopFile.name}</span>}
                  </label>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-4 mt-8">
            {step > 1 && (
              <motion.button
                type="button"
                onClick={handleBack}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" /> Back
              </motion.button>
            )}

            {step < totalSteps ? (
              <motion.button
                type="button"
                onClick={handleNext}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
              >
                Next <ArrowRight className="w-5 h-5" />
              </motion.button>
            ) : (
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
              >
                {loading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" /> Create Account
                  </>
                )}
              </motion.button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default SignupPage;
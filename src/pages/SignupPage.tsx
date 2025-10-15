import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, MapPin, User, Mail, Phone, FileText, Building } from "lucide-react";
import { auth, db, storage } from "../services/firebaseService";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const SignupPage: React.FC = () => {
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
  const [shopFile, setShopFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords(null)
    );
  }, []);

  const handleChange = (e: any) => setForm({ ...form, [e.target.name]: e.target.value });

  const uploadFile = async (file: File, path: string) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const generateNextPID = async (): Promise<string> => {
    try {
      // Query to get the agent with the highest pId
      const agentsRef = collection(db, "agents");
      const q = query(agentsRef, orderBy("pId", "desc"), limit(1));
      const querySnapshot = await getDocs(q);

      let nextNumber = 1234; // Starting number

      if (!querySnapshot.empty) {
        const lastDoc = querySnapshot.docs[0];
        const lastPID = lastDoc.data().pId;
        
        // Extract the numeric part from the last PID (e.g., "COG-1234" -> 1234)
        const lastNumber = parseInt(lastPID.replace("COG-", ""), 10);
        
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      // Format as COG-#### (no padding limit, can grow beyond 9999)
      return `COG-${nextNumber}`;
    } catch (error) {
      console.error("Error generating PID:", error);
      // Fallback: use timestamp-based PID if query fails
      return `COG-${Date.now().toString().slice(-6)}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const idUrl = idFile ? await uploadFile(idFile, `uploads/${user.uid}/id`) : "";
      const kraUrl = kraFile ? await uploadFile(kraFile, `uploads/${user.uid}/kra`) : "";
      const shopUrl = form.type === "Cyber" && shopFile ? await uploadFile(shopFile, `uploads/${user.uid}/shop`) : "";

      // Generate sequential PID
      const nextPID = await generateNextPID();

      // Remove password from the data object before storing
      const { password, ...formWithoutPassword } = form;

      const data = {
        ...formWithoutPassword,
        uid: user.uid,
        pId: nextPID,
        coords,
        uploads: { idUrl, kraUrl, shopUrl },
        isVerified: false,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "agents", user.uid), data);
      window.location.href = "/verify";
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <motion.div
        className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-xl p-6 w-full max-w-2xl text-white overflow-y-auto max-h-[90vh]"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-center mb-4">Create Your Account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap gap-3 justify-between">
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full md:w-[48%] bg-gray-800 rounded-lg px-3 py-2 outline-none"
            >
              <option value="Freelancer">Freelancer</option>
              <option value="Cyber">Cyber Café</option>
            </select>

            <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 w-full md:w-[48%]">
              <User className="w-5 h-5 text-gray-400 mr-2" />
              <input
                name="name"
                placeholder="Full Name"
                value={form.name}
                onChange={handleChange}
                className="bg-transparent flex-1 outline-none"
                required
              />
            </div>

            <input
              name="idNumber"
              placeholder="National ID Number"
              value={form.id}
              onChange={handleChange}
              required
              className="bg-gray-800 rounded-lg px-3 py-2 w-full md:w-[48%] outline-none"
            />

            <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 w-full md:w-[48%]">
              <Phone className="w-5 h-5 text-gray-400 mr-2" />
              <input
                name="phone"
                placeholder="Phone (+254...)"
                value={form.phone}
                onChange={handleChange}
                className="bg-transparent flex-1 outline-none"
                required
              />
            </div>

            <input
              name="altPhone"
              placeholder="Alternative Phone"
              value={form.altPhone}
              onChange={handleChange}
              className="bg-gray-800 rounded-lg px-3 py-2 w-full md:w-[48%] outline-none"
            />

            <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 w-full md:w-[48%]">
              <Mail className="w-5 h-5 text-gray-400 mr-2" />
              <input
                name="email"
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={handleChange}
                className="bg-transparent flex-1 outline-none"
                required
              />
            </div>

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
              className="bg-gray-800 rounded-lg px-3 py-2 w-full outline-none"
            />

            <textarea
              name="address"
              placeholder="Full Address"
              value={form.address}
              onChange={handleChange}
              className="bg-gray-800 rounded-lg px-3 py-2 w-full outline-none resize-none"
            />

            {form.type === "Cyber" && (
              <>
                <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 w-full md:w-[48%]">
                  <Building className="w-5 h-5 text-gray-400 mr-2" />
                  <input
                    name="shopName"
                    placeholder="Shop Name"
                    value={form.shopName}
                    onChange={handleChange}
                    className="bg-transparent flex-1 outline-none"
                  />
                </div>

                <input
                  name="shopPhone"
                  placeholder="Shop Phone"
                  value={form.shopPhone}
                  onChange={handleChange}
                  className="bg-gray-800 rounded-lg px-3 py-2 w-full md:w-[48%] outline-none"
                />

                <input
                  name="shopEmail"
                  placeholder="Shop Email"
                  value={form.shopEmail}
                  onChange={handleChange}
                  className="bg-gray-800 rounded-lg px-3 py-2 w-full md:w-[48%] outline-none"
                />

                <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 w-full md:w-[48%]">
                  <MapPin className="w-5 h-5 text-gray-400 mr-2" />
                  <input
                    name="shopLocation"
                    placeholder="Shop Location"
                    value={form.shopLocation}
                    onChange={handleChange}
                    className="bg-transparent flex-1 outline-none"
                  />
                </div>
              </>
            )}

            <div className="w-full flex flex-wrap gap-3">
              <label className="flex flex-col bg-gray-800 rounded-lg px-3 py-2 w-full md:w-[48%]">
                <span className="text-sm mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Upload ID
                </span>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)} required />
              </label>

              <label className="flex flex-col bg-gray-800 rounded-lg px-3 py-2 w-full md:w-[48%]">
                <span className="text-sm mb-1 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Upload KRA
                </span>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setKraFile(e.target.files?.[0] || null)} required />
              </label>

              {form.type === "Cyber" && (
                <label className="flex flex-col bg-gray-800 rounded-lg px-3 py-2 w-full">
                  <span className="text-sm mb-1 flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Upload Shop Front Photo
                  </span>
                  <input type="file" accept="image/*" onChange={(e) => setShopFile(e.target.files?.[0] || null)} />
                </label>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-lg mt-4"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        {msg && <p className="mt-3 text-sm text-yellow-300 text-center">{msg}</p>}
      </motion.div>
    </div>
  );
};

export default SignupPage;
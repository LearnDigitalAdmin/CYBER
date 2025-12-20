import { useState, useEffect } from 'react';
import { Download, FileText, Loader2, CheckCircle, AlertCircle, Clock, ArrowLeft } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { functions } from '../services/firebaseService';

const FormPage = () => {
  const navigate = useNavigate();
  const [numberOfTenants, setNumberOfTenants] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentForms, setRecentForms] = useState<any[]>([]);

  // Load recent forms on mount
  useEffect(() => {
    loadRecentForms();
  }, []);

  const loadRecentForms = async () => {
    try {
      const db = getFirestore();
      const formsRef = collection(db, 'forms');
      const q = query(formsRef, orderBy('createdAt', 'desc'), limit(10));
      const snapshot = await getDocs(q);
      
      const forms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setRecentForms(forms);
    } catch (err) {
      console.error('Error loading recent forms:', err);
    }
  };

  const generateForm = async () => {
    setGenerating(true);
    setError(null);
    setDownloadUrl(null);
    
    try {
      const generateRegistrationForm = httpsCallable(functions, 'generateRegistrationForm');
      
      const result = await generateRegistrationForm({ numberOfTenants });
      const data = result.data as any;
      
      if (data.success) {
        setDownloadUrl(data.url);
        setIsCached(data.cached);
        
        // Refresh recent forms list
        await loadRecentForms();
      } else {
        setError('Failed to generate form. Please try again.');
      }
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred while generating the form.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleQuickGenerate = async (numTenants: number) => {
    setNumberOfTenants(numTenants);
    setGenerating(true);
    setError(null);
    
    try {
      const generateRegistrationForm = httpsCallable(functions, 'generateRegistrationForm');
      
      const result = await generateRegistrationForm({ numberOfTenants: numTenants });
      const data = result.data as any;
      
      if (data.success) {
        setDownloadUrl(data.url);
        setIsCached(data.cached);
        await loadRecentForms();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back</span>
        </button>

        <div className="text-center mb-12">
          <div className="inline-block p-3 bg-cyan-500/10 rounded-2xl mb-4">
            <FileText className="w-16 h-16 text-cyan-400" />
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Plot Yangu Registration Form Generator
          </h1>
          <p className="text-gray-400 text-lg">
            Generate professional registration forms with beautiful design
          </p>
        </div>

        {!downloadUrl ? (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Generator */}
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700 p-8">
                <div className="mb-8">
                  <label className="block text-lg font-semibold text-white mb-4">
                    How many tenants will be registered?
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={numberOfTenants}
                    onChange={(e) => setNumberOfTenants(parseInt(e.target.value) || 1)}
                    className="w-full px-6 py-4 bg-gray-900/50 border-2 border-gray-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white text-2xl text-center font-bold"
                    placeholder="Enter number"
                    disabled={generating}
                  />
                  <p className="text-gray-500 text-sm mt-3 text-center">
                    This will generate a form with fields for {numberOfTenants} tenant{numberOfTenants !== 1 ? 's' : ''}
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-400 font-semibold">Error</p>
                      <p className="text-red-300 text-sm">{error}</p>
                    </div>
                  </div>
                )}

                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-6 mb-8">
                  <h3 className="text-cyan-400 font-bold mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    What's included in the form:
                  </h3>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li>• Beautiful gradient header with branding</li>
                    <li>• Landlord/Agent information section</li>
                    <li>• Property details and description</li>
                    <li>• Individual tenant pages with all financial details</li>
                    <li>• Consent section for data processing & screening</li>
                    <li>• Professional signature sections</li>
                    <li>• Instructions and contact information page</li>
                  </ul>
                </div>

                <button
                  onClick={generateForm}
                  disabled={generating || numberOfTenants < 1}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Generating Form...
                    </>
                  ) : (
                    <>
                      <FileText className="w-6 h-6" />
                      Generate Professional Form
                    </>
                  )}
                </button>

                <p className="text-gray-500 text-xs text-center mt-4">
                  Powered by Cloud Functions • Africa South Region
                </p>
              </div>
            </div>

            {/* Quick Access & Recent Forms */}
            <div className="space-y-6">
              {/* Quick Generate */}
              <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700 p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  Quick Generate
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 5, 10].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleQuickGenerate(num)}
                      disabled={generating}
                      className="bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600 rounded-lg py-3 text-white font-semibold transition-all disabled:opacity-50"
                    >
                      {num} Tenant{num > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent Forms */}
              {recentForms.length > 0 && (
                <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700 p-6">
                  <h3 className="text-white font-bold mb-4">Recent Forms</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {recentForms.map((form) => (
                      <button
                        key={form.id}
                        onClick={() => window.open(form.url, '_blank')}
                        className="w-full bg-gray-700/30 hover:bg-gray-600/30 border border-gray-600/50 rounded-lg p-3 text-left transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-semibold text-sm">
                              {form.numberOfTenants} Tenant{form.numberOfTenants > 1 ? 's' : ''}
                            </p>
                            <p className="text-gray-400 text-xs">
                              {new Date(form.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Download className="w-4 h-4 text-gray-400 group-hover:text-cyan-400 transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700 p-8">
              <div className="text-center mb-6">
                <div className="inline-block p-4 bg-green-500/10 rounded-2xl mb-4">
                  <CheckCircle className="w-16 h-16 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Form Generated Successfully! {isCached && '⚡'}
                </h2>
                <p className="text-gray-400">
                  Your professional registration form with {numberOfTenants} tenant section{numberOfTenants !== 1 ? 's' : ''} is ready
                </p>
                {isCached && (
                  <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
                    <CheckCircle className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-400 text-sm font-semibold">Retrieved from cache (instant!)</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleDownload}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 flex items-center justify-center gap-3"
                >
                  <Download className="w-6 h-6" />
                  Download Form
                </button>
                <button
                  onClick={() => {
                    setDownloadUrl(null);
                    setIsCached(false);
                    setNumberOfTenants(1);
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3"
                >
                  Generate New Form
                </button>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
              <h3 className="text-yellow-400 font-bold mb-3">Next Steps:</h3>
              <ol className="space-y-2 text-gray-300 list-decimal list-inside text-sm">
                <li>Download and print the professional form</li>
                <li>Give to landlord/agent to fill in all details clearly</li>
                <li>Collect completed form with required documents (IDs, etc.)</li>
                <li>Use the information to create properties and tenants in Plot Yangu</li>
              </ol>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-6">
              <h3 className="text-cyan-400 font-bold mb-3">✨ Professional Features:</h3>
              <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-300">
                <div>• Beautiful gradient branding</div>
                <div>• Custom web fonts (Inter)</div>
                <div>• Legal consent sections</div>
                <div>• Data protection compliance</div>
                <div>• Professional signatures</div>
                <div>• Perfect page breaks</div>
                <div>• Official document styling</div>
                <div>• Print-optimized layout</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Plot Yangu © {new Date().getFullYear()} | Cogvana Corporation</p>
          <p className="mt-2">
            For support: 📞 0791286165 | ✉ info@cogvana.co.ke | 🌐 cogvana.co.ke
          </p>
        </div>
      </div>
    </div>
  );
};

export default FormPage;

//   const loadRecentForms = async () => {
//     try {
//       const db = getFirestore();
//       const formsRef = collection(db, 'forms');
//       const q = query(formsRef, orderBy('createdAt', 'desc'), limit(10));
//       const snapshot = await getDocs(q);
      
//       const forms = snapshot.docs.map(doc => ({
//         id: doc.id,
//         ...doc.data()
//       }));
      
//       setRecentForms(forms);
//     } catch (err) {
//       console.error('Error loading recent forms:', err);
//     }
//   };

//   const generateForm = async () => {
//     setGenerating(true);
//     setError(null);
//     setDownloadUrl(null);
    
//     try {
//       const functions = getFunctions();
//       const generateRegistrationForm = httpsCallable(functions, 'generateRegistrationForm');
      
//       const result = await generateRegistrationForm({ numberOfTenants });
//       const data = result.data as any;
      
//       if (data.success) {
//         setDownloadUrl(data.url);
//         setIsCached(data.cached);
        
//         // Refresh recent forms list
//         await loadRecentForms();
//       } else {
//         setError('Failed to generate form. Please try again.');
//       }
//     } catch (err: any) {
//       console.error('Error:', err);
//       setError(err.message || 'An error occurred while generating the form.');
//     } finally {
//       setGenerating(false);
//     }
//   };

//   const handleDownload = () => {
//     if (downloadUrl) {
//       window.open(downloadUrl, '_blank');
//     }
//   };

//   const handleQuickGenerate = async (numTenants: number) => {
//     setNumberOfTenants(numTenants);
//     setGenerating(true);
//     setError(null);
    
//     try {
//       const functions = getFunctions();
//       const generateRegistrationForm = httpsCallable(functions, 'generateRegistrationForm');
      
//       const result = await generateRegistrationForm({ numberOfTenants: numTenants });
//       const data = result.data as any;
      
//       if (data.success) {
//         setDownloadUrl(data.url);
//         setIsCached(data.cached);
//         await loadRecentForms();
//       }
//     } catch (err: any) {
//       setError(err.message || 'An error occurred.');
//     } finally {
//       setGenerating(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white p-6">
//       <div className="max-w-6xl mx-auto">
//         <div className="text-center mb-12">
//           <div className="inline-block p-3 bg-cyan-500/10 rounded-2xl mb-4">
//             <FileText className="w-16 h-16 text-cyan-400" />
//           </div>
//           <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
//             Plot Yangu Registration Form Generator
//           </h1>
//           <p className="text-gray-400 text-lg">
//             Generate professional registration forms with beautiful design
//           </p>
//         </div>

//         {!downloadUrl ? (
//           <div className="grid lg:grid-cols-3 gap-6">
//             {/* Main Generator */}
//             <div className="lg:col-span-2">
//               <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700 p-8">
//                 <div className="mb-8">
//                   <label className="block text-lg font-semibold text-white mb-4">
//                     How many tenants will be registered?
//                   </label>
//                   <input
//                     type="number"
//                     min="1"
//                     max="50"
//                     value={numberOfTenants}
//                     onChange={(e) => setNumberOfTenants(parseInt(e.target.value) || 1)}
//                     className="w-full px-6 py-4 bg-gray-900/50 border-2 border-gray-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white text-2xl text-center font-bold"
//                     placeholder="Enter number"
//                     disabled={generating}
//                   />
//                   <p className="text-gray-500 text-sm mt-3 text-center">
//                     This will generate a form with fields for {numberOfTenants} tenant{numberOfTenants !== 1 ? 's' : ''}
//                   </p>
//                 </div>

//                 {error && (
//                   <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
//                     <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
//                     <div>
//                       <p className="text-red-400 font-semibold">Error</p>
//                       <p className="text-red-300 text-sm">{error}</p>
//                     </div>
//                   </div>
//                 )}

//                 <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-6 mb-8">
//                   <h3 className="text-cyan-400 font-bold mb-3 flex items-center gap-2">
//                     <CheckCircle className="w-5 h-5" />
//                     What's included in the form:
//                   </h3>
//                   <ul className="space-y-2 text-gray-300 text-sm">
//                     <li>• Beautiful gradient header with branding</li>
//                     <li>• Landlord/Agent information section</li>
//                     <li>• Property details and description</li>
//                     <li>• Individual tenant pages with all financial details</li>
//                     <li>• Consent section for data processing & screening</li>
//                     <li>• Professional signature sections</li>
//                     <li>• Instructions and contact information page</li>
//                   </ul>
//                 </div>

//                 <button
//                   onClick={generateForm}
//                   disabled={generating || numberOfTenants < 1}
//                   className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
//                 >
//                   {generating ? (
//                     <>
//                       <Loader2 className="w-6 h-6 animate-spin" />
//                       Generating Form...
//                     </>
//                   ) : (
//                     <>
//                       <FileText className="w-6 h-6" />
//                       Generate Professional Form
//                     </>
//                   )}
//                 </button>

//                 <p className="text-gray-500 text-xs text-center mt-4">
//                   Powered by Cloud Functions • Africa South Region
//                 </p>
//               </div>
//             </div>

//             {/* Quick Access & Recent Forms */}
//             <div className="space-y-6">
//               {/* Quick Generate */}
//               <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700 p-6">
//                 <h3 className="text-white font-bold mb-4 flex items-center gap-2">
//                   <Clock className="w-5 h-5 text-cyan-400" />
//                   Quick Generate
//                 </h3>
//                 <div className="grid grid-cols-2 gap-3">
//                   {[1, 2, 5, 10].map((num) => (
//                     <button
//                       key={num}
//                       onClick={() => handleQuickGenerate(num)}
//                       disabled={generating}
//                       className="bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600 rounded-lg py-3 text-white font-semibold transition-all disabled:opacity-50"
//                     >
//                       {num} Tenant{num > 1 ? 's' : ''}
//                     </button>
//                   ))}
//                 </div>
//               </div>

//               {/* Recent Forms */}
//               {recentForms.length > 0 && (
//                 <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700 p-6">
//                   <h3 className="text-white font-bold mb-4">Recent Forms</h3>
//                   <div className="space-y-2 max-h-96 overflow-y-auto">
//                     {recentForms.map((form) => (
//                       <button
//                         key={form.id}
//                         onClick={() => window.open(form.url, '_blank')}
//                         className="w-full bg-gray-700/30 hover:bg-gray-600/30 border border-gray-600/50 rounded-lg p-3 text-left transition-all group"
//                       >
//                         <div className="flex items-center justify-between">
//                           <div>
//                             <p className="text-white font-semibold text-sm">
//                               {form.numberOfTenants} Tenant{form.numberOfTenants > 1 ? 's' : ''}
//                             </p>
//                             <p className="text-gray-400 text-xs">
//                               {new Date(form.createdAt).toLocaleDateString()}
//                             </p>
//                           </div>
//                           <Download className="w-4 h-4 text-gray-400 group-hover:text-cyan-400 transition-colors" />
//                         </div>
//                       </button>
//                     ))}
//                   </div>
//                 </div>
//               )}
//             </div>
//           </div>
//         ) : (
//           <div className="space-y-6">
//             <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700 p-8">
//               <div className="text-center mb-6">
//                 <div className="inline-block p-4 bg-green-500/10 rounded-2xl mb-4">
//                   <CheckCircle className="w-16 h-16 text-green-400" />
//                 </div>
//                 <h2 className="text-2xl font-bold text-white mb-2">
//                   Form Generated Successfully! {isCached && '⚡'}
//                 </h2>
//                 <p className="text-gray-400">
//                   Your professional registration form with {numberOfTenants} tenant section{numberOfTenants !== 1 ? 's' : ''} is ready
//                 </p>
//                 {isCached && (
//                   <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
//                     <CheckCircle className="w-4 h-4 text-cyan-400" />
//                     <span className="text-cyan-400 text-sm font-semibold">Retrieved from cache (instant!)</span>
//                   </div>
//                 )}
//               </div>

//               <div className="flex flex-col sm:flex-row gap-4">
//                 <button
//                   onClick={handleDownload}
//                   className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 flex items-center justify-center gap-3"
//                 >
//                   <Download className="w-6 h-6" />
//                   Download Form
//                 </button>
//                 <button
//                   onClick={() => {
//                     setDownloadUrl(null);
//                     setIsCached(false);
//                     setNumberOfTenants(1);
//                   }}
//                   className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3"
//                 >
//                   Generate New Form
//                 </button>
//               </div>
//             </div>

//             <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
//               <h3 className="text-yellow-400 font-bold mb-3">Next Steps:</h3>
//               <ol className="space-y-2 text-gray-300 list-decimal list-inside text-sm">
//                 <li>Download and print the professional form</li>
//                 <li>Give to landlord/agent to fill in all details clearly</li>
//                 <li>Collect completed form with required documents (IDs, etc.)</li>
//                 <li>Use the information to create properties and tenants in Plot Yangu</li>
//               </ol>
//             </div>

//             <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-6">
//               <h3 className="text-cyan-400 font-bold mb-3">✨ Professional Features:</h3>
//               <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-300">
//                 <div>• Beautiful gradient branding</div>
//                 <div>• Custom web fonts (Inter)</div>
//                 <div>• Legal consent sections</div>
//                 <div>• Data protection compliance</div>
//                 <div>• Professional signatures</div>
//                 <div>• Perfect page breaks</div>
//                 <div>• Official document styling</div>
//                 <div>• Print-optimized layout</div>
//               </div>
//             </div>
//           </div>
//         )}

//         <div className="mt-12 text-center text-gray-500 text-sm">
//           <p>Plot Yangu © {new Date().getFullYear()} | Cogvana Corporation</p>
//           <p className="mt-2">
//             For support: 📞 0791286165 | ✉ info@cogvana.co.ke | 🌐 cogvana.co.ke
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default FormPage;
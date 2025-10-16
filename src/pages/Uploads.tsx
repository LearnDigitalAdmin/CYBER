import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, FileText, Image as ImageIcon, File,
  CheckCircle, AlertCircle, Loader2, Store, Phone,
  Mail, MapPin, User, ArrowRight, ArrowLeft
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebaseService';

import { toast } from 'react-toastify';
import { uploadService, type UploadRequest } from '../services/Uploads';

interface CyberDetails {
  id: string;
  pId: string;
  name: string;
  shopName?: string;
  phone: string;
  email?: string;
  shopEmail?: string;
  address?: string;
}

interface UploadedFile {
  file: File;
  id: string;
  preview?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  url?: string;
  error?: string;
}

const ALLOWED_FILE_TYPES = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpeg,.jpg',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/x-mspublisher': '.pub'
};

const MAX_SINGLE_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_BATCH_SIZE = 20 * 1024 * 1024; // 20MB

const SERVICE_TYPES = [
  'Printing',
  'Scanning',
  'Photocopying',
  'Binding',
  'Laminating',
  'Document Typing',
  'Government Services',
  'Other'
];

const CACHE_KEY = 'cogvana_cyber_details';

const UploadsPage = () => {
  const [step, setStep] = useState<'cyber-id' | 'details' | 'upload' | 'success'>('cyber-id');
  const [cyberId, setCyberId] = useState('');
  const [cyberDetails, setCyberDetails] = useState<CyberDetails | null>(null);
  const [searchingCyber, setSearchingCyber] = useState(false);
  const [cyberError, setCyberError] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [, setUploadComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const loadCachedCyber = () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const cyberData: CyberDetails = JSON.parse(cached);
          setCyberDetails(cyberData);
          setCyberId(cyberData.pId.replace('COG-', ''));
          setStep('details');
          toast.success(`Welcome back to ${getShortCyberName(cyberData)}`);
        }
      } catch (error) {
        console.error('Error loading cached cyber:', error);
        localStorage.removeItem(CACHE_KEY);
      }
    };
    loadCachedCyber();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Changes will be saved when connection is restored.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getShortCyberName = (cyber: CyberDetails): string => {
    const name = cyber.shopName || cyber.name;
    return name.replace(/\b(cyber|digital|shop|store)\b/gi, '').trim() || name;
  };

  const handleCyberIdChange = (value: string) => {
    let cleanValue = value.replace(/^COG-/i, '').replace(/[^0-9]/g, '');
    setCyberId(cleanValue);
    setCyberError('');
  };

  const searchCyber = async () => {
    if (cyberId.length < 4) {
      setCyberError('Please enter at least 4 digits');
      return;
    }
    if (!isOnline) {
      toast.error('Please connect to the internet to search for cyber');
      return;
    }
    setSearchingCyber(true);
    setCyberError('');
    try {
      const fullPId = `COG-${cyberId}`;
      const agentsRef = collection(db, 'agents');
      const q = query(agentsRef, where('pId', '==', fullPId));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setCyberError(`No cyber found with ID: ${fullPId}`);
        setSearchingCyber(false);
        return;
      }
      const cyberDoc = snapshot.docs[0];
      const data = cyberDoc.data();
      const cyber: CyberDetails = {
        id: cyberDoc.id,
        pId: data.pId,
        name: data.name || 'N/A',
        shopName: data.shopName,
        phone: data.phone || 'N/A',
        email: data.email,
        shopEmail: data.shopEmail,
        address: data.address
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cyber));
      setCyberDetails(cyber);
      setStep('details');
      toast.success(`Connected to ${getShortCyberName(cyber)}`);
    } catch (error: any) {
      console.error('Error searching cyber:', error);
      setCyberError('Failed to connect. Please try again.');
    } finally {
      setSearchingCyber(false);
    }
  };

  const validateFile = (file: File): string | null => {
    if (!Object.keys(ALLOWED_FILE_TYPES).includes(file.type)) {
      return `${file.name}: File type not allowed`;
    }
    if (file.size > MAX_SINGLE_FILE_SIZE) {
      return `${file.name}: File exceeds 10MB limit`;
    }
    return null;
  };

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const newFiles: UploadedFile[] = [];
    let totalSize = files.reduce((sum, f) => sum + f.file.size, 0);
    const errors: string[] = [];
    Array.from(selectedFiles).forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
        return;
      }
      totalSize += file.size;
      if (totalSize > MAX_BATCH_SIZE) {
        errors.push('Total batch size exceeds 20MB limit');
        return;
      }
      const uploadedFile: UploadedFile = {
        file,
        id: `${Date.now()}-${Math.random()}`,
        progress: 0,
        status: 'pending'
      };
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          uploadedFile.preview = e.target?.result as string;
          setFiles(prev => prev.map(f => f.id === uploadedFile.id ? uploadedFile : f));
        };
        reader.readAsDataURL(file);
      }
      newFiles.push(uploadedFile);
    });
    if (errors.length > 0) {
      toast.error(errors.join('\n'));
    }
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadFiles = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    for (const fileItem of files) {
      if (fileItem.status === 'success' && fileItem.url) {
        uploadedUrls.push(fileItem.url);
        continue;
      }
      try {
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'uploading' } : f
        ));
        const timestamp = Date.now();
        const safeName = fileItem.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `uploads/${cyberDetails!.id}/${timestamp}_${safeName}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, fileItem.file);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setFiles(prev => prev.map(f =>
                f.id === fileItem.id ? { ...f, progress } : f
              ));
            },
            (error) => {
              console.error('Upload error:', error);
              setFiles(prev => prev.map(f =>
                f.id === fileItem.id ? { ...f, status: 'error', error: error.message } : f
              ));
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                setFiles(prev => prev.map(f =>
                  f.id === fileItem.id ? { ...f, status: 'success', url: downloadURL } : f
                ));
                uploadedUrls.push(downloadURL);
                resolve();
              } catch (error: any) {
                reject(error);
              }
            }
          );
        });
      } catch (error: any) {
        console.error('Error uploading file:', error);
        setFiles(prev => prev.map(f =>
          f.id === fileItem.id ? { ...f, status: 'error', error: error.message } : f
        ));
      }
    }
    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    const formattedPhone = uploadService.formatPhoneNumber(customerPhone);
    if (!uploadService.validatePhoneNumber(formattedPhone)) {
      toast.error('Please enter a valid Kenyan phone number');
      return;
    }
    if (!serviceType) {
      toast.error('Please select a service type');
      return;
    }
    if (files.length === 0) {
      toast.error('Please select at least one file');
      return;
    }
    if (!isOnline) {
      toast.error('Please connect to the internet to submit');
      return;
    }
    setUploading(true);
    try {
      const fileUrls = await uploadFiles();
      if (fileUrls.length === 0) {
        throw new Error('No files were uploaded successfully');
      }
      const uploadRequest: UploadRequest = {
        name: customerName.trim(),
        phone: formattedPhone,
        type: serviceType,
        notes: additionalNotes.trim(),
        files: fileUrls,
        cyberId: cyberDetails!.id,
        cyberName: cyberDetails!.shopName || cyberDetails!.name
      };
      const uploadId = await uploadService.submitUpload(uploadRequest);
      console.log('Upload submitted with ID:', uploadId);
      setUploadComplete(true);
      setStep('success');
      toast.success('Files uploaded successfully!');
    } catch (error: any) {
      console.error('Error submitting upload:', error);
      toast.error(`Failed to submit: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
    if (file.type === 'application/pdf') return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
      {/* Background Animation */}
      <motion.div 
        className="fixed inset-0 pointer-events-none" 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 0.2 }} 
        transition={{ duration: 2 }}
      >
        <motion.div 
          className="absolute w-full h-full" 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }} 
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }} 
          style={{ backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 70%)' }} 
        />
      </motion.div>

      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-orange-500/90 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium shadow-lg">
          You are offline
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait">
              {step === 'cyber-id' && (
                <motion.div key="cyber-id" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
                  <div className="text-center space-y-4">
                    <motion.h1 className="text-4xl md:text-5xl font-bold" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                      Welcome to <span className="text-cyan-400">Cogvana Cyber</span>
                    </motion.h1>
                    <p className="text-gray-400 text-lg">Connect to your cyber to upload documents</p>
                  </div>
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Enter Cyber ID</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono">COG-</div>
                        <input type="text" value={cyberId} onChange={(e) => handleCyberIdChange(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && searchCyber()} placeholder="0000" maxLength={20} className="w-full pl-20 pr-4 py-4 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white font-mono text-lg" />
                      </div>
                      {cyberError && (
                        <p className="mt-2 text-sm text-red-400 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {cyberError}
                        </p>
                      )}
                    </div>
                    <button onClick={searchCyber} disabled={cyberId.length < 4 || searchingCyber || !isOnline} className="w-full py-4 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all font-semibold text-lg shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2">
                      {searchingCyber ? (<><Loader2 className="w-5 h-5 animate-spin" />Searching...</>) : (<>Connect to Cyber<ArrowRight className="w-5 h-5" /></>)}
                    </button>
                  </div>
                </motion.div>
              )}
              
              {step === 'details' && cyberDetails && (
                <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl sm:text-3xl font-bold">Welcome to {getShortCyberName(cyberDetails)}</h2>
                    <button onClick={() => { setStep('cyber-id'); localStorage.removeItem(CACHE_KEY); }} className="text-gray-400 hover:text-white transition-colors">
                      <ArrowLeft className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 backdrop-blur-sm rounded-xl border border-cyan-500/30 p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Store className="w-6 h-6 text-black" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="font-bold text-xl text-white">{cyberDetails.shopName || cyberDetails.name}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-300"><Phone className="w-4 h-4" />{cyberDetails.phone}</div>
                          {(cyberDetails.shopEmail || cyberDetails.email) && (<div className="flex items-center gap-2 text-gray-300"><Mail className="w-4 h-4" />{cyberDetails.shopEmail || cyberDetails.email}</div>)}
                          {cyberDetails.address && (<div className="flex items-center gap-2 text-gray-300 sm:col-span-2"><MapPin className="w-4 h-4" />{cyberDetails.address}</div>)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Your Name *</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="John Doe" className="w-full pl-11 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number *</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="0712345678" className="w-full pl-11 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Service Type *</label>
                      <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white">
                        <option value="">Select a service</option>
                        {SERVICE_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Additional Notes (Optional)</label>
                      <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} placeholder="Any special instructions..." rows={3} className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white resize-none" />
                    </div>
                  </div>
                  <button onClick={() => setStep('upload')} disabled={!customerName.trim() || !customerPhone.trim() || !serviceType} className="w-full py-4 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all font-semibold text-lg shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2">
                    Continue to Upload<ArrowRight className="w-5 h-5" />
                  </button>
                </motion.div>
              )}
              
              {step === 'upload' && (
                <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold">Upload Files</h2>
                    <button onClick={() => setStep('details')} disabled={uploading} className="text-gray-400 hover:text-white transition-colors disabled:opacity-50">
                      <ArrowLeft className="w-6 h-6" />
                    </button>
                  </div>
                  <div onClick={() => !uploading && fileInputRef.current?.click()} className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border-2 border-dashed border-gray-700 hover:border-cyan-500 p-12 text-center cursor-pointer transition-all">
                    <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-white mb-2">Click to upload files</p>
                    <p className="text-sm text-gray-400 mb-4">PDF, Images, Word, Excel, PowerPoint, Publisher</p>
                    <p className="text-xs text-gray-500">Max 10MB per file • Max 20MB total batch</p>
                    <input ref={fileInputRef} type="file" multiple accept={Object.values(ALLOWED_FILE_TYPES).join(',')} onChange={(e) => handleFileSelect(e.target.files)} className="hidden" disabled={uploading} />
                  </div>
                  {files.length > 0 && (
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6">
                      <h3 className="font-semibold text-lg mb-4">Selected Files ({files.length})</h3>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {files.map((fileItem) => (
                          <div key={fileItem.id} className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                            {fileItem.preview ? (
                              <img src={fileItem.preview} alt={fileItem.file.name} className="w-12 h-12 object-cover rounded" />
                            ) : (
                              <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center text-gray-400">{getFileIcon(fileItem.file)}</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{fileItem.file.name}</p>
                              <p className="text-xs text-gray-400">{formatFileSize(fileItem.file.size)}</p>
                              {fileItem.status === 'uploading' && (
                                <div className="mt-2">
                                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${fileItem.progress}%` }} />
                                  </div>
                                </div>
                              )}
                              {fileItem.status === 'error' && (<p className="text-xs text-red-400 mt-1">{fileItem.error}</p>)}
                            </div>
                            <div className="flex-shrink-0">
                              {fileItem.status === 'success' && (<CheckCircle className="w-5 h-5 text-green-400" />)}
                              {fileItem.status === 'error' && (<AlertCircle className="w-5 h-5 text-red-400" />)}
                              {fileItem.status === 'uploading' && (<Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />)}
                              {fileItem.status === 'pending' && (
                                <button onClick={(e) => { e.stopPropagation(); removeFile(fileItem.id); }} disabled={uploading} className="text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50">
                                  <X className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {files.length > 0 && (
                    <button onClick={handleSubmit} disabled={uploading || !isOnline} className="w-full py-4 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all font-semibold text-lg shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2">
                      {uploading ? (<><Loader2 className="w-5 h-5 animate-spin" />Uploading... {Math.round(files.reduce((sum, f) => sum + f.progress, 0) / files.length)}%</>) : (<><Upload className="w-5 h-5" />Submit Upload</>)}
                    </button>
                  )}
                </motion.div>
              )}
              
              {step === 'success' && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="text-center space-y-8">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }} className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/50">
                    <CheckCircle className="w-12 h-12 text-white" />
                  </motion.div>
                  <div className="space-y-4">
                    <h2 className="text-4xl font-bold text-white">Upload Successful!</h2>
                    <p className="text-lg text-gray-400 max-w-md mx-auto">Your files have been uploaded to {cyberDetails?.shopName || cyberDetails?.name}. You will be contacted shortly.</p>
                  </div>
                  <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 max-w-md mx-auto text-left">
                    <h3 className="font-semibold text-white mb-4">Upload Summary</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-gray-400">Name:</span><span className="text-white font-medium">{customerName}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Phone:</span><span className="text-white font-medium">{customerPhone}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Service:</span><span className="text-white font-medium">{serviceType}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Files:</span><span className="text-white font-medium">{files.length} file(s)</span></div>
                      <div className="flex justify-between pt-3 border-t border-gray-700"><span className="text-gray-400">Cyber:</span><span className="text-white font-medium">{cyberDetails?.shopName || cyberDetails?.name}</span></div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button onClick={() => { setStep('details'); setCustomerName(''); setCustomerPhone(''); setServiceType(''); setAdditionalNotes(''); setFiles([]); setUploadComplete(false); }} className="px-8 py-3 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-all font-semibold shadow-lg shadow-cyan-500/30">
                      Upload More Files
                    </button>
                    <button onClick={() => window.location.href = '/'} className="px-8 py-3 bg-transparent border-2 border-cyan-500 text-cyan-400 rounded-lg hover:bg-cyan-500 hover:text-black transition-all font-semibold">
                      Back to Home
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative z-10 text-center text-sm text-gray-500 px-4 py-6">
          <p className="mb-1">© {new Date().getFullYear()} Cogvana Cyber. All rights reserved.</p>
          <div className="space-x-4">
            <a href="https://payments.cogvana.co.ke/contact" className="hover:text-cyan-400 transition-colors">Contact Us</a>
            <a href="https://cogvana.co.ke/terms" className="hover:text-cyan-400 transition-colors">Terms of Use</a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default UploadsPage;
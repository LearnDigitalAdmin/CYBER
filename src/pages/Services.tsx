// src/pages/Services.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Home, CreditCard, Users, TrendingUp, Loader2, Package, X, CheckCircle } from 'lucide-react';
import React from 'react';
import { collection, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { db, functions } from '../services/firebaseService';
import { snpService, type Product } from '../services/snp';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';

const banners = [
  {
    id: 1,
    title: 'Manage Your Property',
    description: 'Take control of your real estate portfolio with Plot Yangu. Track rent payments, manage tenants, and monitor property performance all in one place.',
    icon: Home,
    color: 'from-emerald-600 to-teal-600'
  },
  {
    id: 2,
    title: 'Pay Rent via M-PESA',
    description: 'Convenient rent payments at your fingertips. Pay your Plot Yangu rent instantly using M-PESA. Fast, secure, and hassle-free transactions every time.',
    icon: CreditCard,
    color: 'from-blue-600 to-indigo-600'
  },
  {
    id: 3,
    title: 'Become an Agent',
    description: 'Join the Plot Yangu network and earn commissions. Help property owners and tenants connect while building your real estate business with our support.',
    icon: Users,
    color: 'from-purple-600 to-pink-600'
  },
  {
    id: 4,
    title: 'Grow Your Investment',
    description: 'Maximize your property returns with Plot Yangu analytics. Get insights on market trends, occupancy rates, and revenue optimization strategies.',
    icon: TrendingUp,
    color: 'from-orange-600 to-red-600'
  }
];

interface ProductCarouselProps {
  cyber?: any;
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({ cyber }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [chargeModal, setChargeModal] = useState(false);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [, setPaymentStatus] = useState<'waiting' | 'success' | 'failed'>('waiting');

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadProducts();
  }, []);

  // Listen to payment status updates
  useEffect(() => {
    if (!paymentReference) return;

    const unsubscribe = onSnapshot(
      doc(db, 'cyber-transactions', paymentReference),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          if (data.status === 'success') {
            setPaymentStatus('success');
            setSuccess(true);
            toast.success('Payment successful!');
            
            // Close modal after 3 seconds
            setTimeout(() => {
              closeModal();
            }, 3000);
          } else if (data.status === 'failed') {
            setPaymentStatus('failed');
            setError('Payment failed. Please try again.');
            setLoading(false);
          }
        }
      },
      (error) => {
        console.error('Error listening to payment status:', error);
      }
    );

    return () => unsubscribe();
  }, [paymentReference]);

  const closeModal = () => {
    setChargeModal(false);
    setSelectedProduct(null);
    setPhone('');
    setError('');
    setSuccess(false);
    setLoading(false);
    setPaymentReference(null);
    setPaymentStatus('waiting');
  };

  const handleCharge = async () => {
    if (!selectedProduct?.price || !phone) {
      setError('Please fill in all fields');
      return;
    }

    if (parseFloat(selectedProduct.price.toString()) < 10) {
      setError('Minimum amount is KES 10');
      return;
    }

    // Relaxed phone validation - accept 9-12 digits
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 9 || digitsOnly.length > 12) {
      setError('Phone number must be 9-12 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const chargeCustomer = httpsCallable(functions, 'chargeCustomer');
      console.log('DATA IN USE', {
        amount: parseFloat(selectedProduct.price.toString()),
        phone: phone,
        pId: cyber?.pId || '',
        uid: cyber?.uid || '',
        id: cyber?.id || '',
        service: selectedProduct.name
      })

      const result: any = await chargeCustomer({
        amount: parseFloat(selectedProduct.price.toString()),
        phone: phone,
        pId: cyber?.pId || '',
        uid: cyber?.uid || '',
        id: cyber?.id || '',
        service: selectedProduct.name
      });

      console.log('Charge result:', result.data);

      const paymentRef = result.data?.data?.reference;

      // Set the reference to listen for status updates
      if (paymentRef) {
        setPaymentReference(paymentRef);
        toast.info('Payment request sent! Please enter your M-PESA PIN on your phone.');
      } else {
        throw new Error('No payment reference received');
      }

    } catch (err: any) {
      console.error('Charge error:', err);
      setError(err.message || 'Failed to initiate payment. Please try again.');
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      // Get all agents/cybers
      const agentsRef = collection(db, 'agents');
      const agentsSnapshot = await getDocs(agentsRef);
      
      const userIds = agentsSnapshot.docs.map(doc => doc.id);
      
      if (userIds.length === 0) {
        setProducts([]);
        return;
      }

      // Get products from all users and shuffle
      const allProducts = await snpService.getProductsFromMultipleUsers(userIds);
      setProducts(allProducts);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const getCardSizes = () => {
    if (screenWidth < 768) {
      // 3 columns: 100 / 3 = 33.333%
      return { normal: 33.333, expanded: 50 };
    } else if (screenWidth < 1024) {
      // 4 columns: 100 / 4 = 25%
      return { normal: 25, expanded: 40 };
    } else if (screenWidth < 1280) {
      // 5 columns: 100 / 5 = 20%
      return { normal: 20, expanded: 35 };
    } else {
      // 6 columns: 100 / 6 = 16.666%
      return { normal: 16.666, expanded: 30 };
    }
  };

  const sizes = getCardSizes();

  const getVisibleBanners = () => {
    const prev = (currentSlide - 1 + banners.length) % banners.length;
    const next = (currentSlide + 1) % banners.length;
    return [
      { ...banners[prev], position: 'left' },
      { ...banners[currentSlide], position: 'center' },
      { ...banners[next], position: 'right' }
    ];
  };

  const formatPrice = (price: number): string => {
    return `KSh ${price.toLocaleString()}`;
  };

  const handlePayment = (product: Product) => {
    setSelectedProduct(product);
    setChargeModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
          Plot Yangu PMS
        </h1>

        {/* Banner Slider */}
        <div className="relative w-full h-64 md:h-80 mb-12 overflow-hidden">
          <div className="flex items-center justify-center h-full gap-2">
            {getVisibleBanners().map((banner) => {
              const Icon = banner.icon;
              const isCenter = banner.position === 'center';
              const width = isCenter ? '50%' : '20%';
              const opacity = isCenter ? 1 : 0.5;
              const scale = isCenter ? 1 : 0.9;

              return (
                <motion.div
                  key={`${banner.id}-${banner.position}`}
                  className="relative h-full rounded-2xl overflow-hidden"
                  style={{ width }}
                  initial={false}
                  animate={{ 
                    opacity,
                    scale,
                    filter: isCenter ? 'blur(0px)' : 'blur(2px)'
                  }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${banner.color}`} />
                  
                  {isCenter && (
                    <div className="relative h-full p-6 md:p-8 flex flex-col justify-center">
                      <div className="mb-4">
                        <Icon className="w-12 h-12 md:w-16 md:h-16 text-white/90" />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                        {banner.title}
                      </h2>
                      <p className="text-white/90 text-sm md:text-base leading-relaxed">
                        {banner.description}
                      </p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Slide Indicators */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentSlide ? 'bg-white w-8' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>

        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 text-center">
          Products & Services
        </h2>

        {/* Loading State */}
        {loadingProducts ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
            <p className="text-gray-400">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Package className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">No products available yet</p>
            <p className="text-gray-500 text-sm mt-2">Check back soon for new items!</p>
          </div>
        ) : (
          <div className="flex flex-wrap" style={{ gap: '0px' }}>
            {products.map((product) => {
              const isSelected = selected === product.id;
              const isOtherSelected = selected && selected !== product.id;

              return (
                <motion.div
                  key={`${product.id}-${product.imageUrl}`}
                  className="relative cursor-pointer"
                  style={{
                    width: `${isSelected ? sizes.expanded : sizes.normal}%`,
                  }}
                  onClick={() => setSelected(isSelected ? null : product.id)}
                  initial={false}
                  animate={{
                    scale: isSelected ? 1.02 : 1,
                    filter: isOtherSelected ? 'blur(4px)' : 'blur(0px)',
                    opacity: isOtherSelected ? 0.6 : 1,
                  }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <div className="relative w-full overflow-hidden rounded-lg shadow-2xl" style={{ aspectRatio: '9/16', padding: '2px' }}>
                    {/* Product Image */}
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
                    
                    {/* Product Title */}
                    <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-transparent">
                      <h3 className="text-white font-semibold text-sm line-clamp-2">
                        {product.name}
                      </h3>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ y: 100, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: 100, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                          className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/95 to-transparent"
                          style={{ height: '40%' }}
                        >
                          <div className="mb-4">
                            <h3 className="text-white font-bold text-xl mb-1">
                              {product.name}
                            </h3>
                            <p className="text-cyan-400 font-bold text-2xl">
                              {formatPrice(product.price)}
                            </p>
                          </div>

                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePayment(product);
                            }}
                            className="w-full bg-white text-black font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors shadow-lg"
                          >
                            <ShoppingCart size={20} />
                            BUY NOW
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Refresh Button */}
        {products.length > 0 && (
          <div className="mt-8 text-center">
            <button
              onClick={loadProducts}
              disabled={loadingProducts}
              className="px-6 py-3 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 transition-all inline-flex items-center gap-2"
            >
              {loadingProducts ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading...
                </>
              ) : (
                'Refresh Products'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {chargeModal && selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={closeModal}
                disabled={loading}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <X size={24} />
              </button>

              {/* Success State */}
              {success ? (
                <div className="text-center py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', duration: 0.5 }}
                  >
                    <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
                  <p className="text-gray-400">Thank you for your purchase</p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-white mb-2">Complete Payment</h3>
                    <p className="text-gray-400 text-sm">Enter your M-PESA number to proceed</p>
                  </div>

                  {/* Product Info */}
                  <div className="bg-slate-800 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-4">
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h4 className="text-white font-semibold mb-1">{selectedProduct.name}</h4>
                        <p className="text-cyan-400 font-bold text-lg">
                          {formatPrice(selectedProduct.price)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Phone Input */}
                  <div className="mb-6">
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      M-PESA Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g., 0712345678"
                      disabled={loading}
                      className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                    />
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Loading State */}
                  {loading && (
                    <div className="mb-4 p-4 bg-cyan-500/10 border border-cyan-500/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                        <div>
                          <p className="text-cyan-400 font-medium">Processing payment...</p>
                          <p className="text-gray-400 text-sm">Please enter your M-PESA PIN on your phone</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={closeModal}
                      disabled={loading}
                      className="flex-1 bg-slate-800 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCharge}
                      disabled={loading || !phone}
                      className="flex-1 bg-cyan-500 text-black font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard size={20} />
                          Pay Now
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductCarousel;
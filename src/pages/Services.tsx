import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Home, CreditCard, Users, TrendingUp } from 'lucide-react';
import React from 'react';

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

const products = [
  { id: 1, title: 'Premium Coffee', color: 'from-amber-900 to-amber-700', price: 50 },
  { id: 2, title: 'Yoga Classes', color: 'from-purple-600 to-pink-500', price: 120 },
  { id: 3, title: 'Web Design', color: 'from-blue-600 to-cyan-500', price: 850 },
  { id: 4, title: 'Fitness Coach', color: 'from-green-600 to-emerald-500', price: 300 },
  { id: 5, title: 'Photography', color: 'from-slate-700 to-slate-900', price: 450 },
  { id: 6, title: 'Music Lessons', color: 'from-red-600 to-orange-500', price: 200 },
  { id: 7, title: 'Art Prints', color: 'from-indigo-600 to-violet-500', price: 75 },
  { id: 8, title: 'Consulting', color: 'from-teal-600 to-cyan-600', price: 950 },
  { id: 9, title: 'Marketing', color: 'from-rose-600 to-pink-600', price: 700 },
  { id: 10, title: 'Branding', color: 'from-yellow-600 to-amber-600', price: 650 },
  { id: 11, title: 'SEO Services', color: 'from-lime-600 to-green-600', price: 550 },
  { id: 12, title: 'Video Editing', color: 'from-fuchsia-600 to-purple-600', price: 400 },
];


interface ProductCarouselProps {
    cyber: any;
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({  }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [currentSlide, setCurrentSlide] = useState(0);

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

  const getCardSizes = () => {
    if (screenWidth < 768) {
      return { normal: 33.333, expanded: 40 };
    } else if (screenWidth < 1024) {
      return { normal: 25, expanded: 35 };
    } else if (screenWidth < 1280) {
      return { normal: 20, expanded: 28 };
    } else {
      return { normal: 16.666, expanded: 22 };
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
        
        <div className="flex flex-wrap gap-1">
          {products.map((product) => {
            const isSelected = selected === product.id;
            const isOtherSelected = selected && selected !== product.id;
            
            return (
              <motion.div
                key={product.id}
                className="relative cursor-pointer"
                style={{
                  width: `calc(${isSelected ? sizes.expanded : sizes.normal}% - 2px)`,
                }}
                onClick={() => setSelected(isSelected ? null : product.id as unknown as null)}
                initial={false}
                animate={{
                  scale: isSelected ? 1.02 : 1,
                  filter: isOtherSelected ? 'blur(4px)' : 'blur(0px)',
                  opacity: isOtherSelected ? 0.6 : 1,
                }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <div className="relative w-full overflow-hidden rounded-lg shadow-2xl" style={{ aspectRatio: '9/16' }}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${product.color}`} />
                  
                  <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-transparent">
                    <h3 className="text-white font-semibold text-sm">
                      {product.title}
                    </h3>
                  </div>

                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent"
                        style={{ height: '30%' }}
                      >
                        
                        <div className="mb-4">
                          <h3 className="text-white font-bold text-lg">
                            Price
                          </h3>
                          <p className="text-white/90 text-sm">
                            {product.price}
                          </p>
                        </div>

                        <button className="w-full bg-white text-black font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors shadow-lg">
                          <ShoppingCart size={20} />
                          PAY FOR
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProductCarousel;
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import SEO from '../components/SEO';
import InstallButton from '../pwa/InstallButton';
import lockupReversed from '../../brand/desk-lockup-reversed.svg'

// Short landscape phones: drop the optional blocks instead of scrolling.
const SHORT = '[@media(max-height:520px)]:hidden'

export default function HomePage() {
    const navigate = useNavigate();

    // The landing page never scrolls: lock the document while it is mounted.
    useEffect(() => {
      const root = document.documentElement
      const prev = root.style.overflow
      root.style.overflow = 'hidden'
      return () => { root.style.overflow = prev }
    }, [])

    return (
      <>
        <SEO 
          title="Samuhia Desk - Support Desk for Chamas, Schools and Landlords in Kenya"
          description="Samuhia Desk lets agents in Kenya support chamas on MyChama, schools on MyRegister and landlords on Plot Yangu, and earn from the work they do."
          keywords="Samuhia Desk, MyChama agent, MyRegister agent, Plot Yangu agent, chama support Kenya, school SMS Kenya, property management Kenya"
          canonicalUrl="https://desk.samuhia.co.ke/"
        />
        
        {/* h-dvh follows the visible viewport (mobile URL bar, installed app), so nothing is cut off or scrolls */}
        <div className="relative h-dvh w-full overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white flex flex-col pt-[env(safe-area-inset-top)]">
          {/* Animated background threads */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            transition={{ duration: 2 }}
          >
            <motion.div
              className="absolute w-full h-full"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                backgroundImage: 'radial-gradient(circle at center, rgba(34,211,238,0.18) 0%, transparent 70%)',
              }}
            />
          </motion.div>
          
          <div className="absolute right-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-20">
            <InstallButton tone="onDark" />
          </div>

          {/* Main content: sizes scale with the screen, spacing follows the available height */}
          <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center text-center px-5 gap-[clamp(0.6rem,2.6dvh,1.75rem)]">
            <motion.img
              src={lockupReversed}
              alt="Samuhia Desk"
              width={526}
              height={176}
              className={`w-[clamp(10rem,50vw,20rem)] max-h-[20dvh] object-contain ${SHORT}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
            />

            <motion.h1
              className="font-bold tracking-tight leading-tight text-[clamp(1.6rem,min(8vw,7dvh),3.75rem)]"
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1 }}
            >
              Welcome to <span className="text-cyan-400">Samuhia Desk</span>
            </motion.h1>
            
            <motion.p
              className={`text-gray-300 max-w-md mx-auto text-[clamp(0.9rem,min(3.8vw,3.2dvh),1.25rem)] ${SHORT}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 1 }}
            >
              A desk for agents who help chamas, schools and landlords get set up and stay on track, and earn from the service they give.
            </motion.p>
            
            <motion.div
              className="flex flex-wrap gap-3 justify-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1, duration: 0.8 }}
            >
              <button 
                onClick={() => navigate('/explore')} 
                className="px-[clamp(1.25rem,6vw,1.75rem)] py-[clamp(0.55rem,1.8dvh,0.85rem)] text-[clamp(0.95rem,2.6dvh,1.125rem)] rounded-full bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/30 font-semibold transition-all"
                aria-label="Explore Samuhia Desk features and services"
              >
                Explore
              </button>
              <button 
                onClick={() => navigate('/signin')} 
                className="px-[clamp(1.25rem,6vw,1.75rem)] py-[clamp(0.55rem,1.8dvh,0.85rem)] text-[clamp(0.95rem,2.6dvh,1.125rem)] rounded-full bg-transparent border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all font-semibold"
                aria-label="Sign in to your Samuhia Desk account"
              >
                Sign In
              </button>
            </motion.div>
          </main>

          {/* Footer sits in the layout (not absolutely positioned), so it can never overlap the content */}
          <footer className="relative z-10 shrink-0 text-center text-xs sm:text-sm text-gray-500 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <p className="mb-1">© {new Date().getFullYear()} Samuhia Desk. All rights reserved.</p>
            <nav className="space-x-4" aria-label="Footer navigation">
              <a href="https://payments.samuhia.co.ke/contact" className="hover:text-cyan-400 transition-colors" rel="noopener noreferrer" target="_blank">Contact Us</a>
              <a href="https://samuhia.co.ke/terms" className="hover:text-cyan-400 transition-colors" rel="noopener noreferrer" target="_blank">Terms of Use</a>
            </nav>
          </footer>

          {/* Floating Action Button - Upload (sits above the footer on phones) */}
          <motion.button
            onClick={() => navigate('/upload')}
            className="fixed z-50 right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(4.25rem+env(safe-area-inset-bottom))] sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-full shadow-2xl shadow-cyan-500/50 flex items-center justify-center group transition-all hover:scale-110"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.5, type: "spring" }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Upload documents or forms"
          >
            <Upload className="w-6 h-6 sm:w-7 sm:h-7 text-white group-hover:scale-110 transition-transform" />
            
            {/* Tooltip */}
            <span className="absolute bottom-full mb-3 right-0 bg-gray-900 text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Upload Documents
              <span className="absolute top-full right-6 -mt-1 border-4 border-transparent border-t-gray-900"></span>
            </span>

            {/* Pulse animation */}
            <span className="absolute inset-0 rounded-full bg-cyan-400 opacity-0 group-hover:opacity-20 group-hover:animate-ping"></span>
          </motion.button>
        </div>
      </>
    )
}

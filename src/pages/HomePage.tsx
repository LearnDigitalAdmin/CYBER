import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

export default function HomePage() {
    const navigate = useNavigate();
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white flex flex-col justify-center items-center">
      {/* Animated background threads */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ duration: 2 }}
      >
        <motion.div
          className="absolute w-full h-full bg-gradient-radial from-white/15 via-transparent to-transparent"
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
            backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 70%)',
          }}
        />
      </motion.div>
      
      {/* Main content */}
      <div className="z-10 text-center space-y-6 px-4">
        <motion.h1
          className="text-5xl md:text-6xl font-bold tracking-tight"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1 }}
        >
          Welcome to <span className="text-cyan-400">Cogvana Cyber</span>
        </motion.h1>
        
        <motion.p
          className="text-lg md:text-xl text-gray-300 max-w-md mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1 }}
        >
          Empowering digital freelancers, landlords, and agents to connect, grow, and earn through smart automation.
        </motion.p>
        
        <motion.div
          className="flex flex-row gap-4 justify-center mt-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
        >
          <button onClick={() => navigate('/explore')} className="px-6 py-3 text-lg rounded-full bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/30 font-semibold transition-all">
            Explore
          </button>
          <button onClick={() => navigate('/signin')} className="px-6 py-3 text-lg rounded-full bg-transparent border-2 border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all font-semibold">
            Sign In
          </button>
        </motion.div>
      </div>
      
      {/* Footer */}
      <footer className="absolute bottom-6 w-full text-center text-sm text-gray-500 px-4">
        <p className="mb-1">© {new Date().getFullYear()} Cogvana Cyber. All rights reserved.</p>
        <div className="space-x-4">
          <a href="https://payments.cogvana.co.ke/contact" className="hover:text-cyan-400 transition-colors">Contact Us</a>
          <a href="https://cogvana.co.ke/terms" className="hover:text-cyan-400 transition-colors">Terms of Use</a>
        </div>
      </footer>
    </div>
  )
}
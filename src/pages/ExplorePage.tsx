// import { motion } from 'framer-motion';
// import { CheckCircle, ArrowRight, Shield, Zap, TrendingUp, FileText, Store, Wallet, Users, BarChart3, Lock, Calendar, DollarSign, AlertCircle } from 'lucide-react';
// import { useNavigate } from 'react-router-dom';

// export default function ExplorePage() {
//   const navigate = useNavigate();
  
//   return (
//     <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white flex flex-col overflow-hidden">
//       {/* Animated Background Elements */}
//       <div className="fixed inset-0 overflow-hidden pointer-events-none">
//         <motion.div
//           animate={{
//             scale: [1, 1.2, 1],
//             rotate: [0, 90, 0],
//             opacity: [0.03, 0.06, 0.03]
//           }}
//           transition={{ duration: 20, repeat: Infinity }}
//           className="absolute top-0 right-0 w-96 h-96 bg-cyan-500 rounded-full blur-3xl"
//         />
//         <motion.div
//           animate={{
//             scale: [1, 1.3, 1],
//             rotate: [0, -90, 0],
//             opacity: [0.03, 0.05, 0.03]
//           }}
//           transition={{ duration: 25, repeat: Infinity }}
//           className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500 rounded-full blur-3xl"
//         />
//       </div>

//       {/* Hero Section */}
//       <section className="relative flex flex-col items-center justify-center text-center py-24 px-6 z-10">
//         <motion.div
//           initial={{ opacity: 0, scale: 0.9 }}
//           animate={{ opacity: 1, scale: 1 }}
//           transition={{ duration: 0.6 }}
//           className="mb-4"
//         >
//           <div className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
//             <span className="text-cyan-400 font-semibold">🚀 100% Free Registration • No Hidden Fees</span>
//           </div>
//         </motion.div>
        
//         <motion.h1
//           initial={{ opacity: 0, y: -30 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.8, delay: 0.2 }}
//           className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent"
//         >
//           Empowering Kenya's Digital Workforce
//         </motion.h1>
        
//         <motion.p
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ delay: 0.4, duration: 0.8 }}
//           className="max-w-3xl text-gray-300 text-xl mb-8 leading-relaxed"
//         >
//           Transform your cyber café or freelance business into a powerful digital hub. Manage Plot Yangu properties, process M-Pesa payments, sell products, and earn from every transaction — all in one platform.
//         </motion.p>
        
//         <motion.div 
//           initial={{ opacity: 0, y: 20 }} 
//           animate={{ opacity: 1, y: 0 }} 
//           transition={{ delay: 0.6 }}
//           className="flex flex-col sm:flex-row gap-4"
//         >
//           <button 
//             onClick={() => navigate('/signup')} 
//             className="group bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 flex items-center gap-2"
//           >
//             Start Free Today 
//             <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
//           </button>
//           <a 
//             href="https://cogvana.co.ke/" 
//             target="_blank" 
//             rel="noopener noreferrer"
//             className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all flex items-center gap-2"
//           >
//             Learn More
//           </a>
//         </motion.div>
//       </section>

//       {/* How Registration Works */}
//       <section className="relative bg-gradient-to-b from-transparent to-gray-900/50 py-20 px-6 z-10">
//         <div className="max-w-6xl mx-auto">
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             className="text-center mb-16"
//           >
//             <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
//               Simple, Free Registration
//             </h2>
//             <p className="text-gray-400 text-lg max-w-2xl mx-auto">
//               No verification fees. No hidden charges. Just create your account and start earning.
//             </p>
//           </motion.div>

//           <div className="grid md:grid-cols-4 gap-6">
//             {[
//               {
//                 icon: <Users className="w-8 h-8" />,
//                 title: 'Create Account',
//                 desc: 'Sign up with email and password'
//               },
//               {
//                 icon: <FileText className="w-8 h-8" />,
//                 title: 'Upload Documents',
//                 desc: 'Provide ID, KRA PIN, and business details'
//               },
//               {
//                 icon: <Wallet className="w-8 h-8" />,
//                 title: 'Add Payment Account',
//                 desc: 'Link your income account for payouts'
//               },
//               {
//                 icon: <Zap className="w-8 h-8" />,
//                 title: 'Start Operating',
//                 desc: 'Access your dashboard instantly'
//               }
//             ].map((step, i) => (
//               <motion.div
//                 key={i}
//                 initial={{ opacity: 0, y: 30 }}
//                 whileInView={{ opacity: 1, y: 0 }}
//                 viewport={{ once: true }}
//                 transition={{ delay: i * 0.1 }}
//                 className="relative group"
//               >
//                 <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 group-hover:border-cyan-500/50 rounded-2xl p-6 h-full transition-all duration-300">
//                   <div className="bg-cyan-500/10 w-16 h-16 rounded-xl flex items-center justify-center mb-4 text-cyan-400 group-hover:scale-110 transition-transform">
//                     {step.icon}
//                   </div>
//                   <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
//                   <p className="text-gray-400">{step.desc}</p>
//                 </div>
//                 {i < 3 && (
//                   <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-cyan-500 to-transparent" />
//                 )}
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* Dashboard Features */}
//       <section className="relative py-20 px-6 z-10">
//         <div className="max-w-7xl mx-auto">
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             className="text-center mb-16"
//           >
//             <h2 className="text-4xl font-bold mb-4">Your All-in-One Dashboard</h2>
//             <p className="text-gray-400 text-lg max-w-3xl mx-auto">
//               Manage everything from one powerful interface — Plot Yangu operations, cyber services, income tracking, and product sales.
//             </p>
//           </motion.div>

//           <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
//             {[
//               {
//                 icon: <BarChart3 className="w-7 h-7" />,
//                 title: 'Plot Yangu Management',
//                 desc: 'Manage landlord properties, collect rent, track tenants',
//                 color: 'from-cyan-500 to-blue-500'
//               },
//               {
//                 icon: <Zap className="w-7 h-7" />,
//                 title: 'M-Pesa Payment Terminal',
//                 desc: 'Process instant STK push payments for all transactions',
//                 color: 'from-blue-500 to-purple-500'
//               },
//               {
//                 icon: <Store className="w-7 h-7" />,
//                 title: 'Products & Services',
//                 desc: 'List and sell your cyber products and services online',
//                 color: 'from-purple-500 to-pink-500'
//               },
//               {
//                 icon: <TrendingUp className="w-7 h-7" />,
//                 title: 'Income Monitoring',
//                 desc: 'Real-time tracking of earnings and commissions',
//                 color: 'from-pink-500 to-red-500'
//               },
//               {
//                 icon: <FileText className="w-7 h-7" />,
//                 title: 'Invoice Generation',
//                 desc: 'Print professional invoices for all transactions',
//                 color: 'from-green-500 to-teal-500'
//               },
//               {
//                 icon: <Lock className="w-7 h-7" />,
//                 title: 'Secure & Compliant',
//                 desc: 'All operations under your country\'s jurisdiction',
//                 color: 'from-orange-500 to-yellow-500'
//               }
//             ].map((feature, i) => (
//               <motion.div
//                 key={i}
//                 initial={{ opacity: 0, scale: 0.9 }}
//                 whileInView={{ opacity: 1, scale: 1 }}
//                 viewport={{ once: true }}
//                 transition={{ delay: i * 0.1 }}
//                 whileHover={{ scale: 1.05 }}
//                 className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 hover:border-gray-600 rounded-2xl p-6 cursor-pointer transition-all"
//               >
//                 <div className={`bg-gradient-to-r ${feature.color} w-14 h-14 rounded-xl flex items-center justify-center mb-4 text-white`}>
//                   {feature.icon}
//                 </div>
//                 <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
//                 <p className="text-gray-400">{feature.desc}</p>
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* Plot Yangu Agent Program */}
//       <section className="relative bg-gradient-to-br from-cyan-900/20 via-blue-900/20 to-purple-900/20 py-20 px-6 z-10">
//         <div className="max-w-6xl mx-auto">
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             className="text-center mb-16"
//           >
//             <div className="inline-block px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-full mb-4">
//               <span className="text-cyan-400 font-semibold">💎 Premium Earnings Program</span>
//             </div>
//             <h2 className="text-4xl font-bold mb-4">Become a Plot Yangu Agent</h2>
//             <p className="text-gray-400 text-lg max-w-3xl mx-auto">
//               By joining Cogvana Cyber, you automatically become a Plot Yangu agent. Manage landlord properties and earn substantial commissions.
//             </p>
//           </motion.div>

//           <div className="grid md:grid-cols-2 gap-8 mb-12">
//             <motion.div
//               initial={{ opacity: 0, x: -30 }}
//               whileInView={{ opacity: 1, x: 0 }}
//               viewport={{ once: true }}
//               className="bg-gradient-to-br from-gray-800 to-gray-900 border border-cyan-500/30 rounded-2xl p-8"
//             >
//               <Calendar className="w-12 h-12 text-cyan-400 mb-4" />
//               <h3 className="text-2xl font-bold mb-4">Subscription Plans</h3>
//               <div className="space-y-4">
//                 <div className="flex items-start gap-3">
//                   <CheckCircle className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
//                   <div>
//                     <p className="font-semibold text-white">30-Day Free Trial</p>
//                     <p className="text-gray-400 text-sm">All landlords and agents start with full access</p>
//                   </div>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <CheckCircle className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
//                   <div>
//                     <p className="font-semibold text-white">Monthly: KES 500 - 5,600</p>
//                     <p className="text-gray-400 text-sm">Based on property portfolio size</p>
//                   </div>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <CheckCircle className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
//                   <div>
//                     <p className="font-semibold text-white">Annual: KES 5,000 - 56,000</p>
//                     <p className="text-gray-400 text-sm">Save more with yearly billing</p>
//                   </div>
//                 </div>
//               </div>
//             </motion.div>

//             <motion.div
//               initial={{ opacity: 0, x: 30 }}
//               whileInView={{ opacity: 1, x: 0 }}
//               viewport={{ once: true }}
//               className="bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-500/30 rounded-2xl p-8"
//             >
//               <DollarSign className="w-12 h-12 text-purple-400 mb-4" />
//               <h3 className="text-2xl font-bold mb-4">Your Earnings</h3>
//               <div className="space-y-4">
//                 <div className="flex items-start gap-3">
//                   <TrendingUp className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
//                   <div>
//                     <p className="font-semibold text-white">45% Commission</p>
//                     <p className="text-gray-400 text-sm">On all assets you manage for landlords and agents</p>
//                   </div>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <TrendingUp className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
//                   <div>
//                     <p className="font-semibold text-white">Up to KES 5,000 Monthly Bonuses</p>
//                     <p className="text-gray-400 text-sm">Performance-based rewards and incentives</p>
//                   </div>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <TrendingUp className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
//                   <div>
//                     <p className="font-semibold text-white">Transaction Fees</p>
//                     <p className="text-gray-400 text-sm">Charge up to KES 20 per printed invoice</p>
//                   </div>
//                 </div>
//               </div>
//             </motion.div>
//           </div>

//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-2xl p-6"
//           >
//             <div className="flex items-start gap-4">
//               <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
//               <div>
//                 <h4 className="text-lg font-bold text-yellow-400 mb-2">Important: Payment Terminal Rules</h4>
//                 <p className="text-gray-300">
//                   All Plot Yangu rent payments MUST be processed through the M-Pesa terminal. Cash transactions are not permitted. After rent is paid, print invoices via your cyber dashboard and charge tenants no more than KES 20 for the service.
//                 </p>
//               </div>
//             </div>
//           </motion.div>
//         </div>
//       </section>

//       {/* Payment Processing */}
//       <section className="relative py-20 px-6 z-10">
//         <div className="max-w-6xl mx-auto">
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             className="text-center mb-16"
//           >
//             <h2 className="text-4xl font-bold mb-4">Secure Payment Processing</h2>
//             <p className="text-gray-400 text-lg max-w-3xl mx-auto">
//               All payments are processed through Paystack with industry-standard security. Fast, reliable, and transparent.
//             </p>
//           </motion.div>

//           <div className="grid md:grid-cols-2 gap-8">
//             <motion.div
//               initial={{ opacity: 0, x: -30 }}
//               whileInView={{ opacity: 1, x: 0 }}
//               viewport={{ once: true }}
//               className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-8"
//             >
//               <Shield className="w-12 h-12 text-green-400 mb-4" />
//               <h3 className="text-2xl font-bold mb-4">Payment Details</h3>
//               <div className="space-y-3">
//                 <div className="flex items-start gap-3">
//                   <CheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
//                   <p className="text-gray-300">Processed by Paystack (trusted payment gateway)</p>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <CheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
//                   <p className="text-gray-300">Full M-Pesa integration with instant STK push</p>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <CheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
//                   <p className="text-gray-300">T+2 settlement rule (funds in 2 business days)</p>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <CheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
//                   <p className="text-gray-300">Transaction fees: 1.5% - 3.9% per payment</p>
//                 </div>
//               </div>
//             </motion.div>

//             <motion.div
//               initial={{ opacity: 0, x: 30 }}
//               whileInView={{ opacity: 1, x: 0 }}
//               viewport={{ once: true }}
//               className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-8"
//             >
//               <Wallet className="w-12 h-12 text-blue-400 mb-4" />
//               <h3 className="text-2xl font-bold mb-4">How Payouts Work</h3>
//               <div className="space-y-3">
//                 <div className="flex items-start gap-3">
//                   <CheckCircle className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
//                   <p className="text-gray-300">Link your income account during registration</p>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <CheckCircle className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
//                   <p className="text-gray-300">Automatic payouts to your linked account</p>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <CheckCircle className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
//                   <p className="text-gray-300">Track all earnings in real-time on your dashboard</p>
//                 </div>
//                 <div className="flex items-start gap-3">
//                   <CheckCircle className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
//                   <p className="text-gray-300">Transparent fee breakdown for every transaction</p>
//                 </div>
//               </div>
//             </motion.div>
//           </div>
//         </div>
//       </section>

//       {/* Why Choose Us */}
//       <section className="relative bg-gradient-to-b from-transparent to-gray-900/50 py-20 px-6 z-10">
//         <div className="max-w-7xl mx-auto">
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             className="text-center mb-16"
//           >
//             <h2 className="text-4xl font-bold mb-4">Why Choose Cogvana Cyber?</h2>
//             <p className="text-gray-400 text-lg max-w-3xl mx-auto">
//               Everything you need to run a successful digital business in Kenya
//             </p>
//           </motion.div>

//           <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
//             {[
//               'Free account creation with no hidden fees',
//               'Automated M-Pesa payment collection',
//               'Instant rent and subscription updates',
//               'Built-in product and service marketplace',
//               'Real-time income tracking and analytics',
//               'Secure document management system',
//               'Professional invoice generation and printing',
//               'Full Plot Yangu property management integration',
//               'Offline-first data caching for reliability',
//               '45% commission on managed assets',
//               'Up to KES 5,000 monthly bonuses',
//               'Compliant with local regulations'
//             ].map((benefit, i) => (
//               <motion.div
//                 key={i}
//                 initial={{ opacity: 0, scale: 0.9 }}
//                 whileInView={{ opacity: 1, scale: 1 }}
//                 viewport={{ once: true }}
//                 transition={{ delay: i * 0.05 }}
//                 whileHover={{ scale: 1.05 }}
//                 className="flex items-start gap-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 hover:border-cyan-500/50 rounded-xl p-4 transition-all"
//               >
//                 <CheckCircle className="text-cyan-400 mt-0.5 w-5 h-5 flex-shrink-0" />
//                 <p className="text-gray-300 text-sm">{benefit}</p>
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* Support Section */}
//       <section className="relative py-20 px-6 z-10">
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           whileInView={{ opacity: 1, y: 0 }}
//           viewport={{ once: true }}
//           className="max-w-4xl mx-auto bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-cyan-500/30 rounded-3xl p-10 text-center"
//         >
//           <div className="bg-cyan-500/10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
//             <Shield className="w-10 h-10 text-cyan-400" />
//           </div>
//           <h2 className="text-3xl font-bold mb-4">Need Help or Assistance?</h2>
//           <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
//             For support, questions, or technical assistance, please only use our official contact channels.
//           </p>
//           <div className="flex flex-col sm:flex-row gap-4 justify-center">
//             <a
//               href="https://payments.cogvana.co.ke/contact"
//               target="_blank"
//               rel="noopener noreferrer"
//               className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 inline-flex items-center justify-center gap-2"
//             >
//               Contact Support
//               <ArrowRight className="w-4 h-4" />
//             </a>
//             <a
//               href="https://cogvana.co.ke/"
//               target="_blank"
//               rel="noopener noreferrer"
//               className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-3 rounded-xl font-semibold transition-all inline-flex items-center justify-center gap-2"
//             >
//               Visit Official Site
//             </a>
//           </div>
//         </motion.div>
//       </section>

//       {/* Final CTA */}
//       <section className="relative py-24 text-center bg-gradient-to-br from-cyan-900/30 via-blue-900/30 to-purple-900/30 z-10">
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           whileInView={{ opacity: 1, y: 0 }}
//           viewport={{ once: true }}
//           className="max-w-4xl mx-auto px-6"
//         >
//           <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
//             Be Part of Kenya's Digital Future
//           </h2>
//           <p className="text-gray-300 text-xl mb-10 max-w-3xl mx-auto leading-relaxed">
//             Whether you run a local cyber café or work as a freelancer, Cogvana Cyber gives you the tools to earn more, do more, and empower your community.
//           </p>
//           <motion.button
//             onClick={() => navigate('/signup')}
//             whileHover={{ scale: 1.05 }}
//             whileTap={{ scale: 0.95 }}
//             className="group bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-10 py-5 rounded-xl text-xl font-bold transition-all shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 inline-flex items-center gap-3"
//           >
//             Get Started Free Today
//             <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
//           </motion.button>
//           <p className="text-gray-500 mt-6 text-sm">
//             No credit card required • No verification fees • Start earning immediately
//           </p>
//         </motion.div>
//       </section>

//       {/* Footer */}
//       <footer className="relative bg-black text-gray-500 text-sm py-8 text-center border-t border-gray-800 z-10">
//         <p className="mb-4 text-gray-400">© 2025 Cogvana Cyber | Empowering Kenya's Digital Future</p>
//         <div className="flex flex-wrap justify-center gap-6 mb-4">
//           <a href="https://cogvana.co.ke/" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">
//             Official Website
//           </a>
//           <a href="https://payments.cogvana.co.ke/contact" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">
//             Contact Us
//           </a>
//           <a href="https://cogvana.co.ke/terms" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">
//             Terms of Use
//           </a>
//         </div>
//         <p className="text-xs text-gray-600 max-w-4xl mx-auto px-6">
//           All operations conducted under the jurisdiction of your country's laws. Payments processed securely through Paystack. Transaction fees apply (1.5% - 3.9%). T+2 settlement rule applies to all payouts.
//         </p>
//       </footer>
//     </div>
//   );
// }

import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, Shield, Zap, TrendingUp, FileText, Store, Wallet, Users, BarChart3, Lock, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';


export default function ExplorePage() {
  const navigate = useNavigate();
  
  return (
    <>
      <SEO 
        title="Explore Cogvana Cyber - Digital Business Solutions Kenya | Plot Yangu Agent Program"
        description="Discover how Cogvana Cyber transforms cyber cafés into digital hubs. Manage Plot Yangu properties, process M-Pesa payments, earn 45% commission, and access free registration. Complete platform for Kenya's digital workforce."
        keywords="Plot Yangu agent Kenya, cyber café business Kenya, M-Pesa payment processing, property management commission, digital business platform Kenya, rent collection Kenya, cyber services marketplace, freelance income Kenya, Plot Yangu subscription plans"
        canonicalUrl="https://cyber.cogvana.co.ke/explore"
      />
      
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white flex flex-col overflow-hidden">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              opacity: [0.03, 0.06, 0.03]
            }}
            transition={{ duration: 20, repeat: Infinity }}
            className="absolute top-0 right-0 w-96 h-96 bg-cyan-500 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              scale: [1, 1.3, 1],
              rotate: [0, -90, 0],
              opacity: [0.03, 0.05, 0.03]
            }}
            transition={{ duration: 25, repeat: Infinity }}
            className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500 rounded-full blur-3xl"
          />
        </div>

        {/* Hero Section */}
        <section className="relative flex flex-col items-center justify-center text-center py-24 px-6 z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-4"
          >
            <div className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
              <span className="text-cyan-400 font-semibold">🚀 100% Free Registration • No Hidden Fees</span>
            </div>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent"
          >
            Empowering Kenya's Digital Workforce
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="max-w-3xl text-gray-300 text-xl mb-8 leading-relaxed"
          >
            Transform your cyber café or freelance business into a powerful digital hub. Manage Plot Yangu properties, process M-Pesa payments, sell products, and earn from every transaction — all in one platform.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <button 
              onClick={() => navigate('/signup')} 
              className="group bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 flex items-center gap-2"
              aria-label="Start free registration today"
            >
              Start Free Today 
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a 
              href="https://cogvana.co.ke/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all flex items-center gap-2"
              aria-label="Learn more about Cogvana"
            >
              Learn More
            </a>
          </motion.div>
        </section>

        {/* How Registration Works */}
        <section className="relative bg-gradient-to-b from-transparent to-gray-900/50 py-20 px-6 z-10" aria-labelledby="registration-heading">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 id="registration-heading" className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Simple, Free Registration
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                No verification fees. No hidden charges. Just create your account and start earning.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-4 gap-6">
              {[
                {
                  icon: <Users className="w-8 h-8" />,
                  title: 'Create Account',
                  desc: 'Sign up with email and password'
                },
                {
                  icon: <FileText className="w-8 h-8" />,
                  title: 'Upload Documents',
                  desc: 'Provide ID, KRA PIN, and business details'
                },
                {
                  icon: <Wallet className="w-8 h-8" />,
                  title: 'Add Payment Account',
                  desc: 'Link your income account for payouts'
                },
                {
                  icon: <Zap className="w-8 h-8" />,
                  title: 'Start Operating',
                  desc: 'Access your dashboard instantly'
                }
              ].map((step, i) => (
                <motion.article
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative group"
                >
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 group-hover:border-cyan-500/50 rounded-2xl p-6 h-full transition-all duration-300">
                    <div className="bg-cyan-500/10 w-16 h-16 rounded-xl flex items-center justify-center mb-4 text-cyan-400 group-hover:scale-110 transition-transform">
                      {step.icon}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-gray-400">{step.desc}</p>
                  </div>
                  {i < 3 && (
                    <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-cyan-500 to-transparent" aria-hidden="true" />
                  )}
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* Dashboard Features */}
      <section className="relative py-20 px-6 z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Your All-in-One Dashboard</h2>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto">
              Manage everything from one powerful interface — Plot Yangu operations, cyber services, income tracking, and product sales.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <BarChart3 className="w-7 h-7" />,
                title: 'Plot Yangu Management',
                desc: 'Manage landlord properties, collect rent, track tenants',
                color: 'from-cyan-500 to-blue-500'
              },
              {
                icon: <Zap className="w-7 h-7" />,
                title: 'M-Pesa Payment Terminal',
                desc: 'Process instant STK push payments for all transactions',
                color: 'from-blue-500 to-purple-500'
              },
              {
                icon: <Store className="w-7 h-7" />,
                title: 'Products & Services',
                desc: 'List and sell your cyber products and services online',
                color: 'from-purple-500 to-pink-500'
              },
              {
                icon: <TrendingUp className="w-7 h-7" />,
                title: 'Income Monitoring',
                desc: 'Real-time tracking of earnings and commissions',
                color: 'from-pink-500 to-red-500'
              },
              {
                icon: <FileText className="w-7 h-7" />,
                title: 'Invoice Generation',
                desc: 'Print professional invoices for all transactions',
                color: 'from-green-500 to-teal-500'
              },
              {
                icon: <Lock className="w-7 h-7" />,
                title: 'Secure & Compliant',
                desc: 'All operations under your country\'s jurisdiction',
                color: 'from-orange-500 to-yellow-500'
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 hover:border-gray-600 rounded-2xl p-6 cursor-pointer transition-all"
              >
                <div className={`bg-gradient-to-r ${feature.color} w-14 h-14 rounded-xl flex items-center justify-center mb-4 text-white`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Plot Yangu Agent Program */}
      <section className="relative bg-gradient-to-br from-cyan-900/20 via-blue-900/20 to-purple-900/20 py-20 px-6 z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-block px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-full mb-4">
              <span className="text-cyan-400 font-semibold">💎 Premium Earnings Program</span>
            </div>
            <h2 className="text-4xl font-bold mb-4">Become a Plot Yangu Agent</h2>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto">
              By joining Cogvana Cyber, you automatically become a Plot Yangu agent. Manage landlord properties and earn substantial commissions.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 border border-cyan-500/30 rounded-2xl p-8"
            >
              <Calendar className="w-12 h-12 text-cyan-400 mb-4" />
              <h3 className="text-2xl font-bold mb-4">Subscription Plans</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white">30-Day Free Trial</p>
                    <p className="text-gray-400 text-sm">All landlords and agents start with full access</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Monthly: KES 500 - 5,600</p>
                    <p className="text-gray-400 text-sm">Based on property portfolio size</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Annual: KES 5,000 - 56,000</p>
                    <p className="text-gray-400 text-sm">Save more with yearly billing</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-500/30 rounded-2xl p-8"
            >
              <DollarSign className="w-12 h-12 text-purple-400 mb-4" />
              <h3 className="text-2xl font-bold mb-4">Your Earnings</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white">45% Commission</p>
                    <p className="text-gray-400 text-sm">On all assets you manage for landlords and agents</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Up to KES 5,000 Monthly Bonuses</p>
                    <p className="text-gray-400 text-sm">Performance-based rewards and incentives</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Transaction Fees</p>
                    <p className="text-gray-400 text-sm">Charge up to KES 20 per printed invoice</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-2xl p-6"
          >
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-lg font-bold text-yellow-400 mb-2">Important: Payment Terminal Rules</h4>
                <p className="text-gray-300">
                  All Plot Yangu rent payments MUST be processed through the M-Pesa terminal. Cash transactions are not permitted. After rent is paid, print invoices via your cyber dashboard and charge tenants no more than KES 20 for the service.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Payment Processing */}
      <section className="relative py-20 px-6 z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Secure Payment Processing</h2>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto">
              All payments are processed through Paystack with industry-standard security. Fast, reliable, and transparent.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-8"
            >
              <Shield className="w-12 h-12 text-green-400 mb-4" />
              <h3 className="text-2xl font-bold mb-4">Payment Details</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <p className="text-gray-300">Processed by Paystack (trusted payment gateway)</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <p className="text-gray-300">Full M-Pesa integration with instant STK push</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <p className="text-gray-300">T+2 settlement rule (funds in 2 business days)</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <p className="text-gray-300">Transaction fees: 1.5% - 3.9% per payment</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-8"
            >
              <Wallet className="w-12 h-12 text-blue-400 mb-4" />
              <h3 className="text-2xl font-bold mb-4">How Payouts Work</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                  <p className="text-gray-300">Link your income account during registration</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                  <p className="text-gray-300">Automatic payouts to your linked account</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                  <p className="text-gray-300">Track all earnings in real-time on your dashboard</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                  <p className="text-gray-300">Transparent fee breakdown for every transaction</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="relative bg-gradient-to-b from-transparent to-gray-900/50 py-20 px-6 z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Why Choose Cogvana Cyber?</h2>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto">
              Everything you need to run a successful digital business in Kenya
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              'Free account creation with no hidden fees',
              'Automated M-Pesa payment collection',
              'Instant rent and subscription updates',
              'Built-in product and service marketplace',
              'Real-time income tracking and analytics',
              'Secure document management system',
              'Professional invoice generation and printing',
              'Full Plot Yangu property management integration',
              'Offline-first data caching for reliability',
              '45% commission on managed assets',
              'Up to KES 5,000 monthly bonuses',
              'Compliant with local regulations'
            ].map((benefit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.05 }}
                className="flex items-start gap-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 hover:border-cyan-500/50 rounded-xl p-4 transition-all"
              >
                <CheckCircle className="text-cyan-400 mt-0.5 w-5 h-5 flex-shrink-0" />
                <p className="text-gray-300 text-sm">{benefit}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Support Section */}
      <section className="relative py-20 px-6 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-cyan-500/30 rounded-3xl p-10 text-center"
        >
          <div className="bg-cyan-500/10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-cyan-400" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Need Help or Assistance?</h2>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
            For support, questions, or technical assistance, please only use our official contact channels.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://payments.cogvana.co.ke/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 inline-flex items-center justify-center gap-2"
            >
              Contact Support
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="https://cogvana.co.ke/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-700 hover:bg-gray-600 text-white px-8 py-3 rounded-xl font-semibold transition-all inline-flex items-center justify-center gap-2"
            >
              Visit Official Site
            </a>
          </div>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="relative py-24 text-center bg-gradient-to-br from-cyan-900/30 via-blue-900/30 to-purple-900/30 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto px-6"
        >
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            Be Part of Kenya's Digital Future
          </h2>
          <p className="text-gray-300 text-xl mb-10 max-w-3xl mx-auto leading-relaxed">
            Whether you run a local cyber café or work as a freelancer, Cogvana Cyber gives you the tools to earn more, do more, and empower your community.
          </p>
          <motion.button
            onClick={() => navigate('/signup')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-10 py-5 rounded-xl text-xl font-bold transition-all shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 inline-flex items-center gap-3"
          >
            Get Started Free Today
            <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
          </motion.button>
          <p className="text-gray-500 mt-6 text-sm">
            No credit card required • No verification fees • Start earning immediately
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative bg-black text-gray-500 text-sm py-8 text-center border-t border-gray-800 z-10">
        <p className="mb-4 text-gray-400">© 2025 Cogvana Cyber | Empowering Kenya's Digital Future</p>
        <div className="flex flex-wrap justify-center gap-6 mb-4">
          <a href="https://cogvana.co.ke/" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">
            Official Website
          </a>
          <a href="https://payments.cogvana.co.ke/contact" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">
            Contact Us
          </a>
          <a href="https://cogvana.co.ke/terms" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">
            Terms of Use
          </a>
        </div>
        <p className="text-xs text-gray-600 max-w-4xl mx-auto px-6">
          All operations conducted under the jurisdiction of your country's laws. Payments processed securely through Paystack. Transaction fees apply (1.5% - 3.9%). T+2 settlement rule applies to all payouts.
        </p>
      </footer>

      </div>
    </>
  );
}
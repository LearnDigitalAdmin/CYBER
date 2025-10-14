import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight } from 'lucide-react';

import { useNavigate } from 'react-router-dom';


export default function ExplorePage() {
    const navigate = useNavigate();
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white flex flex-col">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center py-24 px-6">
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-6xl font-bold mb-4 text-cyan-400"
        >
          Empowering Kenya's Digital Workforce
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="max-w-2xl text-gray-300 text-lg mb-6"
        >
          Cogvana Cyber transforms local cyber cafés and freelancers into fully powered digital service hubs. From file sharing, payments, to managing rent collections – we connect digital Kenya, one cyber at a time.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <button onClick = {() => navigate('/signup')} className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg text-lg font-semibold transition-colors flex items-center gap-2">
            Join Now <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section className="bg-gray-800 py-20 px-6">
        <h2 className="text-3xl font-semibold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[
            {
              title: '1. Register Your Cyber or Freelance Account',
              text: 'Sign up with your phone and email, pay a one-time verification fee via STK push, and access your dashboard instantly.'
            },
            {
              title: '2. Manage Clients and Payments',
              text: 'Add landlords, agents, or tenants. Use the built-in terminal to trigger instant STK pushes for rent, invoices, and services.'
            },
            {
              title: '3. Earn From Every Transaction',
              text: 'Earn small commissions and bonuses for every verified transaction, invoice update, or client renewal you process.'
            }
          ].map((step, i) => (
            <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-bold text-cyan-400 mb-3">{step.title}</h3>
              <p className="text-gray-300">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Earnings Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-cyan-900 via-gray-900 to-black">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-semibold mb-6">How You Earn</h2>
          <p className="text-gray-300 mb-10 max-w-3xl mx-auto">
            Cybers and freelancers earn in multiple ways — per tenant rent payment, landlord setup, and system renewals. Cogvana Cyber ensures secure, automated payouts via Paystack.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Tenant Rent Processing',
                amount: 'Up to KES 50 per transaction',
              },
              {
                title: 'Landlord / Agent Setup',
                amount: 'KES 100 – 500 per registration',
              },
              {
                title: 'Monthly Rewards',
                amount: 'Bonuses based on active clients and volume',
              }
            ].map((item, i) => (
              <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg p-6 text-left">
                <h3 className="text-xl font-bold text-cyan-400 mb-2">{item.title}</h3>
                <p className="text-gray-300">{item.amount}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-gray-800 py-20 px-6">
        <h2 className="text-3xl font-semibold text-center mb-12">Why Join Cogvana Cyber?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[
            'Automated STK payment collection',
            'Instant rent and subscription updates',
            'Simple file sharing tools for clients',
            'Offline-first data caching and analytics',
            'Real-time dashboards for income tracking',
            'Full integration with Plot Yangu PMS'
          ].map((benefit, i) => (
            <div key={i} className="flex items-start space-x-3">
              <CheckCircle className="text-cyan-500 mt-1 w-6 h-6 flex-shrink-0" />
              <p className="text-gray-300">{benefit}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 text-center bg-gradient-to-br from-gray-900 to-black">
        <h2 className="text-4xl font-semibold mb-6">Be Part of Kenya's Digital Future</h2>
        <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
          Whether you run a local cyber café or work as a freelancer, Cogvana Cyber gives you the tools to earn more, do more, and empower your community.
        </p>
        <button onClick = {() => navigate('/signup')} className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg text-lg font-semibold transition-colors flex items-center gap-2 mx-auto">
          Get Started <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* Footer */}
      <footer className="bg-black text-gray-500 text-sm py-6 text-center border-t border-gray-800">
        <p>© 2025 Cogvana Cyber | Empowering Kenya's Digital Future</p>
        <div className="mt-2 space-x-4">
          <a href="https://cogvana.co.ke/contact" className="hover:text-cyan-400 transition-colors">Contact Us</a>
          <a href="https://cogvana.co.ke/terms" className="hover:text-cyan-400 transition-colors">Terms of Use</a>
        </div>
      </footer>
    </div>
  );
}
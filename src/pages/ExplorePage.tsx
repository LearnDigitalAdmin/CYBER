import { motion } from 'framer-motion';
import {
  CheckCircle,
  ArrowRight,
  Shield,
  Zap,
  TrendingUp,
  Store,
  Wallet,
  Users,
  BarChart3,
  Lock,
  Calendar,
  AlertCircle,
  Briefcase,
  Building2,
  GraduationCap,
  UserCheck,
  Layers3,
  ClipboardCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';

export default function ExplorePage() {
  const navigate = useNavigate();

  const onboardingSteps = [
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Express Interest',
      desc: 'Register your interest as a freelancer, cyber operator, or independent service provider.'
    },
    {
      icon: <Calendar className="w-8 h-8" />,
      title: 'Attend Live Onboarding',
      desc: 'Join a scheduled live session so we can introduce the platform, standards, and operating model.'
    },
    {
      icon: <GraduationCap className="w-8 h-8" />,
      title: 'Training & Qualification',
      desc: 'Learn what the system does, what you can sell, who to target, and how to operate correctly.'
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Start Operating',
      desc: 'Once approved, access your dashboard and begin serving clients within the platform rules.'
    }
  ];

  const models = [
    {
      icon: <Store className="w-7 h-7" />,
      title: 'Kaduka Operator Model',
      desc: 'Use the platform to help shops manage operations, records, and digital workflows. Built for flexible field execution and independent client handling.',
      color: 'from-cyan-500 to-blue-500'
    },
    {
      icon: <Building2 className="w-7 h-7" />,
      title: 'Plot Yangu Assisted Model',
      desc: 'Handle property workflows through a more controlled model where quality assurance, trust, and compliance matter more.',
      color: 'from-blue-500 to-purple-500'
    },
    {
      icon: <Briefcase className="w-7 h-7" />,
      title: 'Freelancer Hustle Model',
      desc: 'For individuals looking for a serious digital hustle using the Cyber Platform to serve real clients.',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: <Users className="w-7 h-7" />,
      title: 'Cyber Café Growth Model',
      desc: 'Turn a cyber café into a digital operations hub offering shop management, support services, and property assistance.',
      color: 'from-pink-500 to-red-500'
    },
    {
      icon: <BarChart3 className="w-7 h-7" />,
      title: 'Operator Dashboard',
      desc: 'Track clients, activities, services, records, and operational performance from one place.',
      color: 'from-green-500 to-teal-500'
    },
    {
      icon: <Lock className="w-7 h-7" />,
      title: 'Controlled Access & Standards',
      desc: 'Operate within defined limits, standards, and platform controls so clients are treated correctly and the brand remains protected.',
      color: 'from-orange-500 to-yellow-500'
    }
  ];

  const benefits = [
    'Free registration with no activation fees',
    'No invite required to express interest',
    'Live onboarding helps filter for serious operators',
    'Built for freelancers, cyber cafés, and digital service providers',
    'Kaduka supports more decentralized field operations',
    'Plot Yangu can run under a more controlled service model',
    'Manage clients and workflows from one dashboard',
    'Clear operating limits reduce misuse and confusion',
    'Good fit for people looking for a real digital hustle',
    'Expandable into multiple service categories over time',
    'Brand standards and complaint handling remain centralized',
    'Strong foundation for pilot, iteration, and scale'
  ];

  const audience = [
    {
      icon: <Briefcase className="w-10 h-10 text-cyan-400" />,
      title: 'Freelancers',
      desc: 'People looking for a structured way to earn by serving shops, landlords, agents, and other clients using digital tools.'
    },
    {
      icon: <Store className="w-10 h-10 text-blue-400" />,
      title: 'Cyber Café Operators',
      desc: 'Cyber owners who want to expand beyond printing and browsing into higher-value recurring digital services.'
    },
    {
      icon: <UserCheck className="w-10 h-10 text-purple-400" />,
      title: 'Field Agents & Independent Operators',
      desc: 'Committed individuals who can find clients, onboard them properly, and deliver within platform standards.'
    }
  ];

  return (
    <>
      <SEO
        title="Explore Cogvana Cyber - Freelancer, Cyber & Business Operations Platform Kenya"
        description="Discover how Cogvana Cyber helps freelancers, cyber cafés, and independent operators manage shops through Kaduka and assist with property workflows through Plot Yangu. Free registration, live onboarding, and real digital hustle opportunities in Kenya."
        keywords="Cogvana Cyber Kenya, Kaduka Kenya, Plot Yangu Kenya, freelancer platform Kenya, cyber café business Kenya, digital hustle Kenya, shop management Kenya, property operations Kenya, freelance opportunities Kenya, cyber platform Kenya"
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
              <span className="text-cyan-400 font-semibold">🚀 100% Free Registration • No Activation Fees • No Invites Needed</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent"
          >
            Start a Real Digital Hustle
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="max-w-4xl text-gray-300 text-xl mb-8 leading-relaxed"
          >
            Cogvana Cyber is the gateway into a new operating model for Kenya’s digital workforce. Use one platform to support shops through Kaduka, assist property workflows through Plot Yangu, and build a serious service business as a freelancer, cyber operator, or independent field partner.
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
              Join Free Today
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

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-gray-400"
          >
            <span className="px-3 py-1 rounded-full bg-gray-800 border border-gray-700">Freelancers</span>
            <span className="px-3 py-1 rounded-full bg-gray-800 border border-gray-700">Cyber Cafés</span>
            <span className="px-3 py-1 rounded-full bg-gray-800 border border-gray-700">Kaduka Operators</span>
            <span className="px-3 py-1 rounded-full bg-gray-800 border border-gray-700">Plot Yangu Assisted Operations</span>
          </motion.div>
        </section>

        {/* Operating Model */}
        <section className="relative bg-gradient-to-b from-transparent to-gray-900/50 py-20 px-6 z-10">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                The New Operating Approach
              </h2>
              <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                We are not just building a software product. We are building an operating network where the Cyber Platform becomes the gateway to service delivery, training, and real digital work.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              <motion.article
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-gray-800 to-gray-900 border border-cyan-500/30 rounded-2xl p-6"
              >
                <Layers3 className="w-10 h-10 text-cyan-400 mb-4" />
                <h3 className="text-xl font-bold mb-3">Hybrid Model</h3>
                <p className="text-gray-400 leading-relaxed">
                  Some operations can be more decentralized for speed and scale, while others remain more controlled for quality assurance, trust, and compliance.
                </p>
              </motion.article>

              <motion.article
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-500/30 rounded-2xl p-6"
              >
                <Store className="w-10 h-10 text-purple-400 mb-4" />
                <h3 className="text-xl font-bold mb-3">Kaduka = More Decentralized</h3>
                <p className="text-gray-400 leading-relaxed">
                  Independent operators can use Kaduka to serve shops directly, as long as they operate correctly, stay within platform limits, and treat clients properly.
                </p>
              </motion.article>

              <motion.article
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-gray-800 to-gray-900 border border-yellow-500/30 rounded-2xl p-6"
              >
                <Building2 className="w-10 h-10 text-yellow-400 mb-4" />
                <h3 className="text-xl font-bold mb-3">Plot Yangu = More Controlled</h3>
                <p className="text-gray-400 leading-relaxed">
                  Property-related operations may require tighter standards, assisted workflows, and stronger quality control because trust, records, and financial workflows are more sensitive.
                </p>
              </motion.article>
            </div>
          </div>
        </section>

        {/* Onboarding */}
        <section className="relative py-20 px-6 z-10" aria-labelledby="onboarding-heading">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2
                id="onboarding-heading"
                className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent"
              >
                Live Onboarding First
              </h2>
              <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                We start with live onboarding instead of fully static self-serve training. That helps us identify serious people, protect standards, and build a stronger pilot from the beginning.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-4 gap-6">
              {onboardingSteps.map((step, i) => (
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
                  {i < onboardingSteps.length - 1 && (
                    <div
                      className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-cyan-500 to-transparent"
                      aria-hidden="true"
                    />
                  )}
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* Models */}
        <section className="relative py-20 px-6 z-10">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold mb-4">The Models Inside the Platform</h2>
              <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                One dashboard. Multiple service paths. Clear standards for how each model works.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {models.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ scale: 1.03 }}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 hover:border-gray-600 rounded-2xl p-6 transition-all"
                >
                  <div className={`bg-gradient-to-r ${feature.color} w-14 h-14 rounded-xl flex items-center justify-center mb-4 text-white`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Commitment / Training */}
        <section className="relative bg-gradient-to-br from-cyan-900/20 via-blue-900/20 to-purple-900/20 py-20 px-6 z-10">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <div className="inline-block px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-full mb-4">
                <span className="text-cyan-400 font-semibold">💎 Pilot-First Rollout</span>
              </div>
              <h2 className="text-4xl font-bold mb-4">Built for Serious Operators</h2>
              <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                This approach is designed for people who are ready to show up, learn, and operate properly. Live sessions help us filter for commitment before scaling.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-gray-800 to-gray-900 border border-cyan-500/30 rounded-2xl p-8"
              >
                <ClipboardCheck className="w-12 h-12 text-cyan-400 mb-4" />
                <h3 className="text-2xl font-bold mb-4">What Training Covers</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">What the system does</p>
                      <p className="text-gray-400 text-sm">Understand the platform’s current capabilities and limitations.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">What you can sell</p>
                      <p className="text-gray-400 text-sm">Know the actual services you can confidently offer clients.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">Who to target</p>
                      <p className="text-gray-400 text-sm">Learn the right client types for Kaduka, Plot Yangu, and Cyber services.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">How to operate properly</p>
                      <p className="text-gray-400 text-sm">Follow standards, boundaries, and client handling expectations.</p>
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
                <TrendingUp className="w-12 h-12 text-purple-400 mb-4" />
                <h3 className="text-2xl font-bold mb-4">Pilot Rollout Logic</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">Start small</p>
                      <p className="text-gray-400 text-sm">Bring in a manageable pilot group first.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">Observe commitment</p>
                      <p className="text-gray-400 text-sm">Attendance and participation matter from day one.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">Iterate quickly</p>
                      <p className="text-gray-400 text-sm">Refine training, scripts, and workflows based on real operator behavior.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-white">Scale after proof</p>
                      <p className="text-gray-400 text-sm">Only expand aggressively once the model works in practice.</p>
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
                  <h4 className="text-lg font-bold text-yellow-400 mb-2">Important: Access Is Guided, Not Wild</h4>
                  <p className="text-gray-300 leading-relaxed">
                    Operators are expected to work within platform standards. Client complaints, misuse, or service issues can be escalated centrally, while independent operators remain responsible for the satisfaction of the clients they serve.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Trust / Control */}
        <section className="relative py-20 px-6 z-10">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold mb-4">Trust, Control & Platform Safety</h2>
              <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                Growth matters, but trust matters more. The platform is designed so you can scale operators without losing control of standards and brand integrity.
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
                <h3 className="text-2xl font-bold mb-4">Centralized Protections</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                    <p className="text-gray-300">Live onboarding and qualification before wider rollout</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                    <p className="text-gray-300">Clear standards for service delivery and client handling</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                    <p className="text-gray-300">Complaint escalation and issue handling through official channels</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                    <p className="text-gray-300">Controlled platform permissions and operating boundaries</p>
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
                <h3 className="text-2xl font-bold mb-4">Operator Responsibility</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                    <p className="text-gray-300">Serve clients properly within the system’s intended use</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                    <p className="text-gray-300">Stay honest about what the platform can and cannot currently do</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                    <p className="text-gray-300">Find and manage your own clients where the model allows</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                    <p className="text-gray-300">Operate professionally so trust compounds over time</p>
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
              <h2 className="text-4xl font-bold mb-4">Why This Model Makes Sense</h2>
              <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                It is designed to help you scale without becoming reckless, and grow opportunity without losing discipline.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((benefit, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.04 }}
                  className="flex items-start gap-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 hover:border-cyan-500/50 rounded-xl p-4 transition-all"
                >
                  <CheckCircle className="text-cyan-400 mt-0.5 w-5 h-5 flex-shrink-0" />
                  <p className="text-gray-300 text-sm">{benefit}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Who It's For */}
        <section className="relative py-20 px-6 z-10">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold mb-4">Who This Is For</h2>
              <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                This is for people and businesses ready to build a practical digital service business, not just create another account and disappear.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {audience.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-8"
                >
                  <div className="mb-4">{item.icon}</div>
                  <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{item.desc}</p>
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
            <h2 className="text-3xl font-bold mb-4">Need Help or Want to Join the Pilot?</h2>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
              Reach out through our official channels to inquire about onboarding, support, or partnership opportunities.
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
              Build With the Cyber Platform
            </h2>
            <p className="text-gray-300 text-xl mb-10 max-w-3xl mx-auto leading-relaxed">
              Whether you are a freelancer looking for a hustle, a cyber café expanding its services, or an independent operator ready to serve clients professionally, this platform is built to help you start, learn, and grow.
            </p>
            <motion.button
              onClick={() => navigate('/signup')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-10 py-5 rounded-xl text-xl font-bold transition-all shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 inline-flex items-center gap-3"
            >
              Get Started Free
              <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </motion.button>
            <p className="text-gray-500 mt-6 text-sm">
              No registration fees • No activation fees • Live onboarding for serious operators
            </p>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="relative bg-black text-gray-500 text-sm py-8 text-center border-t border-gray-800 z-10">
          <p className="mb-4 text-gray-400">© 2025 Cogvana Cyber | Building Kenya&apos;s Digital Workforce</p>
          <div className="flex flex-wrap justify-center gap-6 mb-4">
            <a
              href="https://cogvana.co.ke/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 transition-colors"
            >
              Official Website
            </a>
            <a
              href="https://payments.cogvana.co.ke/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 transition-colors"
            >
              Contact Us
            </a>
            <a
              href="https://cogvana.co.ke/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 transition-colors"
            >
              Terms of Use
            </a>
          </div>
          <p className="text-xs text-gray-600 max-w-4xl mx-auto px-6 leading-relaxed">
            Platform access, features, and operating models may vary by service category. Some workflows are more decentralized, while others may require tighter review, approval, or quality control depending on risk, trust, and operational sensitivity.
          </p>
        </footer>
      </div>
    </>
  );
}
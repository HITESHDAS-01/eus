import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

// Content Dictionary for Language Toggle
const content = {
  as: {
    nav: { home: 'মুখ্যপৃষ্ঠা', plans: 'বিনিয়োগ আঁচনি', benefits: 'সুবিধাসমূহ', rules: 'নিয়মাৱলী', contact: 'যোগাযোগ' },
    hero: {
      title: 'সঞ্চয় আৰু বিনিয়োগৰ\nএক নতুন দিগন্ত',
      subtitle: 'আপোনাৰ সঞ্চয়ক নিৰ্ভৰযোগ্য গতি প্ৰদান',
      desc: '“একতা উন্নয়ন সংস্থা”ই সদস্যসকলৰ সামূহিক আৰ্থিক উন্নয়নৰ বাবে স্বচ্ছ আৰু লাভজনক বিনিয়োগ আঁচনি আগবঢ়াইছে। আমাৰ লগত সঞ্চয় কৰক, নিৰাপদ ভৱিষ্যৎ গঢ়ি তোলক।',
      quote: 'সঞ্চয় আমাৰ ভৱিষ্যৎ, একতা আমাৰ শক্তি',
      badge1: '৩৬% পৰ্যন্ত লাভ',
      badge2: '₹১০০ৰ পৰা আৰম্ভ',
      badge3: '৮০% ঋণ সুবিধা',
      cta: 'সদস্যভৰ্তিৰ বাবে যোগাযোগ কৰক'
    },
    plans: {
      title: 'আমাৰ বিনিয়োগ আঁচনিসমূহ',
      catB: {
        title: 'শ্ৰেণী B',
        badge: 'বিনিয়োগকাৰী (Investment Category)',
        highlight: '৩৬% লাভ (ROI)',
        term: '৩৬ মাহ',
        p3: 'প্ৰাৰম্ভিক বিনিয়োগ: নিম্নতম ₹১০,০০০/-',
        p4: 'মাহিলী কিস্তি: সংস্থাৰ নিয়ম অনুসৰি (যোগাযোগ কৰক)',
        p5: 'সামূহিক সঞ্চয় বৃদ্ধিৰ সুযোগ',
        note: 'মাহিলী কিস্তিৰ সম্পূৰ্ণ নিৰ্ধাৰণৰ বাবে সংস্থাৰ সৈতে পোনপটীয়াকৈ যোগাযোগ কৰক।'
      },
      catC: {
        title: 'শ্ৰেণী C',
        badge: 'ৰাজহুৱা সঞ্চয় আঁচনি (জনসাধাৰণ)',
        p1: 'কোনো প্ৰাৰম্ভিক বিনিয়োগ নাই',
        p2: 'কেৱল ₹১০০/- মাহিলী সঞ্চয়',
        opt1: '২৪ মাহৰ আঁচনি:',
        opt1Val: '১৬% লাভ',
        opt1Desc: '(ম্যাদ শেষত প্ৰদান)',
        opt2: '৩৬ মাহৰ আঁচনি:',
        opt2Val: '২৭% লাভ',
        opt2Desc: '(দীৰ্ঘম্যাদী সুবিধা)',
        f1: 'সৰু সঞ্চয়েৰে অংশগ্ৰহণ',
        f2: 'সামূহিক সুবিধা আৰু ঋণৰ যোগ্যতা',
        note: 'লাভ্যাংশ (ROI) সম্পূৰ্ণ ম্যাদৰ ভিত্তিত গণনা কৰা হয়।'
      }
    },
    benefits: {
      title: 'প্ৰতিষ্ঠানিক সুবিধাসমূহ',
      b1Title: 'আৰ্থিক সুৰক্ষা',
      b1Desc: "আপোনাৰ জমা ধনৰ ৮০% পৰ্যন্ত ঋণ ল'ব পৰাৰ সুবিধা (সঞ্চয়ৰ বিপৰীতে)।",
      b2Title: 'নূন্যতম সুদ',
      b2Desc: 'ঋণৰ ওপৰত অতি কম ২% মাহিলী সুদ (স্বচ্ছ আৰু সৰল গণনা)।',
      b3Title: 'পৰিচালনা',
      b3Desc: 'স্বচ্ছতা আৰু নিৰ্ভৰযোগ্যতা আমাৰ মূল মন্ত্ৰ। প্ৰতিটো লেনদেন সুসংহত আৰু জবাবদিহীমূলক।'
    },
    rules: {
      title: 'শৃংখলাবদ্ধ নিয়মাৱলী',
      r1Title: 'সময়সীমা:',
      r1: 'মাহিলী কিস্তি বা ঋণৰ সুদ জমা দিয়াৰ চূড়ান্ত সময় প্ৰতি মাহৰ ১০ তাৰিখ।',
      r2Title: 'জৰিমনা:',
      r2: 'নিৰ্ধাৰিত তাৰিখৰ পিছত জমা দিলে মুঠ বকেয়া ধনৰ ওপৰত ৫% জৰিমনা বিহা হ\'ব।',
      r3Title: 'ম্যাদৰ পূৰ্বে বিদায়:',
      r3: "ম্যাদ সম্পূৰ্ণ হোৱাৰ আগতে সদস্যপদ ত্যাগ কৰিলে কেৱল মূল ধন ওভতাই দিয়া হ'ব, কোনো লাভ প্ৰদান কৰা নহ'ব।",
      note: 'এই নিয়মসমূহ সংস্থাৰ স্থিৰতা আৰু সদস্যৰ স্বাৰ্থত বাধ্যতামূলক।'
    },
    promise: {
      title: 'আমাৰ প্ৰতিশ্ৰুতি',
      desc: 'আপোনাৰ সঞ্চয় সুরক্ষিত, লাভ ন্যায্য আৰু পৰিচালনা সম্পূৰ্ণ স্বচ্ছ। “একতা উন্নয়ন সংস্থা” আপোনাৰ আৰ্থিক অগ্ৰগতিৰ বিশ্বস্ত সংগী।',
      b1: 'নিৰাপদ জমা',
      b2: 'নিয়মিত লেনদেনৰ ৰেকৰ্ড',
      b3: 'সদস্য-কেন্দ্ৰিক দৃষ্টিভংগী'
    },
    contact: {
      title: 'সদস্যভৰ্তিৰ বাবে যোগাযোগ কৰক',
      subtitle: 'আমাৰ পৰিচালনা সমিতিয়ে আপোনাক স্বাগতম জনায়। অধিক তথ্যৰ বাবে তলৰ নম্বৰত যোগাযোগ কৰক।',
      roles: { pres: 'সভাপতি', sec: 'সম্পাদক', tres: 'কোষাধ্যক্ষ' },
      address: 'প্ৰতিষ্ঠানৰ ঠিকনা: কট্পুহা, নলবাৰী (অসম) – স্থাপিত: ২০২৬ চন',
      hours: 'কাৰ্যালয়ৰ সময়: সোমবাৰৰ পৰা শনিবাৰ, সকাল ১০:০০ AM - ৫:০০ PM',
    },
    footer: {
      tagline: '“সঞ্চয় আমাৰ ভৱিষ্যৎ, একতা আমাৰ শক্তি”',
      copyright: '© ২০২৬ একতা উন্নয়ন সংস্থা | স্বচ্ছতা, নিৰ্ভৰযোগ্যতা, অগ্ৰগতি',
      badge: 'এই সংস্থাটো আমাৰ তিনিজন সহ-প্ৰতিষ্ঠাপকৰ যৌথ উদ্যোগত গঢ় লৈ উঠিছে। আপোনাৰ সঞ্চয় সুৰক্ষিত ৰাখি সামূহিক উন্নয়ন আমাৰ মূল লক্ষ্য।',
      disclaimer: 'ঘোষণা: \'একতা উন্নয়ন সংস্থা\' কোনো বেংক বা RBI পঞ্জীভুক্ত বিত্তীয় প্ৰতিষ্ঠান নহয়। ই এক পাৰস্পৰিক উন্নয়নমূলক গোট (Mutual Benefit Group)। ইয়াত কৰা সকলো বিনিয়োগ আৰু ঋণ সংস্থাৰ আভ্যন্তৰীণ নিয়মাৱলীৰ অধীনত আৰু সদস্যৰ নিজা দায়িত্বত। পৰিচালনা সমিতিয়ে প্ৰয়োজনসাপেক্ষে নিয়ম সলনি কৰাৰ অধিকাৰ সংৰক্ষিত ৰাখে।'
    }
  },
  en: {
    nav: { home: 'Home', plans: 'Plans', benefits: 'Benefits', rules: 'Rules', contact: 'Contact' },
    hero: {
      title: 'A New Horizon for\nSavings & Investment',
      subtitle: 'Give your savings reliable momentum',
      desc: 'Ekata Unnayan Sanstha offers transparent and profitable investment plans for the collective financial development of its members. Save with us, build a secure future.',
      quote: 'Savings is our future, Unity is our strength',
      badge1: 'Up to 36% ROI',
      badge2: 'Starts from ₹100',
      badge3: '80% Loan Facility',
      cta: 'Contact to Register'
    },
    plans: {
      title: 'Our Investment Plans',
      catB: {
        title: 'Category B',
        badge: 'Investor Category',
        highlight: '36% Profit (ROI)',
        term: '36 Months',
        p3: 'Initial Investment: Min ₹10,000/-',
        p4: 'Monthly Installment: As per rules (Contact us)',
        p5: 'Opportunity for collective savings growth',
        note: 'Contact the organization directly for complete determination of monthly installments.'
      },
      catC: {
        title: 'Category C',
        badge: 'Public Savings Scheme',
        p1: 'No Initial Investment',
        p2: 'Only ₹100/- Monthly Savings',
        opt1: '24 Months Plan:',
        opt1Val: '16% Profit',
        opt1Desc: '(Paid at maturity)',
        opt2: '36 Months Plan:',
        opt2Val: '27% Profit',
        opt2Desc: '(Long-term benefit)',
        f1: 'Participate with small savings',
        f2: 'Collective benefits and loan eligibility',
        note: 'Dividends (ROI) are calculated based on the full term.'
      }
    },
    benefits: {
      title: 'Institutional Benefits',
      b1Title: 'Financial Security',
      b1Desc: 'Facility to take a loan up to 80% of your deposited amount (against savings).',
      b2Title: 'Minimal Interest',
      b2Desc: 'Very low 2% monthly interest on loans (transparent and simple calculation).',
      b3Title: 'Management',
      b3Desc: 'Transparency and reliability are our core mantras. Every transaction is organized and accountable.'
    },
    rules: {
      title: 'Disciplined Rules',
      r1Title: 'Deadline:',
      r1: 'Final time for submitting monthly installment or loan interest is the 10th of every month.',
      r2Title: 'Penalty:',
      r2: 'If submitted after the due date, a 5% penalty will be levied on the total due amount.',
      r3Title: 'Early Exit:',
      r3: 'If membership is resigned before the completion of the term, only the principal amount will be returned, no profit will be provided.',
      note: 'These rules are mandatory for the stability of the organization and the interest of the members.'
    },
    promise: {
      title: 'Our Promise',
      desc: 'Your savings are secure, profits are fair, and management is completely transparent. "Ekata Unnayan Sanstha" is your trusted companion for financial progress.',
      b1: 'Secure Deposit',
      b2: 'Regular Transaction Records',
      b3: 'Member-centric Approach'
    },
    contact: {
      title: 'Contact to Register',
      subtitle: 'Our management committee welcomes you. Contact the numbers below for more information.',
      roles: { pres: 'President', sec: 'Secretary', tres: 'Treasurer' },
      address: 'Office Address: Katpuha, Nalbari (Assam) – Est: 2026',
      hours: 'Office Hours: Monday to Saturday, 10:00 AM - 5:00 PM',
    },
    footer: {
      tagline: '"Savings is our future, Unity is our strength"',
      copyright: '© 2026 Ekata Unnayan Sanstha | Transparency, Reliability, Progress',
      badge: 'This organization has been built as a joint venture of our three co-founders. Keeping your savings secure and collective development is our main goal.',
      disclaimer: 'Disclaimer: \'Ekata Unnayan Sanstha\' is not a bank or RBI-registered financial institution. It is a mutual benefit group. All investments and loans are subject to internal rules and are at the member\'s own risk. The management committee reserves the right to modify rules as necessary.'
    }
  }
};

export function LandingPage({ onLoginClick }: { onLoginClick: () => void }) {
  const [lang, setLang] = useState<'as' | 'en'>('as');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const t = content[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem('eus_lang');
    if (savedLang === 'en' || savedLang === 'as') {
      setLang(savedLang);
    }
  }, []);

  const toggleLang = () => {
    const newLang = lang === 'as' ? 'en' : 'as';
    setLang(newLang);
    localStorage.setItem('eus_lang', newLang);
  };

  const scrollTo = (id: string) => {
    setIsMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  return (
    <div className="min-h-screen bg-[#fefef7] font-['Noto_Sans_Bengali',sans-serif] text-[#1e2a2e]">
      {/* 1. Header / Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 bg-gradient-to-br from-[#0b3b2f] to-[#1a5f4a] shadow-lg z-50 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo & Title */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
              <img src="https://i.ibb.co/xKRYj0f4/euslogo.png" alt="EUS Logo" className="w-[50px] h-[50px] object-contain bg-[#f7b05e] rounded-xl p-1" referrerPolicy="no-referrer" />
              <div className="text-white">
                <h1 className="font-bold text-[1.4rem] leading-tight">একতা উন্নয়ন সংস্থা</h1>
                <p className="text-xs opacity-90 font-medium tracking-wide">স্থাপিত: ২০২৬ | কট্পুহা, নলবাৰী (অসম)</p>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-6">
              <button onClick={() => window.scrollTo(0, 0)} className="text-white hover:text-[#ffe6b3] font-medium transition-colors border-b-2 border-transparent hover:border-[#f7b05e] pb-1 text-base">{t.nav.home}</button>
              <button onClick={() => scrollTo('plans')} className="text-white hover:text-[#ffe6b3] font-medium transition-colors border-b-2 border-transparent hover:border-[#f7b05e] pb-1 text-base">{t.nav.plans}</button>
              <button onClick={() => scrollTo('benefits')} className="text-white hover:text-[#ffe6b3] font-medium transition-colors border-b-2 border-transparent hover:border-[#f7b05e] pb-1 text-base">{t.nav.benefits}</button>
              <button onClick={() => scrollTo('rules')} className="text-white hover:text-[#ffe6b3] font-medium transition-colors border-b-2 border-transparent hover:border-[#f7b05e] pb-1 text-base">{t.nav.rules}</button>
              <button onClick={() => scrollTo('contact')} className="text-white hover:text-[#ffe6b3] font-medium transition-colors border-b-2 border-transparent hover:border-[#f7b05e] pb-1 text-base">{t.nav.contact}</button>
              
              <button onClick={toggleLang} className="flex items-center gap-1 text-sm font-bold text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors">
                <i className="fas fa-language"></i> {lang === 'as' ? 'EN' : 'অসমীয়া'}
              </button>
              
              <button onClick={onLoginClick} className="bg-transparent border-2 border-[#f7b05e] hover:bg-[#f7b05e] hover:text-[#0b3b2f] text-[#f7b05e] px-5 py-2 rounded-full font-bold transition-colors">
                Login
              </button>
            </nav>

            {/* Mobile Menu Button */}
            <div className="flex items-center gap-3 lg:hidden">
              <button onClick={toggleLang} className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-white font-bold text-sm">
                {lang === 'as' ? 'EN' : 'অস'}
              </button>
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-lg transition-colors text-xl"
                aria-label="Toggle Menu"
              >
                <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 w-full bg-[#0b3b2f] shadow-xl rounded-b-2xl overflow-hidden z-40">
            <div className="flex flex-col p-5 gap-4">
              <button onClick={() => { window.scrollTo(0, 0); setIsMobileMenuOpen(false); }} className="text-left text-lg font-medium text-white hover:text-[#f7b05e]">{t.nav.home}</button>
              <button onClick={() => scrollTo('plans')} className="text-left text-lg font-medium text-white hover:text-[#f7b05e]">{t.nav.plans}</button>
              <button onClick={() => scrollTo('benefits')} className="text-left text-lg font-medium text-white hover:text-[#f7b05e]">{t.nav.benefits}</button>
              <button onClick={() => scrollTo('rules')} className="text-left text-lg font-medium text-white hover:text-[#f7b05e]">{t.nav.rules}</button>
              <button onClick={() => scrollTo('contact')} className="text-left text-lg font-medium text-white hover:text-[#f7b05e]">{t.nav.contact}</button>
              <button onClick={() => { setIsMobileMenuOpen(false); onLoginClick(); }} className="text-center text-lg font-bold py-3 rounded-full bg-[#f7b05e] text-[#0b3b2f] mt-2">
                Member Login
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. Hero Section */}
      <section className="pt-32 pb-14 px-4 bg-gradient-to-br from-[#eef5f0] to-[#ffffff] border-b border-[#dce9e2]">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-8 lg:gap-12"
        >
          <div className="flex-1 text-center lg:text-left order-2 lg:order-1">
            <h2 className="text-[2.3rem] lg:text-5xl font-extrabold text-[#0b3b2f] leading-tight mb-4 whitespace-pre-line">
              {t.hero.title}
            </h2>
            
            <div className="text-[1.2rem] text-[#2c5a4a] mb-4 lg:border-l-4 lg:border-[#f7b05e] lg:pl-4 font-medium flex items-center justify-center lg:justify-start gap-2">
              <i className="fas fa-hand-holding-usd"></i> {t.hero.subtitle}
            </div>

            <p className="text-[#1e2a2e] text-base lg:text-lg leading-relaxed mb-4">
              {t.hero.desc}
            </p>

            <div className="inline-block bg-[#fff3e0] text-[#a55217] px-5 py-2 rounded-full font-semibold italic mb-6">
              <i className="fas fa-quote-left mr-2"></i> {t.hero.quote}
            </div>
            
            <div className="flex flex-wrap justify-center lg:justify-start gap-4 mb-6">
              <span className="bg-white px-4 py-2 rounded-full shadow-sm text-[#1e2a2e] flex items-center gap-2"><i className="fas fa-chart-line text-[#1a4d3c]"></i> {t.hero.badge1}</span>
              <span className="bg-white px-4 py-2 rounded-full shadow-sm text-[#1e2a2e] flex items-center gap-2"><i className="fas fa-rupee-sign text-[#1a4d3c]"></i> {t.hero.badge2}</span>
              <span className="bg-white px-4 py-2 rounded-full shadow-sm text-[#1e2a2e] flex items-center gap-2"><i className="fas fa-shield-alt text-[#1a4d3c]"></i> {t.hero.badge3}</span>
            </div>

            <button onClick={() => scrollTo('contact')} className="inline-block bg-[#f7b05e] hover:bg-[#e09d3e] text-[#0b3b2f] text-base font-bold py-3 px-6 rounded-full transition-all transform hover:-translate-y-1 shadow-md hover:shadow-lg">
              <i className="fas fa-phone-alt mr-2"></i> {t.hero.cta}
            </button>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex-1 flex justify-center order-1 lg:order-2 w-full"
          >
            <img src="https://i.ibb.co/xKRYj0f4/euslogo.png" alt="EUS Logo Large" className="max-w-full max-h-[280px] lg:max-h-[350px] rounded-[20px] shadow-[0_8px_20px_rgba(0,0,0,0.1)] object-contain" referrerPolicy="no-referrer" />
          </motion.div>
        </motion.div>
      </section>

      {/* 3. Investment Plans Section */}
      <section id="plans" className="py-16 px-4 bg-[#fefef7]">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-6xl mx-auto"
        >
          <div className="text-center mb-10 relative">
            <h2 className="text-[2rem] font-bold text-[#1a4d3c] mb-2">{t.plans.title}</h2>
            <div className="w-[70px] h-1 bg-[#f7b05e] mx-auto rounded-full mt-2"></div>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            {/* Category B Card */}
            <motion.div variants={fadeInUp} className="bg-white rounded-[28px] shadow-[0_12px_28px_rgba(0,0,0,0.08)] overflow-hidden flex-1 min-w-[280px] max-w-lg transition-transform hover:-translate-y-1">
              <div className="bg-[#1e5a48] text-white p-6 text-center">
                <h3 className="text-[1.8rem] font-bold">{t.plans.catB.title}</h3>
                <p>{t.plans.catB.badge}</p>
              </div>
              <div className="p-7">
                <div className="bg-[#fef1e0] text-[#b9530e] font-extrabold py-1.5 px-4 rounded-full inline-block mb-4 text-[1.1rem]">
                  <i className="fas fa-percent"></i> {t.plans.catB.highlight}
                </div>
                <p className="mb-4"><strong><i className="fas fa-calendar-alt text-[#1a4d3c]"></i> {lang === 'as' ? 'ম্যাদ:' : 'Term:'}</strong> {t.plans.catB.term}</p>
                
                <ul className="list-none space-y-3 mb-6">
                  <li className="flex items-start gap-2"><i className="fas fa-rupee-sign text-[#1a4d3c] mt-1"></i> <span>{t.plans.catB.p3.split('₹')[0]}<span className="text-[#d45c1a] font-bold">₹{t.plans.catB.p3.split('₹')[1]}</span></span></li>
                  <li className="flex items-start gap-2"><i className="fas fa-calendar-week text-[#1a4d3c] mt-1"></i> <span>{t.plans.catB.p4}</span></li>
                  <li className="flex items-start gap-2"><i className="fas fa-chart-simple text-[#1a4d3c] mt-1"></i> <span>{t.plans.catB.p5}</span></li>
                </ul>
                <div className="bg-[#fff3db] p-3 rounded-2xl text-sm text-center">
                  <i className="fas fa-info-circle text-[#d45c1a]"></i> {t.plans.catB.note}
                </div>
              </div>
            </motion.div>

            {/* Category C Card */}
            <motion.div variants={fadeInUp} className="bg-white rounded-[28px] shadow-[0_12px_28px_rgba(0,0,0,0.08)] overflow-hidden flex-1 min-w-[280px] max-w-lg transition-transform hover:-translate-y-1">
              <div className="bg-[#2a6b55] text-white p-6 text-center">
                <h3 className="text-[1.8rem] font-bold">{t.plans.catC.title}</h3>
                <p>{t.plans.catC.badge}</p>
              </div>
              <div className="p-7">
                <p className="mb-4"><i className="fas fa-check-circle text-[#1e5a48]"></i> <strong>{t.plans.catC.p1}</strong><br/> {t.plans.catC.p2.split('₹')[0]}<span className="text-[#d45c1a] font-bold">₹{t.plans.catC.p2.split('₹')[1]}</span></p>
                
                <div className="bg-[#f9f3e9] rounded-[20px] p-3 mt-4 border-l-4 border-[#f7b05e]">
                  <i className="fas fa-clock text-[#1a4d3c]"></i> <strong>{t.plans.catC.opt1}</strong> <span className="text-[#d45c1a] font-bold">{t.plans.catC.opt1Val}</span> {t.plans.catC.opt1Desc}
                </div>
                <div className="bg-[#f9f3e9] rounded-[20px] p-3 mt-3 border-l-4 border-[#f7b05e]">
                  <i className="fas fa-hourglass-half text-[#1a4d3c]"></i> <strong>{t.plans.catC.opt2}</strong> <span className="text-[#d45c1a] font-bold">{t.plans.catC.opt2Val}</span> {t.plans.catC.opt2Desc}
                </div>

                <ul className="list-none space-y-3 mt-4">
                  <li className="flex items-start gap-2"><i className="fas fa-users text-[#1a4d3c] mt-1"></i> <span>{t.plans.catC.f1}</span></li>
                  <li className="flex items-start gap-2"><i className="fas fa-hand-holding-heart text-[#1a4d3c] mt-1"></i> <span>{t.plans.catC.f2}</span></li>
                </ul>
              </div>
            </motion.div>
          </div>
          
          <div className="text-center mt-8">
            <p className="bg-[#f3f1e7] inline-block px-6 py-2 rounded-full">
              <i className="fas fa-shield-heart text-[#1a4d3c]"></i> {t.plans.catC.note}
            </p>
          </div>
        </motion.div>
      </section>

      {/* 4. Benefits & Rules Section */}
      <section id="benefits" className="py-16 px-4 bg-[#fafaf5]">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-6xl mx-auto"
        >
          <div className="text-center mb-10 relative">
            <h2 className="text-[2rem] font-bold text-[#1a4d3c] mb-2">{t.benefits.title}</h2>
            <div className="w-[70px] h-1 bg-[#f7b05e] mx-auto rounded-full mt-2"></div>
          </div>

          <div className="flex flex-wrap gap-8">
            {/* Benefits Box */}
            <motion.div variants={fadeInUp} className="bg-white rounded-[28px] p-8 flex-1 shadow-[0_6px_14px_rgba(0,0,0,0.05)] border border-[#e2e8e4] min-w-[300px]">
              <h3 className="text-[1.6rem] text-[#1a4d3c] mb-4 flex items-center gap-3"><i className="fas fa-building-columns"></i> {t.benefits.b1Title}</h3>
              <p className="mb-6"><i className="fas fa-percent text-[#1a4d3c]"></i> {t.benefits.b1Desc}</p>
              
              <h3 className="text-[1.6rem] text-[#1a4d3c] mb-4 flex items-center gap-3"><i className="fas fa-coins"></i> {t.benefits.b2Title}</h3>
              <p className="mb-6">{t.benefits.b2Desc}</p>
              
              <h3 className="text-[1.6rem] text-[#1a4d3c] mb-4 flex items-center gap-3"><i className="fas fa-eye"></i> {t.benefits.b3Title}</h3>
              <p>{t.benefits.b3Desc}</p>
            </motion.div>

            {/* Rules Box */}
            <motion.div variants={fadeInUp} id="rules" className="bg-white rounded-[28px] p-8 flex-1 shadow-[0_6px_14px_rgba(0,0,0,0.05)] border border-[#e2e8e4] min-w-[300px]">
              <h3 className="text-[1.6rem] text-[#1a4d3c] mb-6 flex items-center gap-3"><i className="fas fa-scale-balanced"></i> {t.rules.title}</h3>
              
              <div className="mb-5 border-b border-dashed border-[#ddd] pb-3">
                <strong><i className="far fa-calendar-check text-[#1a4d3c]"></i> {t.rules.r1Title}</strong> {t.rules.r1}
              </div>
              <div className="mb-5 border-b border-dashed border-[#ddd] pb-3">
                <strong><i className="fas fa-exclamation-triangle text-[#1a4d3c]"></i> {t.rules.r2Title}</strong> {t.rules.r2}
              </div>
              <div className="mb-5 border-b border-dashed border-[#ddd] pb-3">
                <strong><i className="fas fa-sign-out-alt text-[#1a4d3c]"></i> {t.rules.r3Title}</strong> {t.rules.r3}
              </div>
              
              <p className="bg-[#fff3db] p-3 rounded-2xl text-center mt-4 text-sm"><i className="fas fa-gavel text-[#d45c1a]"></i> {t.rules.note}</p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Promise Section */}
      <section className="py-16 px-4 bg-[#fefef7]">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-[#eaf7f0] to-[#ffffff] rounded-[40px] p-8 md:p-12 text-center shadow-sm border border-[#e2e8e4]">
            <i className="fas fa-handshake text-[3rem] text-[#1e5a48] mb-4"></i>
            <h3 className="text-[1.8rem] font-bold text-[#1a4d3c] mb-4">{t.promise.title}</h3>
            <p className="max-w-2xl mx-auto text-[#1e2a2e] mb-8">{t.promise.desc}</p>
            <div className="flex justify-center gap-6 md:gap-12 flex-wrap">
              <div className="font-bold text-[#1a4d3c]"><i className="fas fa-lock mr-2"></i> {t.promise.b1}</div>
              <div className="font-bold text-[#1a4d3c]"><i className="fas fa-file-invoice mr-2"></i> {t.promise.b2}</div>
              <div className="font-bold text-[#1a4d3c]"><i className="fas fa-users mr-2"></i> {t.promise.b3}</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Contact Section */}
      <section id="contact" className="py-16 px-4 bg-[#fafaf5]">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-6xl mx-auto"
        >
          <div className="text-center mb-10 relative">
            <h2 className="text-[2rem] font-bold text-[#1a4d3c] mb-2">{t.contact.title}</h2>
            <div className="w-[70px] h-1 bg-[#f7b05e] mx-auto rounded-full mt-2 mb-4"></div>
            <p className="text-[#1e2a2e]">{t.contact.subtitle}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 mt-6">
            {/* President */}
            <motion.div variants={fadeInUp} className="bg-white rounded-[24px] p-6 text-center w-[220px] shadow-[0_10px_20px_rgba(0,0,0,0.05)] transition-transform hover:-translate-y-1">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-4 border-[#eef5f0] bg-gray-100 flex items-center justify-center">
                <img src="https://ui-avatars.com/api/?name=Gautam+Rajbongshi&background=eef5f0&color=1e5a48&size=150" alt="President" className="w-full h-full object-cover" />
              </div>
              <h4 className="font-bold text-[#1e2a2e] mb-1">{t.contact.roles.pres}</h4>
              <p className="mb-2">গৌতম ৰাজবংশী</p>
              <a href="tel:8638074383" className="font-bold text-[#0b3b2f] text-[1.1rem] inline-block no-underline">
                <i className="fas fa-phone-alt text-[#1a4d3c]"></i> ৮৬৩৮০ ৭৪৩৮৩
              </a>
            </motion.div>

            {/* Secretary */}
            <motion.div variants={fadeInUp} className="bg-white rounded-[24px] p-6 text-center w-[220px] shadow-[0_10px_20px_rgba(0,0,0,0.05)] transition-transform hover:-translate-y-1">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-4 border-[#eef5f0] bg-gray-100 flex items-center justify-center">
                <img src="https://ui-avatars.com/api/?name=Pranjit+Das&background=eef5f0&color=1e5a48&size=150" alt="Secretary" className="w-full h-full object-cover" />
              </div>
              <h4 className="font-bold text-[#1e2a2e] mb-1">{t.contact.roles.sec}</h4>
              <p className="mb-2">প্ৰাণজিত দাস</p>
              <a href="tel:7002295480" className="font-bold text-[#0b3b2f] text-[1.1rem] inline-block no-underline">
                <i className="fas fa-phone-alt text-[#1a4d3c]"></i> ৭০০২২ ৯৫৪৮০
              </a>
            </motion.div>

            {/* Treasurer */}
            <motion.div variants={fadeInUp} className="bg-white rounded-[24px] p-6 text-center w-[220px] shadow-[0_10px_20px_rgba(0,0,0,0.05)] transition-transform hover:-translate-y-1">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-4 border-[#eef5f0] bg-gray-100 flex items-center justify-center">
                <img src="https://ui-avatars.com/api/?name=Ujjal+Talukdar&background=eef5f0&color=1e5a48&size=150" alt="Treasurer" className="w-full h-full object-cover" />
              </div>
              <h4 className="font-bold text-[#1e2a2e] mb-1">{t.contact.roles.tres}</h4>
              <p className="mb-2">উজ্জ্বল তালুকদাৰ</p>
              <a href="tel:7002241938" className="font-bold text-[#0b3b2f] text-[1.1rem] inline-block no-underline">
                <i className="fas fa-phone-alt text-[#1a4d3c]"></i> ৭০০২২ ৪১৯৩৮
              </a>
            </motion.div>
          </div>

          {/* Office Info */}
          <motion.div variants={fadeInUp} className="bg-[#fff3df] rounded-[32px] mt-10 p-5 text-center max-w-3xl mx-auto">
            <p className="mb-1"><i className="fas fa-map-marker-alt text-[#1a4d3c]"></i> <strong>{t.contact.address.split(':')[0]}:</strong> {t.contact.address.split(':')[1]}</p>
            <small className="text-sm"><i className="far fa-clock text-[#1a4d3c]"></i> {t.contact.hours}</small>
          </motion.div>
        </motion.div>
      </section>

      {/* 7. Footer */}
      <footer className="bg-[#0e2e24] text-[#cdede2] py-8 text-center mt-4">
        <div className="max-w-5xl mx-auto px-4">
          <p className="mb-6 font-medium text-lg"><i className="fas fa-hand-holding-heart"></i> {content.as.footer.tagline}</p>
          
          <div className="bg-[#0b3b2f] p-4 rounded-xl mb-6 text-xs text-left md:text-center text-[#9ca3af] border border-[#1a5f4a]">
            <p><i className="fas fa-info-circle mr-1"></i> {content.as.footer.disclaimer}</p>
          </div>

          <p className="mb-2 text-sm">{content.as.footer.copyright}</p>
          <p className="text-xs opacity-80 mt-2">{content.as.footer.badge}</p>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect } from 'react';

export const translations = {
  en: {
    sidebar: {
      title: 'Member Portal',
      passbook: 'Passbook',
      history: 'History',
      loans: 'Loans',
      backToSite: 'Back to Site',
      logout: 'Logout',
    },
    header: {
      orgName: 'Ekata Unnayan Sanstha',
      category: 'Category',
      profile: {
        title: 'Member Profile',
        memberCode: 'Member Code',
        phone: 'Phone Number',
        joinDate: 'Join Date',
        status: 'Status',
        close: 'Close',
        category: 'Category',
        savingAmt: 'Monthly Saving'
      }
    },
    home: {
      welcome: 'Welcome',
      passbookOverview: 'My Passbook Overview',
      totalSavings: 'Total Savings',
      loanEligibility: 'Loan Eligibility',
      activeLoanBalance: 'Active Loan Balance',
      maturitySummary: 'Maturity Summary',
      monthsTerm: 'Months Term',
      roi: 'ROI',
      maturityDate: 'Maturity Date',
      projectedMaturityAmount: 'Projected Maturity Amount',
      timeRemaining: 'Time Remaining',
      months: 'months',
      earlyWithdrawalWarning: 'Early withdrawal forfeits profit. Only principal will be returned.',
      maturedMessage: '🎉 Your savings have matured! Contact admin to withdraw with profit.',
      recentTransactions: 'Recent Transactions',
      viewAll: 'View All',
      date: 'Date',
      receiptNo: 'Receipt No.',
      type: 'Type',
      amount: 'Amount',
      installment: 'Installment',
      noRecentTx: 'No recent transactions.',
      loading: 'Loading your passbook...',
      notFound: 'Member data not found. Please verify your Member ID.',
    },
    history: {
      title: 'Transaction History',
      allInstallments: 'All Installments',
      paymentDate: 'Payment Date',
      monthYear: 'Month/Year',
      receiptNo: 'Receipt No.',
      principal: 'Principal',
      penalty: 'Penalty',
      totalPaid: 'Total Paid',
      noTx: 'No transactions found.',
    },
    loans: {
      title: 'My Loans',
      noLoansTitle: 'No Active Loans Found',
      noLoansDesc: 'You currently do not have any active loan accounts. Detailed summary and repayment histories will appear here once a loan is sanctioned.',
      principalAmt: 'Principal Amount',
      remainingBalance: 'Remaining Balance',
      interestRate: 'Interest Rate',
      flat: 'flat',
      status: 'Status',
      repaymentHistory: 'Repayment History',
      paymentDate: 'Payment Date',
      receiptNo: 'Receipt No.',
      principalPaid: 'Principal Paid',
      interestPaid: 'Interest Paid',
      totalAmount: 'Total Amount',
      noRepayments: 'No repayments have been made yet.'
    }
  },
  as: {
    sidebar: {
      title: 'সদস্যৰ প\'ৰ্টেল',
      passbook: 'পাছবুক',
      history: 'লেনদেনৰ বিৱৰণ',
      loans: 'মোৰ ঋণ',
      backToSite: 'মুখ্যপৃষ্ঠালৈ উভতি যাওক',
      logout: 'লগআউট',
    },
    header: {
      orgName: 'একতা উন্নয়ন সংস্থা',
      category: 'শ্ৰেণী',
      profile: {
        title: 'সদস্যৰ প্ৰফাইল',
        memberCode: 'সদস্য ID',
        phone: 'ফোন নম্বৰ',
        joinDate: 'যোগদানৰ তাৰিখ',
        status: 'অৱস্থা',
        close: 'বন্ধ কৰক',
        category: 'শ্ৰেণী',
        savingAmt: 'মাহিলী সঞ্চয়'
      }
    },
    home: {
      welcome: 'স্বাগতম',
      passbookOverview: 'মোৰ পাছবুকৰ অৱলোকন',
      totalSavings: 'মুঠ সঞ্চয়',
      loanEligibility: 'ঋণ যোগ্যতা',
      activeLoanBalance: 'বৰ্তমানৰ ঋণৰ ধনৰাশি',
      maturitySummary: 'ম্যাদ অন্তৰ বিৱৰণ',
      monthsTerm: 'মাহৰ ম্যাদ',
      roi: 'লাভ (ROI)',
      maturityDate: 'ম্যাদ অন্তৰ তাৰিখ',
      projectedMaturityAmount: 'সম্ভাৱ্য লাভ্যাংশসহ ধন',
      timeRemaining: 'বাকী থকা সময়',
      months: 'মাহ',
      earlyWithdrawalWarning: 'আগতীয়া উলিওৱাত লাভ্যাংশ পোৱা নাযায়। কেৱল মূলধনহে ঘুৰাই দিয়া হ\'ব।',
      maturedMessage: '🎉 আপোনাৰ সঞ্চয়ৰ ম্যাদ পূৰ্ণ হ\'ল! লাভ্যাংশসহ উলিয়াবলৈ কৰ্তৃপক্ষৰ সৈতে যোগাযোগ কৰক।',
      recentTransactions: 'শেহতীয়া লেনদেন',
      viewAll: 'সকলো চাওক',
      date: 'তাৰিখ',
      receiptNo: 'ৰছিদ নং',
      type: 'প্ৰকাৰ',
      amount: 'ধনৰাশি',
      installment: 'কিস্তি',
      noRecentTx: 'কোনো শেহতীয়া লেনদেন পোৱা নগ\'ল।',
      loading: 'আপোনাৰ পাছবুক লোড হৈ আছে...',
      notFound: 'সদস্যৰ তথ্য পোৱা নগ\'ল। আপোনাৰ সদস্য ID পৰীক্ষা কৰক।',
    },
    history: {
      title: 'লেনদেনৰ বিৱৰণ',
      allInstallments: 'সকলো কিস্তি',
      paymentDate: 'প্ৰদানৰ তাৰিখ',
      monthYear: 'মাহ/বছৰ',
      receiptNo: 'ৰছিদ নং',
      principal: 'মূলধন',
      penalty: 'জৰিমনা',
      totalPaid: 'মুঠ প্ৰদান',
      noTx: 'কোনো লেনদেন পোৱা নগ\'ল।',
    },
    loans: {
      title: 'মোৰ ঋণ',
      noLoansTitle: 'কোনো সক্ৰিয় ঋণ পোৱা নগল',
      noLoansDesc: 'আপোনাৰ বৰ্তমান কোনো সক্ৰিয় ঋণ একাউণ্ট নাই। ঋণ মঞ্জুৰ হোৱাৰ পাছত বিতং বিৱৰণ আৰু পৰিশোধৰ ইতিহাস ইয়াত প্ৰদৰ্শিত হ\'ব।',
      principalAmt: 'মূল ধনৰাশি',
      remainingBalance: 'বাকী থকা ধন',
      interestRate: 'সুদৰ হাৰ',
      flat: 'সমান',
      status: 'অৱস্থা',
      repaymentHistory: 'পৰিশোধৰ ইতিহাস',
      paymentDate: 'পৰিশোধৰ তাৰিখ',
      receiptNo: 'ৰছিদ নং',
      principalPaid: 'মূলধন পৰিশোধ',
      interestPaid: 'সুদ পৰিশোধ',
      totalAmount: 'মুঠ ধনৰাশি',
      noRepayments: 'এতিয়ালৈকে কোনো পৰিশোধ কৰা হোৱা নাই।'
    }
  }
};

export function useLanguage() {
  const [lang, setLang] = useState<'as' | 'en'>('as');
  useEffect(() => {
    const handleStorageChange = () => {
      const currentLang = localStorage.getItem('eus_lang');
      if (currentLang === 'en' || currentLang === 'as') {
        setLang(currentLang);
      }
    };
    handleStorageChange();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  return lang;
}

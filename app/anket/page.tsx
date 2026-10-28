"use client";
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import SurveyWidget from '../components/SurveyWidget';

export default function AnketPage() {
  return (
    <main className="min-h-screen bg-[#020617] text-white p-6 md:p-12 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-xl mx-auto relative z-10 space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-3 text-slate-400 hover:text-white transition-all group"
        >
          <div className="bg-white/5 p-2 rounded-lg group-hover:bg-purple-600 transition-colors">
            <ArrowLeft size={18} />
          </div>
          <span className="uppercase text-[10px] font-black tracking-[0.3em]">Ana Menüye Dön</span>
        </Link>

        <SurveyWidget />
      </div>
    </main>
  );
}

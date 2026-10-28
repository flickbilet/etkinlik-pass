"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Loader2, Vote, Trophy, Clock, PlayCircle, CheckCircle2, 
  Sparkles, RefreshCcw, BarChart3 
} from 'lucide-react';
import { formatEventDateDisplay, isEventPast } from '@/lib/dateUtils';

export default function SurveyWidget({ onSurveyLoaded }: { onSurveyLoaded?: (hasActive: boolean, title?: string) => void }) {
  const [survey, setSurvey] = useState<any>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);

  const fetchSurveyData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (surveyError) throw surveyError;

      if (surveyData) {
        setSurvey(surveyData);
        onSurveyLoaded?.(true, surveyData.title);

        const localVoteKey = `flick_survey_voted_${surveyData.id}`;
        const versionKey = `flick_survey_v_check_${surveyData.id}`;
        const savedVersion = localStorage.getItem(versionKey);

        if (surveyData.version && (!savedVersion || parseInt(savedVersion) < surveyData.version)) {
          localStorage.removeItem(localVoteKey);
          localStorage.setItem(versionKey, surveyData.version.toString());
          setVotedOptionId(null);
        } else {
          const savedVote = localStorage.getItem(localVoteKey);
          if (savedVote) setVotedOptionId(savedVote);
        }

        const { data: optionsData, error: optionsError } = await supabase
          .from('survey_options')
          .select('*')
          .eq('survey_id', surveyData.id)
          .order('created_at', { ascending: true });

        if (optionsError) throw optionsError;

        if (optionsData) {
          setOptions(optionsData);
          const votes = optionsData.reduce((sum: number, opt: any) => sum + (opt.votes || 0), 0);
          setTotalVotes(votes);
        }
      } else {
        setSurvey(null);
        setOptions([]);
        onSurveyLoaded?.(false);
      }
    } catch (error) {
      console.error("Anket verisi çekme hatası:", error);
    } finally {
      setLoading(false);
    }
  }, [onSurveyLoaded]);

  useEffect(() => {
    fetchSurveyData();
  }, [fetchSurveyData]);

  const isDeadlinePassed = survey?.deadline ? isEventPast(survey.deadline) : false;

  const handleVoteOrChange = async (targetOptionId: string) => {
    if (!survey || isDeadlinePassed || votingId) return;
    if (votedOptionId === targetOptionId) return; // Zaten aynı şık seçili

    setVotingId(targetOptionId);
    try {
      // Eğer daha önce başka bir şıkka oy verdiyse eski şıkkın oyunu 1 azalt
      if (votedOptionId) {
        const { data: prevOpt } = await supabase
          .from('survey_options')
          .select('votes')
          .eq('id', votedOptionId)
          .maybeSingle();

        if (prevOpt) {
          const nextPrevVotes = Math.max(0, (prevOpt.votes || 1) - 1);
          await supabase
            .from('survey_options')
            .update({ votes: nextPrevVotes })
            .eq('id', votedOptionId);
        }
      }

      // Yeni seçilen şıkkın güncel oyunu 1 artır
      const { data: latestOpt } = await supabase
        .from('survey_options')
        .select('votes')
        .eq('id', targetOptionId)
        .maybeSingle();

      const baseVotes = latestOpt ? (latestOpt.votes || 0) : 0;

      const { error } = await supabase
        .from('survey_options')
        .update({ votes: baseVotes + 1 })
        .eq('id', targetOptionId);

      if (!error) {
        localStorage.setItem(`flick_survey_voted_${survey.id}`, targetOptionId);
        setVotedOptionId(targetOptionId);
        await fetchSurveyData();
      }
    } catch (error) {
      console.error("Oy verme hatası:", error);
    } finally {
      setVotingId(null);
    }
  };

  const getImageUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('blob:')) return path;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const bucketName = 'survey-images';
    const cleanPath = path.replace(/^\/+/, '');
    return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${cleanPath}`;
  };

  if (loading && !survey) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="bg-slate-900/40 border border-dashed border-white/10 rounded-[2rem] p-10 text-center space-y-3">
        <Vote className="mx-auto text-slate-600" size={40} />
        <h4 className="text-sm font-black uppercase tracking-wider text-slate-300">
          Şu Anda Aktif Anket Bulunmuyor
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
          Sıradaki etkinliğimizi belirlemek için yeni oylama başladığında buradan oy kullanabilirsin!
        </p>
      </div>
    );
  }

  const maxVotes = options.length > 0 ? Math.max(...options.map((o) => o.votes || 0)) : 0;
  const showResults = !!votedOptionId || isDeadlinePassed;

  return (
    <div className="view-transition space-y-5">
      {/* Üst Anket Başlık ve Durum Bilgisi */}
      <div className="bg-gradient-to-br from-purple-600/15 via-slate-900/80 to-slate-900/60 border border-purple-500/30 rounded-[2rem] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full">
            <Sparkles size={11} /> SEN SEÇ OYLAMASI
          </span>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-300 bg-slate-950/70 border border-white/10 px-2.5 py-1 rounded-full">
              <BarChart3 size={11} className="text-purple-400" /> {totalVotes} Oy
            </span>
          </div>
        </div>

        <h3 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase leading-snug">
          {survey.title}
        </h3>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-slate-400">
          {survey.deadline ? (
            <span className={`inline-flex items-center gap-1.5 ${isDeadlinePassed ? 'text-rose-400' : 'text-purple-300'}`}>
              <Clock size={12} />
              {isDeadlinePassed
                ? `Oylama Sona Erdi (${formatEventDateDisplay(survey.deadline)})`
                : `Son Oy: ${formatEventDateDisplay(survey.deadline)}`}
            </span>
          ) : (
            <span>Oyunla sıradaki etkinliği belirle!</span>
          )}

          {votedOptionId && !isDeadlinePassed && (
            <span className="text-[9px] font-black uppercase text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={11} /> Oyun Kaydedildi (Değiştirmek için başka şıkka tıkla)
            </span>
          )}
        </div>
      </div>

      {/* Şıklar Listesi */}
      <div className="grid grid-cols-1 gap-3.5">
        {options.map((option) => {
          const isSelected = votedOptionId === option.id;
          const isWinner = showResults && maxVotes > 0 && option.votes === maxVotes;
          const percentage = totalVotes > 0 ? Math.round(((option.votes || 0) / totalVotes) * 100) : 0;
          const isBeingVoted = votingId === option.id;

          return (
            <div
              key={option.id}
              onClick={() => handleVoteOrChange(option.id)}
              className={`relative overflow-hidden rounded-[2rem] border transition-all duration-300 ${
                isDeadlinePassed ? 'cursor-default' : 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]'
              } ${
                isSelected
                  ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_25px_rgba(168,85,247,0.2)]'
                  : isWinner && isDeadlinePassed
                  ? 'border-emerald-500/60 bg-emerald-500/10'
                  : 'border-white/10 bg-slate-900/60 hover:border-purple-500/40'
              }`}
            >
              {option.image_url && (
                <div className="relative h-36 w-full overflow-hidden bg-slate-950">
                  <img
                    src={getImageUrl(option.image_url)}
                    alt={option.option_text}
                    className="w-full h-full object-cover opacity-75"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://placehold.co/600x400/0f172a/3b82f6?text=Gorsel+Yok";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/60 to-transparent" />

                  {/* Seçili veya Lider Rozeti */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {isSelected && (
                      <span className="bg-purple-600 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg">
                        <CheckCircle2 size={10} /> Senin Seçimin
                      </span>
                    )}
                    {isWinner && (
                      <span className="bg-amber-500 text-slate-950 text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg">
                        <Trophy size={10} /> Lider
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className={`p-5 relative z-10 space-y-2.5 ${option.image_url ? '-mt-10' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                        {option.option_text}
                      </h4>
                      {!option.image_url && isSelected && (
                        <span className="bg-purple-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full">
                          Senin Seçimin
                        </span>
                      )}
                    </div>

                    {option.description && (
                      <p className="text-[11px] font-bold text-slate-400">
                        {option.description}
                      </p>
                    )}

                    {option.trailer_url && (
                      <a
                        href={option.trailer_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-purple-400 hover:text-purple-300 underline underline-offset-2 pt-0.5"
                      >
                        <PlayCircle size={12} /> Fragmanı İzle
                      </a>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    {isBeingVoted ? (
                      <Loader2 className="animate-spin text-purple-400" size={20} />
                    ) : showResults ? (
                      <div>
                        <span className="text-xl font-black font-mono text-white">%{percentage}</span>
                        <span className="block text-[9px] font-bold text-slate-400">{option.votes || 0} oy</span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-purple-600/20 border border-purple-500/40 text-purple-300 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase">
                        Oy Ver
                      </span>
                    )}
                  </div>
                </div>

                {showResults && (
                  <div className="w-full h-2 bg-slate-950/90 rounded-full overflow-hidden border border-white/5">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isSelected
                          ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                          : isWinner
                          ? 'bg-emerald-500'
                          : 'bg-blue-500/70'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

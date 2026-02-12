
import React, { useState, useEffect, useCallback } from 'react';
import { UpcomingEvent, AnalysisResult, StockInsight, ImagePrompt } from './types';
import { analyzeMarketData, getSuggestedEvents, generateImagePrompts, generateVarietyKeywords } from './services/geminiService';
import { searchTrackAdobe, searchTrackAdobeMultiplePages } from './services/trackAdobeService';
import TrendChart from './components/TrendChart';
import BriefCard from './components/BriefCard';

const App: React.FC = () => {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [rawMarketData, setRawMarketData] = useState<StockInsight[]>([]);
  const [imagePrompts, setImagePrompts] = useState<ImagePrompt[]>([]);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  const fetchEvents = useCallback(async () => {
    setInitialLoading(true);
    setError(null);
    try {
      const data = await getSuggestedEvents();
      const now = new Date();
      const enriched = data.map((e: any) => {
        const eventDate = new Date(e.date);
        if (isNaN(eventDate.getTime())) return { ...e, daysRemaining: 0 };
        const diff = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { ...e, daysRemaining: diff };
      });
      
      const upcomingOnly = enriched.filter(e => e.daysRemaining >= -1 && e.daysRemaining <= 90);
      upcomingOnly.sort((a: any, b: any) => a.daysRemaining - b.daysRemaining);
      setEvents(upcomingOnly);
    } catch (err) {
      console.error("Failed to fetch events", err);
      setError("Intelligence node connection failed. Please check your network or API key.");
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDeepScan = useCallback(async (searchQuery: string, fromEvent: boolean = false) => {
    if (!searchQuery) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setRawMarketData([]);
    setImagePrompts([]);

    try {
      let images: StockInsight[] = [];
      if (fromEvent) {
        setStatus("Expansion: Mapping visual keywords...");
        const keywords = await generateVarietyKeywords(searchQuery);
        setStatus("Market Check: Querying TrackAdobe (1 page per keyword)...");
        try {
          for (const keyword of keywords) {
            const trackResult = await searchTrackAdobe(keyword, 1, true);
            images = images.concat(trackResult.images);
          }
          const minDownloads = 5;
          const withDownloads = (d: number | string): number => {
            const n = typeof d === "number" ? d : parseInt(String(d).replace(/\D/g, ""), 10);
            return isNaN(n) ? 0 : n;
          };
          images = images.filter((img) => withDownloads(img.downloads) >= minDownloads);
          setRawMarketData(images);
        } catch (e) {
          console.warn("Market proxy skipped, falling back to grounding.");
        }
      } else {
        setStatus("Market Check: Querying TrackAdobe (AI assets, 3+ pages)...");
        try {
          const trackResult = await searchTrackAdobeMultiplePages(searchQuery, 3, true);
          images = trackResult.images;
          setRawMarketData(images);
        } catch (e) {
          console.warn("Market proxy skipped, falling back to grounding.");
        }
      }

      setStatus("Synthesis: Generating Creative Brief...");
      const result = await analyzeMarketData(searchQuery, images);
      setAnalysis(result);

    } catch (err: any) {
      setError(`Scan Error: ${err.message || "Synthesis failed"}. Please try again.`);
      console.error(err);
    } finally {
      setLoading(false);
      setStatus('');
    }
  }, []);

  const handleGeneratePrompts = useCallback(async () => {
    if (!analysis) return;
    setGeneratingPrompts(true);
    setError(null);
    try {
      const prompts = await generateImagePrompts(analysis.brief.event, analysis.brief);
      setImagePrompts(prompts);
    } catch (err: any) {
      setError(`Prompts Error: ${err.message || "Failed to generate prompts"}.`);
    } finally {
      setGeneratingPrompts(false);
    }
  }, [analysis]);

  const handleExportPrompts = useCallback(() => {
    if (imagePrompts.length === 0) return;
    const slug = (analysis?.brief?.event ?? "event").replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
    const filename = `nano-banana-pro-prompts-${slug}.json`;
    const blob = new Blob([JSON.stringify(imagePrompts, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [imagePrompts, analysis?.brief?.event]);

  return (
    <div className="min-h-screen pb-20 selection:bg-sky-500 selection:text-white bg-[#0a0f1d] text-slate-100">
      <nav className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-sky-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
            <i className="fa-solid fa-radar text-white"></i>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase leading-none">Stock<span className="text-sky-400">Vision</span></h1>
            <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Direct TrackAdobe Sync</span>
          </div>
        </div>
        <div className="hidden md:flex px-4 py-1.5 bg-[#1a2333] backdrop-blur rounded-full border border-slate-700 text-[10px] font-black uppercase text-slate-300 items-center">
          <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
          AI Hybrid Intelligence Active
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-10">
        {error && (
          <div className="mb-8 p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center space-x-4">
              <i className="fa-solid fa-triangle-exclamation text-rose-500 text-xl"></i>
              <p className="text-rose-200 font-medium text-sm">{error}</p>
            </div>
            <button 
              onClick={() => query ? handleDeepScan(query) : fetchEvents()}
              className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              Retry
            </button>
          </div>
        )}

        <section className="mb-24 border border-sky-500/30 rounded-[1.5rem] p-8 bg-[#0d1425] shadow-2xl">
          <div className="flex items-start mb-8">
            <h2 className="text-3xl font-black uppercase tracking-tight flex items-center text-white">
              <i className="fa-solid fa-bolt-lightning text-sky-400 mr-3"></i>
              90-Day Market Pipeline
            </h2>
          </div>
          <p className="text-slate-500 text-sm font-medium -mt-6 mb-10">Select an event to initiate a grounded intelligence scan.</p>
          
          <div className="flex space-x-6 overflow-x-auto pb-6 scrollbar-hide min-h-[200px]">
            {initialLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="flex-shrink-0 w-[340px] h-[280px] bg-[#161d2f] rounded-[2.5rem] border border-white/5 animate-pulse"></div>
              ))
            ) : events.length > 0 ? (
              events.map((event, idx) => (
                <div 
                  key={idx} 
                  onClick={() => { setQuery(event.name); handleDeepScan(event.name, true); }}
                  className="flex-shrink-0 w-[340px] bg-[#161d2f] p-8 rounded-[2.5rem] cursor-pointer hover:bg-[#1a2339] hover:border-sky-500/50 transition-all group border border-transparent active:scale-95 shadow-xl"
                >
                  <div className="flex justify-between items-start mb-10">
                    <div className="w-16 h-16 bg-[#0a0f1d] rounded-2xl flex items-center justify-center group-hover:bg-sky-500 group-hover:text-white transition-all text-3xl shadow-xl border border-white/5">
                      <i className={`fa-solid ${event.icon || 'fa-calendar-day'}`}></i>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black uppercase text-sky-400 mb-1">Incoming In</span>
                      <span className="text-xl font-black text-white leading-none">{event.daysRemaining}d</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-2xl leading-tight mb-2 group-hover:text-sky-400 transition-colors">{event.name}</h3>
                  <p className="text-slate-500 text-sm mb-6 line-clamp-2 font-medium">{event.description}</p>
                </div>
              ))
            ) : (
              <div className="w-full flex flex-col items-center justify-center py-12 text-slate-500 font-medium h-48">
                <i className="fa-solid fa-calendar-xmark text-3xl mb-4"></i>
                <p>No upcoming events detected.</p>
              </div>
            )}
          </div>
        </section>

        <section className="max-w-5xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-7xl font-black tracking-tighter italic uppercase flex flex-wrap justify-center items-center gap-4">
              <span className="text-white">INITIATE</span>
              <span className="px-6 py-2 bg-gradient-to-r from-sky-400 to-indigo-500 rounded-xl text-white shadow-xl shadow-sky-500/20">
                DEEP SCAN
              </span>
            </h2>
            <p className="text-slate-400 font-medium text-lg mt-8">Keyword Analysis &rarr; Market Check &rarr; Production Brief</p>
          </div>
          
          <div className="relative group max-w-3xl mx-auto mt-16">
            <div className="absolute inset-0 bg-sky-500/10 blur-3xl group-focus-within:bg-sky-400/20 transition-all rounded-full opacity-50"></div>
            <div className="relative bg-[#0d1425] rounded-[2.5rem] p-2 flex items-center border-2 border-[#1a2333] group-focus-within:border-sky-500/50 transition-all shadow-2xl">
              <div className="px-8 text-slate-500 group-focus-within:text-sky-400 transition-colors">
                <i className="fa-solid fa-microchip text-2xl"></i>
              </div>
              <input 
                type="text" 
                placeholder="Target niche or custom event..."
                className="flex-1 bg-transparent py-6 text-2xl outline-none font-semibold placeholder:text-slate-700 text-white"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDeepScan(query)}
              />
              <button 
                onClick={() => handleDeepScan(query)}
                disabled={loading}
                className="bg-[#0ea5e9] hover:bg-[#0284c7] disabled:bg-slate-800 px-12 py-5 rounded-[2rem] font-black transition-all text-sm uppercase tracking-widest text-white shadow-lg shadow-sky-500/30 flex items-center space-x-3 active:scale-95"
              >
                {loading ? <i className="fa-solid fa-dna fa-spin text-lg"></i> : <span>SCAN MARKET</span>}
              </button>
            </div>
          </div>
          
          {loading && (
            <div className="mt-16 flex flex-col items-center space-y-4 animate-in fade-in duration-500">
              <p className="text-sky-400 font-black text-xs uppercase tracking-[0.5em] animate-pulse">{status}</p>
              <div className="w-[400px] h-1.5 bg-[#161d2f] rounded-full overflow-hidden relative">
                <div className="h-full bg-sky-500 w-1/3 absolute animate-[progress_1.5s_infinite]"></div>
              </div>
            </div>
          )}
        </section>

        {rawMarketData.length > 0 && (
          <div className="space-y-24 animate-in fade-in slide-in-from-bottom-10 duration-500 mb-24">
            <section>
              <div className="mb-10">
                <h3 className="text-4xl font-black italic uppercase tracking-tighter text-white">Market Evidence</h3>
                <p className="text-slate-500 text-lg font-medium italic mt-2">
                  All assets from TrackAdobe Stock ({rawMarketData.length} images).
                  {loading && <span className="block mt-2 text-sky-400 text-sm">Analysing market data...</span>}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {rawMarketData.map((img, idx) => (
                  <div key={img.id || idx} className="bg-[#161d2f] rounded-[2rem] overflow-hidden group border border-white/5 hover:border-sky-500/30 transition-all flex flex-col shadow-2xl">
                    <div className="relative aspect-video bg-[#0d1425] overflow-hidden">
                      <img 
                        src={img.thumbnailUrl || 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=2548&auto=format&fit=crop'} 
                        alt={img.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                      />
                      <div className="absolute top-4 left-4 px-3 py-1 bg-black/80 backdrop-blur-md rounded-lg text-[10px] font-black text-white border border-white/10 uppercase">
                        ID: {img.id}
                      </div>
                      <div className="absolute top-4 right-4 flex gap-2">
                        {img.isAI && <span className="px-3 py-1 bg-violet-600 rounded-lg text-[10px] font-black text-white uppercase">AI</span>}
                        <span className="px-3 py-1 bg-emerald-500 rounded-lg text-xs font-black text-white shadow-xl">{img.downloads} DLs</span>
                      </div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col gap-4">
                      <h4 className="font-bold text-base text-slate-100 line-clamp-2 leading-tight">{img.title}</h4>
                      <dl className="grid grid-cols-1 gap-2 text-xs">
                        <div className="flex justify-between gap-2 border-b border-white/5 pb-1">
                          <dt className="text-slate-500 font-bold uppercase shrink-0">Creator</dt>
                          <dd className="text-slate-200 text-right truncate">{img.creator}{img.creatorId ? ` (${img.creatorId})` : ""}</dd>
                        </div>
                        <div className="flex justify-between gap-2 border-b border-white/5 pb-1">
                          <dt className="text-slate-500 font-bold uppercase shrink-0">Media type</dt>
                          <dd className="text-slate-200 text-right">{img.mediaType}</dd>
                        </div>
                        {img.category != null && img.category !== "" && (
                          <div className="flex justify-between gap-2 border-b border-white/5 pb-1">
                            <dt className="text-slate-500 font-bold uppercase shrink-0">Category</dt>
                            <dd className="text-slate-200 text-right">{img.category}</dd>
                          </div>
                        )}
                        {img.contentType != null && img.contentType !== "" && (
                          <div className="flex justify-between gap-2 border-b border-white/5 pb-1">
                            <dt className="text-slate-500 font-bold uppercase shrink-0">Content type</dt>
                            <dd className="text-slate-200 text-right truncate">{img.contentType}</dd>
                          </div>
                        )}
                        <div className="flex justify-between gap-2 border-b border-white/5 pb-1">
                          <dt className="text-slate-500 font-bold uppercase shrink-0">Dimensions</dt>
                          <dd className="text-slate-200 text-right">{img.dimensions || "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-2 border-b border-white/5 pb-1">
                          <dt className="text-slate-500 font-bold uppercase shrink-0">Upload date</dt>
                          <dd className="text-slate-200 text-right">{img.uploadDate ? String(img.uploadDate).slice(0, 10) : "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-2 border-b border-white/5 pb-1">
                          <dt className="text-slate-500 font-bold uppercase shrink-0">Premium</dt>
                          <dd className="text-slate-200 text-right">{img.premium || "—"}</dd>
                        </div>
                        {Array.isArray(img.keywords) && img.keywords.length > 0 && (
                          <div className="border-b border-white/5 pb-1">
                            <dt className="text-slate-500 font-bold uppercase mb-1">Keywords</dt>
                            <dd className="flex flex-wrap gap-1">
                              {img.keywords.slice(0, 15).map((kw, i) => (
                                <span key={i} className="px-2 py-0.5 bg-[#0d1425] text-slate-300 rounded text-[10px]">{kw}</span>
                              ))}
                              {img.keywords.length > 15 && <span className="text-slate-500 text-[10px]">+{img.keywords.length - 15} more</span>}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {analysis && (
          <div className="space-y-24 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <div className="space-y-16">
              <div className="border-b border-white/10 pb-10">
                <div className="flex items-center space-x-3 mb-4">
                  <span className="w-2.5 h-2.5 bg-sky-500 rounded-full animate-ping"></span>
                  <span className="text-sky-400 text-xs font-black uppercase tracking-[0.4em]">Synthesis Successful</span>
                </div>
                <h2 className="text-7xl font-black uppercase tracking-tighter leading-none italic text-white">
                  {analysis.brief.event}
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 bg-[#0d1425] p-12 rounded-[3.5rem] border border-white/5 shadow-2xl">
                  <h3 className="text-3xl font-black tracking-tight uppercase italic text-white mb-10">Market Gap Analysis</h3>
                  <TrendChart data={analysis.trends} />
                </div>

                <div className="bg-[#161d2f] p-10 rounded-[3.5rem] border border-sky-500/20 shadow-2xl">
                  <h3 className="text-2xl font-black mb-10 flex items-center italic uppercase text-white">
                    <i className="fa-solid fa-lightbulb text-amber-400 mr-4"></i>
                    Actionable Ideas
                  </h3>
                  <div className="space-y-6">
                    {analysis.brief.shotList.slice(0, 4).map((item, i) => (
                      <div key={i} className="group flex items-center space-x-6 p-6 rounded-3xl bg-[#0a0f1d] border border-white/5 hover:border-sky-500/40 transition-all">
                        <span className="text-4xl font-black text-slate-800 group-hover:text-sky-500/40 transition-colors italic">0{i + 1}</span>
                        <div>
                          <p className="text-base font-bold text-slate-100 leading-snug mb-1">{item.idea}</p>
                          <span className="text-[10px] text-sky-400 uppercase font-black px-2 py-1 bg-sky-500/10 rounded-md tracking-widest">{item.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <BriefCard brief={analysis.brief} />

              <section className="bg-[#0d1425] p-10 rounded-[3.5rem] border border-sky-500/20 shadow-2xl">
                <h3 className="text-2xl font-black mb-6 flex items-center italic uppercase text-white">
                  <i className="fa-solid fa-images text-amber-400 mr-4"></i>
                  Nano Banana Pro – Image Prompts
                </h3>
                <p className="text-slate-400 text-sm mb-6">
                  Generate at least 100 image-only JSON prompts for Nano Banana Pro from this brief, then export.
                </p>
                <div className="flex flex-wrap gap-4 mb-8">
                  <button
                    onClick={handleGeneratePrompts}
                    disabled={generatingPrompts || !analysis}
                    className="px-6 py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all"
                  >
                    {generatingPrompts ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Generating…</> : "Generate 100 prompts"}
                  </button>
                  <button
                    onClick={handleExportPrompts}
                    disabled={imagePrompts.length === 0}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all"
                  >
                    Export JSON
                  </button>
                </div>
                {imagePrompts.length > 0 && (
                  <>
                    <p className="text-sky-400 text-xs font-black uppercase tracking-widest mb-4">{imagePrompts.length} prompts ready</p>
                    <div className="space-y-4">
                      <p className="text-slate-500 text-xs uppercase font-bold">Preview (first 5)</p>
                      {imagePrompts.slice(0, 5).map((p, i) => (
                        <div key={i} className="p-4 bg-[#161d2f] rounded-xl border border-white/5 text-left">
                          <span className="text-[10px] text-sky-400 font-black uppercase">#{i + 1}</span>
                          <p className="text-slate-200 text-sm mt-1"><span className="text-slate-500">Scene:</span> {p.scene || "—"}</p>
                          <p className="text-slate-200 text-sm"><span className="text-slate-500">Style:</span> {p.style || "—"}</p>
                          <p className="text-slate-200 text-sm"><span className="text-slate-500">Composition:</span> {p.shot?.composition || "—"}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-40 border-t border-white/5 py-24 bg-[#050810]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-8 mb-12 md:mb-0 opacity-40">
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none text-white">Stock<span className="text-sky-400">Vision</span></h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none italic">Intelligence Node v8.0</p>
          </div>
          <div className="flex space-x-12 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">
            <span>EXPANSION NODE</span>
            <span>GEMINI PRO INTEL</span>
            <span>DATA SYNC ACTIVE</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

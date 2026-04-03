import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, BookOpen, ArrowLeft, ExternalLink, Unlock, FileText, CheckCircle2, 
  Copy, Filter, AlertCircle, Calendar, Clock, List, Leaf, Atom, Loader2, 
  Languages, Tag, Plus, X, Save, Info, Globe, HelpCircle, ChevronRight
} from 'lucide-react';

const CORREO_ADMIN = "tu_correo@ejemplo.com"; 

const REVISTAS_ISSN = "0022-4308|1098-2736|0036-8326|1098-237X|0157-244X|1573-1898|0305-7267|1940-4603|0950-0693|1464-5289|0212-4521|2174-6486|1516-7313|1980-850X|1697-011X|1579-1513|0214-4379|2253-6663|1133-9837|2013-2255|1699-6712|0002-7685|1938-4211|0021-9266|2157-6009|0036-8555|1089-9995|2158-1428|2332-6530|0002-8312|1935-1011|0141-1926|1469-3518|0007-0998|2044-8279|0007-1013|1467-8535|0142-5692|1465-3346|0009-3920|1467-8624|0360-1315|1873-782X|0361-476X|0273-2297|0885-2006|0272-7757|1557-3060|1557-3079|0013-161X|1552-3519|0162-3737|1935-1062|1741-1432|1741-1440|0895-9048|1552-3896|1040-726X|1573-336X|1747-938X|0013-189X|1935-102X|1492-3831|0268-0939|1464-5106|0022-0663|1939-2176|1934-5747|1934-5739|0022-4871|1552-4698|1050-8406|1532-7809|1362-1688|1477-0954|0959-4752|0034-0553|1936-2722|0741-9325|1538-4756|0034-6543|1935-1046|0091-732X|1935-1038|1088-8438|1532-799X|0038-0407|1939-8573|0742-051X|0042-0859|1552-8340|1931-7913";

const reconstruirAbstract = (invertedIndex) => {
  if (!invertedIndex) return "Resumen original no disponible en la base de datos abierta.";
  const words = [];
  try {
    Object.entries(invertedIndex).forEach(([word, positions]) => {
      positions.forEach(pos => words[pos] = word);
    });
    return words.filter(Boolean).join(" ");
  } catch (e) {
    return "Error al procesar el resumen original.";
  }
};

const calcularDiasTranscurridos = (fechaPublicacion) => {
  if (!fechaPublicacion) return 999;
  try {
    const hoy = new Date();
    const fechaHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const [year, month, day] = fechaPublicacion.split('-');
    const fechaPub = new Date(year, month - 1, day);
    const diferenciaTiempo = fechaHoy.getTime() - fechaPub.getTime();
    return Math.floor(diferenciaTiempo / (1000 * 3600 * 24));
  } catch (e) {
    return 999;
  }
};

const BIO_GEO_KEYWORDS = [
  '\\bbiology\\b', '\\bbiología\\b', '\\bgeology\\b', '\\bgeología\\b', 'earth science', 
  'ciencias de la tierra', '\\becology\\b', '\\becología\\b', 'climate change', 
  'cambio climático', '\\bevolution\\b', '\\bevolución\\b', '\\bgenetics\\b', '\\bgenética\\b', 
  '\\bbotany\\b', '\\bbotánica\\b', '\\bzoology\\b', '\\bzoología\\b', 'ecosystem', 
  'ecosistema', 'biodiversity', 'biodiversidad', 'sustainability', 'sostenibilidad', 
  'nature-based', 'renaturalización', 'thermal stress', 'estrés térmico', 'green space'
];

const FIS_QUI_KEYWORDS = [
  '\\bphysics\\b', '\\bfísica\\b', '\\bchemistry\\b', '\\bquímica\\b', 'thermodynamics', 
  'termodinámica', '\\bmechanics\\b', 'mecánica', 'kinematics', 'cinemática', 
  'electromagnetism', 'quantum', 'cuántica', '\\batoms\\b', '\\bátomos\\b', 'atomic', 
  '\\bmolecules\\b', '\\bmoléculas\\b', 'chemical reaction', 'reacción química', 
  'periodic table', 'energy', 'energía', 'forces', 'matter', 'laboratory', 'laboratorio'
];

export default function App() {
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modales de Información
  const [showAppInfo, setShowAppInfo] = useState(false);
  const [showFilterInfo, setShowFilterInfo] = useState(false);
  
  // Estados de Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJournal, setSelectedJournal] = useState("Todas las revistas");
  const [selectedTags, setSelectedTags] = useState([]);
  const [onlyOA, setOnlyOA] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Pestañas Personalizadas
  const [customTabs, setCustomTabs] = useState(() => {
    const saved = localStorage.getItem('eduradar_custom_tabs');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedArticle, setSelectedArticle] = useState(null);
  const [copied, setCopied] = useState(false);
  const [translateFeedback, setTranslateFeedback] = useState(null);
  const [viewMode, setViewMode] = useState("radar"); 

  useEffect(() => {
    const fetchArticles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const issnArray = REVISTAS_ISSN.split('|');
        const chunkSize = 40;
        const issnChunks = [];
        for (let i = 0; i < issnArray.length; i += chunkSize) {
          issnChunks.push(issnArray.slice(i, i + chunkSize).join('|'));
        }

        const fetchPromises = issnChunks.map(chunk => {
          const url = `https://api.openalex.org/works?filter=primary_location.source.issn:${chunk}&sort=publication_date:desc&per-page=200&mailto=${CORREO_ADMIN}`;
          return fetch(url, { cache: 'no-store' }).then(res => {
            if (!res.ok) throw new Error("Error API OpenAlex");
            return res.json();
          });
        });

        const resultsArray = await Promise.all(fetchPromises);
        const seenIds = new Set();
        let combined = [];

        resultsArray.forEach(data => {
          if (data?.results) {
            data.results.forEach(work => {
              if (!seenIds.has(work.id)) {
                seenIds.add(work.id);
                combined.push({
                  id: work.id || Math.random().toString(),
                  title: work.title || "Título no disponible",
                  authors: work.authorships?.length > 0 
                    ? work.authorships.map(a => a.author?.display_name).filter(Boolean) 
                    : ["Autores desconocidos"],
                  journal: work.primary_location?.source?.display_name || "Revista Científica",
                  year: work.publication_year || "Año desconocido",
                  date: work.publication_date || "",
                  isOpenAccess: work.open_access?.is_oa || false,
                  url: work.primary_location?.landing_page_url || work.doi || work.id || "#",
                  abstract: reconstruirAbstract(work.abstract_inverted_index),
                  tags: work.concepts ? work.concepts.slice(0, 5).map(c => c.display_name) : [],
                  diasTranscurridos: calcularDiasTranscurridos(work.publication_date)
                });
              }
            });
          }
        });

        combined.sort((a, b) => new Date(b.date) - new Date(a.date));
        setArticles(combined);
      } catch (err) {
        setError("Error de conexión. Verifica tu acceso a internet.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchArticles();
  }, []);

  const popularTags = useMemo(() => {
    const counts = {};
    articles.forEach(a => a.tags.forEach(t => {
      counts[t] = (counts[t] || 0) + 1;
    }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(e => e[0]);
  }, [articles]);

  const journals = useMemo(() => {
    const uniqueJournals = new Set(articles.map(article => article.journal));
    return ["Todas las revistas", ...Array.from(uniqueJournals).sort()];
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      const safeText = `${article.title} ${article.authors.join(' ')} ${article.abstract}`.toLowerCase();
      const matchesSearch = safeText.includes(searchTerm.toLowerCase());
      const matchesJournal = selectedJournal === "Todas las revistas" || article.journal === selectedJournal;
      const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => article.tags.includes(tag));
      const matchesOA = !onlyOA || article.isOpenAccess;

      return matchesSearch && matchesJournal && matchesTags && matchesOA;
    });
  }, [searchTerm, selectedJournal, selectedTags, onlyOA, articles]);

  const { hoy, semana } = useMemo(() => {
    const rHoy = [];
    const rSemana = [];
    filteredArticles.forEach(article => {
      if (article.diasTranscurridos <= 1) rHoy.push(article);
      else if (article.diasTranscurridos > 1 && article.diasTranscurridos <= 7) rSemana.push(article);
    });
    return { hoy: rHoy, semana: rSemana };
  }, [filteredArticles]);

  const articulosBioGeo = useMemo(() => {
    return filteredArticles.filter(article => {
      const text = `${article.title} ${article.abstract} ${article.tags.join(' ')}`.toLowerCase();
      return BIO_GEO_KEYWORDS.some(k => new RegExp(k, 'i').test(text));
    });
  }, [filteredArticles]);

  const articulosFisQui = useMemo(() => {
    return filteredArticles.filter(article => {
      const text = `${article.title} ${article.abstract} ${article.tags.join(' ')}`.toLowerCase();
      return FIS_QUI_KEYWORDS.some(k => new RegExp(k, 'i').test(text));
    });
  }, [filteredArticles]);

  const handleSaveTab = () => {
    const name = window.prompt("Nombre para esta pestaña (ej. 'Inclusión Educativa'):");
    if (!name) return;
    const newTab = {
      id: Date.now().toString(),
      name,
      searchTerm,
      selectedJournal,
      selectedTags,
      onlyOA
    };
    const updated = [...customTabs, newTab];
    setCustomTabs(updated);
    localStorage.setItem('eduradar_custom_tabs', JSON.stringify(updated));
    setViewMode(`custom_${newTab.id}`);
  };

  const deleteTab = (id) => {
    if(!window.confirm("¿Eliminar esta pestaña?")) return;
    const updated = customTabs.filter(t => t.id !== id);
    setCustomTabs(updated);
    localStorage.setItem('eduradar_custom_tabs', JSON.stringify(updated));
    if (viewMode === `custom_${id}`) setViewMode("historico");
  };

  const applyCustomTabFilters = (tab) => {
    setSearchTerm(tab.searchTerm);
    setSelectedJournal(tab.selectedJournal);
    setSelectedTags(tab.selectedTags);
    setOnlyOA(tab.onlyOA);
    setViewMode(`custom_${tab.id}`);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedJournal("Todas las revistas");
    setSelectedTags([]);
    setOnlyOA(false);
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleExternalTranslate = (platform, text) => {
    if (!text || text.includes("no disponible")) return;
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    try { document.execCommand('copy'); setTranslateFeedback(platform); setTimeout(() => setTranslateFeedback(null), 4000); } catch (err) {}
    document.body.removeChild(el);

    const url = platform === 'deepl' 
      ? `https://www.deepl.com/translator#en/es/${encodeURIComponent(text)}` 
      : `https://www.softcatala.org/traductor/`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyToMarkdown = (article) => {
    const today = new Date().toISOString().split('T')[0];
    const formattedTags = (article.tags || []).map(t => `  - ${t.toLowerCase().replace(/[^a-z0-9]/g, '_')}`).join('\n');
    const safeTitle = (article.title || "").replace(/"/g, '\\"');
    const safeJournal = (article.journal || "").replace(/"/g, '\\"');

    const template = `---
tipo: lectura
estado: pendiente
tags:
  - didáctica
${formattedTags}
fecha: ${today}
archivo: "${article.url}"
---
# ${safeTitle}

📄 Documento Original
[Enlace a la fuente (${safeJournal})](${article.url})

🧠 Mis Notas y Reflexiones
(Espacio libre para pensar)

Idea principal:

🤖 Resumen Original
> ${article.abstract}
`;
    const el = document.createElement("textarea");
    el.value = template;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ArticleCard = ({ article }) => (
    <div 
      onClick={() => { setSelectedArticle(article); window.scrollTo(0,0); }} 
      className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
    >
      <div className="flex-grow">
        <div className="flex items-center gap-2 mb-2 flex-wrap text-xs font-semibold text-slate-500 uppercase">
          <span>{article.journal}</span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span>{article.date || article.year}</span>
          {article.isOpenAccess && <Unlock size={12} className="text-emerald-500" title="Acceso Abierto" />}
        </div>
        <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-tight mb-2">
          {article.title}
        </h2>
        <p className="text-sm text-slate-600 truncate max-w-2xl font-medium mb-3">
          {article.authors.join(', ')}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {article.tags.map(t => (
            <span key={t} className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md border border-slate-200">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans flex flex-col">
        <div className="max-w-3xl mx-auto flex-grow w-full">
          <button 
            onClick={() => { setSelectedArticle(null); window.scrollTo(0,0); }} 
            className="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-6 font-semibold transition-colors"
          >
            <ArrowLeft size={20} /> Volver al listado
          </button>
          <article className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-100">
              <div className="flex items-center gap-3 mb-4 flex-wrap text-xs font-bold uppercase">
                <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-md">{selectedArticle.journal}</span>
                <span className="text-slate-400 font-medium">{selectedArticle.date}</span>
                {selectedArticle.isOpenAccess && <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1"><Unlock size={14}/> Open Access</span>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4 leading-tight">{selectedArticle.title}</h1>
              <p className="text-slate-600 font-semibold text-lg">{selectedArticle.authors.join(', ')}</p>
            </div>
            
            <div className="p-6 sm:p-8 bg-slate-50/50 border-b border-slate-200 relative">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={18} /> Resumen Original
                </h3>
                {!selectedArticle.abstract.includes("no disponible") && (
                  <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm gap-1">
                    <button onClick={() => handleExternalTranslate('deepl', selectedArticle.abstract)} className="px-3 py-2 text-xs font-bold rounded-md text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2">
                      {translateFeedback === 'deepl' ? <CheckCircle2 size={14} className="text-emerald-500"/> : <Languages size={14} />} DeepL (ES)
                    </button>
                    <button onClick={() => handleExternalTranslate('softcatala', selectedArticle.abstract)} className="px-3 py-2 text-xs font-bold rounded-md text-slate-600 hover:bg-orange-50 hover:text-orange-700 transition-colors flex items-center gap-2">
                      {translateFeedback === 'softcatala' ? <CheckCircle2 size={14} className="text-emerald-500"/> : <Languages size={14} />} Softcatalà (VA)
                    </button>
                  </div>
                )}
              </div>
              <div className="text-slate-700 leading-relaxed text-lg font-normal">
                <p className="whitespace-pre-wrap">{selectedArticle.abstract}</p>
                {translateFeedback && (
                  <div className="absolute top-4 right-8 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xl animate-bounce">
                    ¡Copiado! Pega el texto (Ctrl+V)
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 sm:p-8 bg-white flex flex-col sm:flex-row gap-4 justify-between items-center">
              {selectedArticle.url !== "#" ? (
                <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-md">
                  Ir a la fuente <ExternalLink size={18} />
                </a>
              ) : <span className="text-slate-400 italic">Fuente no disponible</span>}
              <button onClick={() => handleCopyToMarkdown(selectedArticle)} className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold border transition-all ${copied ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"}`}>
                {copied ? <><CheckCircle2 size={18} /> ¡Copiado!</> : <><Copy size={18} /> Exportar a Obsidian</>}
              </button>
            </div>
          </article>
        </div>
        
        <footer className="mt-8 py-6 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-500 font-medium flex items-center justify-center gap-2">
            Impulsado por la API abierta de 
            <a href="https://openalex.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 font-bold">
              OpenAlex <ExternalLink size={12} />
            </a>
          </p>
        </footer>
      </div>
    );
  }

  const activeFiltersCount = selectedTags.length + (onlyOA ? 1 : 0) + (selectedJournal !== "Todas las revistas" ? 1 : 0) + (searchTerm ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 relative flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-4">
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="bg-slate-800 p-2 rounded-lg text-white shadow-md">
                <BookOpen size={24} />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">EduArticles Radar</h1>
              <button 
                onClick={() => setShowAppInfo(true)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors ml-2"
                title="Información sobre la aplicación"
              >
                <Info size={18} />
              </button>
            </div>
            
            <div className="flex w-full md:w-auto gap-2">
              <div className="relative flex-grow sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500" 
                  placeholder="Buscar título o autores..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  disabled={isLoading} 
                />
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-bold transition-colors ${showFilters || activeFiltersCount > 0 ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
              >
                <Filter size={16} />
                <span className="hidden sm:inline">Filtros</span>
                {activeFiltersCount > 0 && <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">{activeFiltersCount}</span>}
              </button>
            </div>
          </div>

          {/* Panel de Filtros Avanzados (Nivel 1 y 2) */}
          {showFilters && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 shadow-inner animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filtrar por Revista</label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 cursor-pointer" 
                    value={selectedJournal} 
                    onChange={(e) => setSelectedJournal(e.target.value)} 
                  >
                    {journals.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors h-[38px]">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      checked={onlyOA}
                      onChange={(e) => setOnlyOA(e.target.checked)}
                    />
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-1"><Unlock size={14} className="text-emerald-600"/> Solo Open Access</span>
                  </label>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Tag size={14}/> Conceptos Clave (Auto-detectados)</label>
                  <button onClick={() => setShowFilterInfo(true)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1 rounded-full transition-colors flex items-center gap-1 text-xs font-bold">
                    <HelpCircle size={14} /> ¿Qué es esto?
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                  {popularTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${selectedTags.includes(tag) ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600'}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <button onClick={resetFilters} className="text-sm font-semibold text-slate-500 hover:text-red-600 transition-colors">
                  Limpiar filtros
                </button>
                <button 
                  onClick={handleSaveTab}
                  disabled={activeFiltersCount === 0}
                  className="flex items-center gap-2 text-sm font-bold px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Guarda esta combinación de filtros como una pestaña nueva"
                >
                  <Save size={16} /> Guardar como Pestaña
                </button>
              </div>
            </div>
          )}

          {/* Navegación de Pestañas */}
          {!isLoading && !error && (
            <div className="flex gap-4 border-b border-slate-200 overflow-x-auto text-sm font-bold pt-2 no-scrollbar">
              <button onClick={() => {resetFilters(); setViewMode('radar');}} className={`pb-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'radar' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <Clock size={16}/> Radar
              </button>
              <button onClick={() => {resetFilters(); setViewMode('historico');}} className={`pb-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'historico' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <List size={16}/> Todo ({articles.length})
              </button>
              <button onClick={() => {resetFilters(); setViewMode('biogeo');}} className={`pb-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'biogeo' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <Leaf size={16}/> BioGeo ({articulosBioGeo.length})
              </button>
              <button onClick={() => {resetFilters(); setViewMode('fisqui');}} className={`pb-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'fisqui' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <Atom size={16}/> Fís/Quím ({articulosFisQui.length})
              </button>
              
              {/* Pestañas Personalizadas */}
              {customTabs.map(tab => (
                <div key={tab.id} className="relative group flex items-center">
                  <button 
                    onClick={() => applyCustomTabFilters(tab)} 
                    className={`pb-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap pr-6 ${viewMode === `custom_${tab.id}` ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    <Filter size={14}/> {tab.name}
                  </button>
                  <button 
                    onClick={(e) => {e.stopPropagation(); deleteTab(tab.id);}}
                    className="absolute right-0 top-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar pestaña"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 flex-grow w-full">
        {isLoading ? (
          <div className="flex flex-col items-center py-20 text-slate-500 text-center">
            <Loader2 size={40} className="animate-spin mb-4 text-blue-600" />
            <p className="font-bold text-lg">Actualizando el radar...</p>
            <p className="text-sm mt-2 text-slate-400">Descargando registros en profundidad.</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl flex gap-4"><AlertCircle/><p className="font-medium">{error}</p></div>
        ) : (
          <div>
            {/* Si hay filtros activos Y NO estamos en una pestaña base, mostramos los resultados filtrados globalmente */}
            {(activeFiltersCount > 0 && !['radar', 'biogeo', 'fisqui'].includes(viewMode)) || viewMode.startsWith('custom_') ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Filter size={20} className="text-blue-600"/> Resultados del Filtro ({filteredArticles.length})</h2>
                </div>
                {filteredArticles.length > 0 ? filteredArticles.map(a => <ArticleCard key={a.id} article={a}/>) : <div className="p-12 text-center bg-white border border-dashed rounded-xl text-slate-400 font-medium italic">No se encontraron evidencias con esta combinación de filtros.</div>}
              </div>
            ) : viewMode === 'radar' ? (
              <div className="space-y-10">
                <section>
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Calendar className="text-blue-600" size={20}/> Novedades de Hoy</h2>
                  {hoy.length ? hoy.map(a => <ArticleCard key={a.id} article={a}/>) : <div className="p-10 text-center bg-white border border-dashed rounded-xl text-slate-400 font-medium italic">Sin publicaciones en las últimas 24h.</div>}
                </section>
                <section>
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Clock className="text-slate-500" size={20}/> Esta Semana</h2>
                  {semana.length ? semana.map(a => <ArticleCard key={a.id} article={a}/>) : <div className="p-10 text-center bg-white border border-dashed rounded-xl text-slate-400 font-medium italic">Sin publicaciones en los últimos 7 días.</div>}
                </section>
              </div>
            ) : viewMode === 'biogeo' ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl flex items-start gap-4 mb-2 shadow-sm">
                  <Leaf className="text-emerald-600 mt-1" />
                  <div>
                    <h2 className="font-bold text-emerald-900 text-lg">Especialidad: Biología y Geología</h2>
                    <p className="text-sm text-emerald-800 font-medium">Ciencias de la vida, de la tierra y proyectos de sostenibilidad.</p>
                  </div>
                </div>
                {articulosBioGeo.length > 0 ? articulosBioGeo.map(a => <ArticleCard key={a.id} article={a}/>) : <div className="p-10 text-center bg-white border border-dashed rounded-xl text-slate-400 font-medium italic">No se han detectado evidencias para BioGeo hoy.</div>}
              </div>
            ) : viewMode === 'fisqui' ? (
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 p-5 rounded-xl flex items-start gap-4 mb-2 shadow-sm">
                  <Atom className="text-purple-600 mt-1" />
                  <div>
                    <h2 className="font-bold text-purple-900 text-lg">Especialidad: Física y Química</h2>
                    <p className="text-sm text-purple-800 font-medium">Leyes físicas, procesos químicos y didáctica de ciencias exactas.</p>
                  </div>
                </div>
                {articulosFisQui.length > 0 ? articulosFisQui.map(a => <ArticleCard key={a.id} article={a}/>) : <div className="p-10 text-center bg-white border border-dashed rounded-xl text-slate-400 font-medium italic">No se han detectado evidencias para Fís/Quím hoy.</div>}
              </div>
            ) : viewMode === 'historico' ? (
              <div className="space-y-4">
                <div className="mb-2 pl-1"><h2 className="text-lg font-bold text-slate-800">Listado completo</h2></div>
                {filteredArticles.map(a => <ArticleCard key={a.id} article={a}/>)}
              </div>
            ) : null}
          </div>
        )}
      </main>

      <footer className="mt-8 py-6 border-t border-slate-200 text-center flex-shrink-0">
        <p className="text-sm text-slate-500 font-medium flex items-center justify-center gap-2">
          Impulsado por la API abierta de 
          <a href="https://openalex.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 font-bold">
            OpenAlex <ExternalLink size={12} />
          </a>
        </p>
      </footer>

      {/* MODAL 1: INFORMACIÓN GENERAL DE LA APLICACIÓN */}
      {showAppInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAppInfo(false)}>
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-800 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2"><Globe className="w-6 h-6" /> Estado del Radar</h2>
              <button onClick={() => setShowAppInfo(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <p className="text-slate-600 leading-relaxed text-lg">
                <strong>EduArticles Radar</strong> es un sistema de vigilancia tecnológica y didáctica. 
                Monitoriza en tiempo real más de <span className="font-bold text-blue-600">{REVISTAS_ISSN.split('|').length} revistas científicas de impacto</span> a través de la API de OpenAlex, asegurando una cobertura profunda de evidencias para la investigación educativa.
              </p>
              
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                  <BookOpen size={16} className="text-blue-600"/> 
                  Revistas activas en el periodo reciente ({journals.length - 1})
                </h4>
                <ul className="text-sm text-slate-600 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 max-h-60 overflow-y-auto pr-2">
                  {journals.filter(j => j !== "Todas las revistas").map(rev => (
                    <li key={rev} className="flex items-start gap-2 leading-tight">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 flex-shrink-0"></div> 
                      <span className="font-medium">{rev}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500 italic">
                    * El listado se genera dinámicamente mostrando las revistas (de los {REVISTAS_ISSN.split('|').length} ISSN indexados) que han publicado nuevos artículos dentro de la profundidad actual del radar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: AYUDA DEL SISTEMA DE FILTROS */}
      {showFilterInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowFilterInfo(false)}>
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-50">
              <h2 className="text-xl font-bold text-blue-800 flex items-center gap-2"><Filter size={24}/> Cómo funcionan los filtros</h2>
              <button onClick={() => setShowFilterInfo(false)} className="p-1 hover:bg-blue-200 text-blue-800 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              
              <div>
                <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Tag className="text-blue-600" size={18}/> ¿De dónde salen los Conceptos Clave?</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  No son etiquetas manuales puestas por los autores. OpenAlex utiliza un modelo de <strong>Inteligencia Artificial semántica</strong> que lee el <i>abstract</i> de cada artículo y lo asocia automáticamente a una gran ontología científica mundial (Wikidata). 
                  <br/><br/>
                  El radar analiza los artículos recién descargados, cuenta qué conceptos son los más repetidos <strong>esta semana</strong>, y te ofrece los 25 más frecuentes como botones para filtrar de forma ultrarrápida.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Save className="text-slate-600" size={18}/> Sobre las "Pestañas Guardadas"</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Cuando haces clic en "Guardar como Pestaña", tu navegador memoriza <strong>la palabra o concepto exacto</strong> que has seleccionado, NO el botón visual. 
                  <br/><br/>
                  Si la próxima semana ese concepto ya no está en el Top 25 (el botón desaparece), <strong>tu pestaña seguirá funcionando a la perfección</strong>: el sistema filtrará las publicaciones buscando esa palabra exacta de forma persistente.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
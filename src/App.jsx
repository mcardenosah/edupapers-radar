import React, { useState, useMemo, useEffect } from 'react';
import { Search, BookOpen, ArrowLeft, ExternalLink, Unlock, FileText, CheckCircle2, Copy, Filter, AlertCircle, Calendar, Clock, List, Leaf, Atom, Loader2, Languages } from 'lucide-react';

const CORREO_ADMIN = "tu_correo@ejemplo.com"; 

// LISTADO COMPLETO DE MÁS DE 90 REVISTAS (Motor de alta capacidad)
const REVISTAS_ISSN = "0022-4308|1098-2736|0036-8326|1098-237X|0157-244X|1573-1898|0305-7267|1940-4603|0950-0693|1464-5289|0212-4521|2174-6486|1516-7313|1980-850X|1697-011X|1579-1513|0214-4379|2253-6663|1133-9837|2013-2255|1699-6712|0002-7685|1938-4211|0021-9266|2157-6009|0036-8555|1089-9995|2158-1428|2332-6530|0002-8312|1935-1011|0141-1926|1469-3518|0007-0998|2044-8279|0007-1013|1467-8535|0142-5692|1465-3346|0009-3920|1467-8624|0360-1315|1873-782X|0361-476X|0273-2297|0885-2006|0272-7757|1557-3060|1557-3079|0013-161X|1552-3519|0162-3737|1935-1062|1741-1432|1741-1440|0895-9048|1552-3896|1040-726X|1573-336X|1747-938X|0013-189X|1935-102X|1492-3831|0268-0939|1464-5106|0022-0663|1939-2176|1934-5747|1934-5739|0022-4871|1552-4698|1050-8406|1532-7809|1362-1688|1477-0954|0959-4752|0034-0553|1936-2722|0741-9325|1538-4756|0034-6543|1935-1046|0091-732X|1935-1038|1088-8438|1532-799X|0038-0407|1939-8573|0742-051X|0042-0859|1552-8340|1931-7913";

const reconstruirAbstract = (invertedIndex) => {
  if (!invertedIndex) return "Resumen original no disponible en la base de datos abierta.";
  const words = [];
  try {
    Object.entries(invertedIndex).forEach(([word, positions]) => {
      positions.forEach(pos => {
        words[pos] = word;
      });
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
  '\\bbiology\\b', '\\bbiología\\b', '\\bgeology\\b', '\\bgeología\\b', 
  'earth science', 'ciencias de la tierra', '\\becology\\b', '\\becología\\b', 
  'climate change', 'cambio climático', '\\bevolution\\b', '\\bevolución\\b', 
  '\\bgenetics\\b', '\\bgenética\\b', '\\bbotany\\b', '\\bbotánica\\b', 
  '\\bzoology\\b', '\\bzoología\\b', 'ecosystem', 'ecosistema', 
  'biodiversity', 'biodiversidad', 'sustainability', 'sostenibilidad', 
  'nature-based', 'renaturalización', 'thermal stress', 'estrés térmico', 
  'green space', 'espacios verdes', 'outdoor learning', 'educación ambiental'
];

const FIS_QUI_KEYWORDS = [
  '\\bphysics\\b', '\\bfísica\\b', '\\bchemistry\\b', '\\bquímica\\b',
  'thermodynamics', 'termodinámica', '\\bmechanics\\b', 'mecánica',
  'kinematics', 'cinemática', 'electromagnetism', 'electromagnetismo',
  'quantum', 'cuántica', '\\batoms\\b', '\\bátomos\\b', 'atomic', 'atómico',
  '\\bmolecules\\b', '\\bmoléculas\\b', 'molecular', 'chemical reaction', 
  'reacción química', 'periodic table', 'tabla periódica', 'energy', 'energía',
  'forces', 'fuerzas', 'matter', 'materia', 'laboratory', 'laboratorio'
];

export default function App() {
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJournal, setSelectedJournal] = useState("Todas las revistas");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [copied, setCopied] = useState(false);
  const [translateFeedback, setTranslateFeedback] = useState(null);
  const [viewMode, setViewMode] = useState("radar"); 

  useEffect(() => {
    const fetchArticles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. DIVISIÓN EN BLOQUES PARA EVITAR ERROR 400 DE OPENALEX
        const issnArray = REVISTAS_ISSN.split('|');
        const chunkSize = 40;
        const issnChunks = [];
        for (let i = 0; i < issnArray.length; i += chunkSize) {
          issnChunks.push(issnArray.slice(i, i + chunkSize).join('|'));
        }

        // 2. PETICIONES PARALELAS CON DEFENSA ANTICACHÉ Y MAX PROFUNDIDAD (200)
        const fetchPromises = issnChunks.map(chunk => {
          const url = `https://api.openalex.org/works?filter=primary_location.source.issn:${chunk}&sort=publication_date:desc&per-page=200&mailto=${CORREO_ADMIN}`;
          return fetch(url, { cache: 'no-store' }).then(res => {
            if (!res.ok) throw new Error("Error API OpenAlex");
            return res.json();
          });
        });

        const resultsArray = await Promise.all(fetchPromises);

        // 3. COMBINAR DATOS Y ELIMINAR DUPLICADOS (Evitar warnings de React)
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
                  tags: work.concepts ? work.concepts.slice(0, 3).map(c => c.display_name) : [],
                  diasTranscurridos: calcularDiasTranscurridos(work.publication_date)
                });
              }
            });
          }
        });

        // 4. ORDENAR GLOBALMENTE POR FECHA DESCENDENTE
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

  const journals = useMemo(() => {
    const uniqueJournals = new Set(articles.map(article => article.journal));
    return ["Todas las revistas", ...Array.from(uniqueJournals).sort()];
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      const safeTitle = (article.title || "").toLowerCase();
      const matchesSearch = safeTitle.includes(searchTerm.toLowerCase()) ||
                            article.authors.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesJournal = selectedJournal === "Todas las revistas" || article.journal === selectedJournal;
      return matchesSearch && matchesJournal;
    });
  }, [searchTerm, selectedJournal, articles]);

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

  const handleExternalTranslate = (platform, text) => {
    if (!text || text.includes("no disponible")) return;

    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
      setTranslateFeedback(platform);
      setTimeout(() => setTranslateFeedback(null), 4000);
    } catch (err) { console.error(err); }
    document.body.removeChild(el);

    let url = "";
    if (platform === 'deepl') {
      url = `https://www.deepl.com/translator#en/es/${encodeURIComponent(text)}`;
    } else {
      url = `https://www.softcatala.org/traductor/`;
    }
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
        <p className="text-sm text-slate-600 truncate max-w-2xl font-medium">
          {article.authors.join(', ')}
        </p>
      </div>
    </div>
  );

  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans">
        <div className="max-w-3xl mx-auto">
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
                    <button 
                      onClick={() => handleExternalTranslate('deepl', selectedArticle.abstract)} 
                      className="px-3 py-2 text-xs font-bold rounded-md text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                    >
                      {translateFeedback === 'deepl' ? <CheckCircle2 size={14} className="text-emerald-500"/> : <Languages size={14} />} 
                      DeepL (ES)
                    </button>
                    <button 
                      onClick={() => handleExternalTranslate('softcatala', selectedArticle.abstract)} 
                      className="px-3 py-2 text-xs font-bold rounded-md text-slate-600 hover:bg-orange-50 hover:text-orange-700 transition-colors flex items-center gap-2"
                    >
                      {translateFeedback === 'softcatala' ? <CheckCircle2 size={14} className="text-emerald-500"/> : <Languages size={14} />} 
                      Softcatalà (VA)
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
                <a 
                  href={selectedArticle.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-md"
                >
                  Ir a la fuente <ExternalLink size={18} />
                </a>
              ) : <span className="text-slate-400 italic">Fuente no disponible</span>}
              <button 
                onClick={() => handleCopyToMarkdown(selectedArticle)} 
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold border transition-all ${
                  copied ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {copied ? <><CheckCircle2 size={18} /> ¡Copiado!</> : <><Copy size={18} /> Exportar a Obsidian</>}
              </button>
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="bg-slate-800 p-2 rounded-lg text-white shadow-md">
              <BookOpen size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">EduArticles Radar</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Filter className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <select 
                className="w-full pl-10 pr-8 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer" 
                value={selectedJournal} 
                onChange={(e) => setSelectedJournal(e.target.value)} 
                disabled={isLoading}
              >
                {journals.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500" 
                placeholder="Buscar por título o autor..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                disabled={isLoading} 
              />
            </div>
          </div>
        </div>
        {!isLoading && !error && (
          <div className="max-w-4xl mx-auto px-4 flex gap-6 border-b border-slate-200 overflow-x-auto text-sm font-bold pt-2">
            <button onClick={() => setViewMode('radar')} className={`pb-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'radar' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Clock size={16}/> Radar
            </button>
            <button onClick={() => setViewMode('historico')} className={`pb-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'historico' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <List size={16}/> Todo ({filteredArticles.length})
            </button>
            <button onClick={() => setViewMode('biogeo')} className={`pb-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'biogeo' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Leaf size={16}/> BioGeo ({articulosBioGeo.length})
            </button>
            <button onClick={() => setViewMode('fisqui')} className={`pb-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'fisqui' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Atom size={16}/> Fís/Quím ({articulosFisQui.length})
            </button>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
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
            {viewMode === 'radar' && (
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
            )}
            
            {viewMode === 'biogeo' && (
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
            )}
            
            {viewMode === 'fisqui' && (
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
            )}
            
            {viewMode === 'historico' && (
              <div className="space-y-4">
                <div className="mb-2 pl-1"><h2 className="text-lg font-bold text-slate-800">Listado completo</h2></div>
                {filteredArticles.map(a => <ArticleCard key={a.id} article={a}/>)}
                {filteredArticles.length === 0 && <div className="p-12 text-center bg-white border border-dashed rounded-xl text-slate-400 font-medium italic">No hay resultados.</div>}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
import React, { useState, useMemo, useEffect } from 'react';
import { Search, BookOpen, ArrowLeft, ExternalLink, Unlock, FileText, CheckCircle2, Copy, Filter, AlertCircle, Calendar, Clock, List, Leaf, Atom, Loader2, Languages, Info, X } from 'lucide-react';

const CORREO_ADMIN = "tu_correo@ejemplo.com"; 

const REVISTAS_ISSN = [
  "0022-4308", "1098-2736", "0036-8326", "1098-237X", "0157-244X", "1573-1898", 
  "0305-7267", "1940-4603", "0950-0693", "1464-5289", "0212-4521", "2174-6486", 
  "1516-7313", "1980-850X", "1697-011X", "1579-1513", "0214-4379", "2253-6663", 
  "1133-9837", "2013-2255", "1699-6712", "0002-7685", "1938-4211", "0021-9266", 
  "2157-6009", "0036-8555", "1089-9995", "2158-1428", "2332-6530", "0002-8312", 
  "1935-1011", "0141-1926", "1469-3518", "0007-0998", "2044-8279", "0007-1013", 
  "1467-8535", "0142-5692", "1465-3346", "0009-3920", "1467-8624", "0360-1315", 
  "1873-782X", "0361-476X", "0273-2297", "0885-2006", "0272-7757", "1557-3060", 
  "1557-3079", "0013-161X", "1552-3519", "0162-3737", "1935-1062", "1741-1432", 
  "1741-1440", "0895-9048", "1552-3896", "1040-726X", "1573-336X", "1747-938X", 
  "0013-189X", "1935-102X", "1492-3831", "0268-0939", "1464-5106", "0022-0663", 
  "1939-2176", "1934-5747", "1934-5739", "0022-4871", "1552-4698", "1050-8406", 
  "1532-7809", "1362-1688", "1477-0954", "0959-4752", "0034-0553", "1936-2722", 
  "0741-9325", "1538-4756", "0034-6543", "1935-1046", "0091-732X", "1935-1038", 
  "1088-8438", "1532-799X", "0038-0407", "1939-8573", "0742-051X", "0042-0859", 
  "1552-8340", "1931-7913"
].join("|");

const NOMBRES_REVISTAS = [
  { categoria: "Didáctica de las Ciencias (General)", lista: ["Journal of Research in Science Teaching (JRST)", "Science Education", "Research in Science Education", "Studies in Science Education", "International Journal of Science Education"] },
  { categoria: "Contexto Iberoamericano y Autonómico", lista: ["Enseñanza de las Ciencias", "Ciência & Educação", "Revista Eureka", "REEC", "Didáctica de las Ciencias Experimentales y Sociales", "Alambique", "REIRE", "Ciències"] },
  { categoria: "Especialidades: BioGeo y Laboratorio", lista: ["The American Biology Teacher", "Journal of Biological Education", "The Science Teacher", "Journal of Geoscience Education", "CourseSource", "Life Sciences Education"] },
  { categoria: "Investigación Educativa y Psicopedagogía", lista: [
    "American Educational Research Journal", "British Educational Research Journal", 
    "British Journal of Educational Psychology", "British Journal of Educational Technology", 
    "British Journal of Sociology of Education", "Child Development", "Computers and Education", 
    "Contemporary Educational Psychology", "Developmental Review", "Early Childhood Research Quarterly", 
    "Economics of Education Review", "Education Finance and Policy", "Educational Administration Quarterly", 
    "Educational Evaluation and Policy Analysis", "Educational Management Administration and Leadership", 
    "Educational Policy", "Educational Psychology Review", "Educational Research Review", "Educational Researcher", 
    "IRRODL (Open and Distance Learning)", "Journal of Education Policy", 
    "Journal of Educational Psychology", "Journal of Research on Educational Effectiveness", 
    "Journal of Teacher Education", "Journal of the Learning Sciences", "Language Teaching Research", 
    "Learning and Instruction", "Reading Research Quarterly", "Remedial and Special Education", 
    "Review of Educational Research", "Review of Research in Education", "Scientific Studies of Reading", 
    "Sociology of Education", "Teaching and Teacher Education", "Urban Education"
  ]}
];

const reconstruirAbstract = (invertedIndex) => {
  if (!invertedIndex) return "Resumen original no disponible en la base de datos abierta.";
  const words = [];
  try {
    Object.entries(invertedIndex).forEach(([word, positions]) => {
      positions.forEach(pos => { words[pos] = word; });
    });
    return words.filter(Boolean).join(" ");
  } catch (e) { return "Error al procesar el resumen."; }
};

const calcularDiasTranscurridos = (fecha) => {
  if (!fecha) return 999;
  const hoy = new Date();
  const fHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const [y, m, d] = fecha.split('-');
  const fPub = new Date(y, m - 1, d);
  return Math.floor((fHoy - fPub) / (1000 * 3600 * 24));
};

const BIO_GEO_KEYWORDS = ['\\bbiology\\b', '\\bbiología\\b', '\\bgeology\\b', '\\bgeología\\b', 'earth science', 'ciencias de la tierra', '\\becology\\b', '\\becología\\b', 'climate change', 'cambio climático', 'sustainability', 'sostenibilidad', 'nature-based', 'renaturalización'];
const FIS_QUI_KEYWORDS = ['\\bphysics\\b', '\\bfísica\\b', '\\bchemistry\\b', '\\bquímica\\b', 'thermodynamics', 'termodinámica', 'electromagnetism', 'quantum', 'chemical reaction', 'periodic table', 'energy', 'energía', 'forces', 'fuerzas', 'matter', 'materia'];

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
  const [showInfo, setShowInfo] = useState(false);

useEffect(() => {
    fetch(`https://api.openalex.org/works?filter=primary_location.source.issn:${REVISTAS_ISSN}&sort=publication_date:desc&per-page=200&mailto=${CORREO_ADMIN}&t=${Date.now()}`, {
      cache: 'no-store'
    })
      .then(res => res.json())
      .then(data => {
        const processed = data.results.map(w => ({
          id: w.id,
          title: w.title || "Sin título",
          journal: w.primary_location?.source?.display_name || "Revista desconocida",
          date: w.publication_date,
          authors: w.authorships?.map(a => a.author.display_name).join(", ") || "Varios autores",
          abstract: reconstruirAbstract(w.abstract_inverted_index),
          url: w.primary_location?.landing_page_url || w.doi,
          isOpen: !!w.primary_location?.is_oa
        }));
        setArticles(processed);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error al conectar con OpenAlex:", error);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => articles.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) || a.authors.some(au => au.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesJournal = selectedJournal === "Todas las revistas" || a.journal === selectedJournal;
    return matchesSearch && matchesJournal;
  }), [articles, searchTerm, selectedJournal]);

  const bioGeoList = useMemo(() => filtered.filter(a => BIO_GEO_KEYWORDS.some(k => new RegExp(k, 'i').test(`${a.title} ${a.abstract}`))), [filtered]);
  const fisQuiList = useMemo(() => filtered.filter(a => FIS_QUI_KEYWORDS.some(k => new RegExp(k, 'i').test(`${a.title} ${a.abstract}`))), [filtered]);
  const hoy = filtered.filter(a => a.dias <= 1);
  const semana = filtered.filter(a => a.dias > 1 && a.dias <= 7);

  const handleTranslate = (platform, text) => {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setTranslateFeedback(platform);
    setTimeout(() => setTranslateFeedback(null), 3000);
    const url = platform === 'deepl' ? `https://www.deepl.com/translator#en/es/${encodeURIComponent(text)}` : `https://www.softcatala.org/traductor/`;
    window.open(url, '_blank');
  };

  const copyObsidian = (a) => {
    const template = `---\ntipo: lectura\ntags: [didáctica]\nfecha: ${new Date().toISOString().split('T')[0]}\narchivo: "${a.url}"\n---\n# ${a.title.replace(/"/g, '\\"')}\n\n[Fuente](${a.url})\n\n> ${a.abstract}`;
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
    <div onClick={() => { setSelectedArticle(article); window.scrollTo(0,0); }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-400 cursor-pointer transition-all group">
      <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase">
        <span className="truncate">{article.journal}</span>
        <span className="text-slate-300 hidden sm:inline">•</span>
        <span>{article.date}</span>
        {article.isOpenAccess && <Unlock size={12} className="text-emerald-500" title="Acceso Abierto" />}
      </div>
      <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight mb-2">{article.title}</h2>
      <p className="text-sm text-slate-600 truncate font-medium">{article.authors.join(', ')}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* MODAL DE INFORMACIÓN */}
      {showInfo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 p-6 flex justify-between items-center z-10">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800"><Info className="text-blue-600"/> Acerca de EduPapers Radar</h2>
              <button onClick={() => setShowInfo(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"><X size={24}/></button>
            </div>
            <div className="p-6 sm:p-8 space-y-8">
              <section>
                <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">¿Cómo funciona?</h3>
                <p className="text-slate-600 leading-relaxed mb-4">Esta herramienta es un radar de <strong>vigilancia tecnológica y científica</strong> diseñado para la innovación y la práctica docente basada en evidencias. Se conecta en tiempo real a la base de datos abierta <em>OpenAlex</em>.</p>
                <ul className="space-y-3 text-sm text-slate-600 bg-slate-50 p-5 rounded-xl border border-slate-100">
                  <li className="flex gap-2"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> <span><strong>La Ventana de 200:</strong> El radar extrae siempre los 200 artículos más recientes. Cuando se publica algo nuevo, entra por arriba y lo más antiguo desaparece, evitando la sobrecarga de información (infoxicación).</span></li>
                  <li className="flex gap-2"><CheckCircle2 size={18} className="text-blue-500 shrink-0"/> <span><strong>Filtros Inteligentes:</strong> Las pestañas de BioGeo y Fís/Quím utilizan expresiones regulares (Regex) de alta precisión para aislar investigaciones de tu especialidad en un solo clic.</span></li>
                  <li className="flex gap-2"><CheckCircle2 size={18} className="text-purple-500 shrink-0"/> <span><strong>Integración y PKM:</strong> Puedes traducir abstracts enviándolos a DeepL o Softcatalà con el texto copiado automáticamente, o exportar la ficha completa en formato Markdown lista para tu bóveda de Obsidian.</span></li>
                </ul>
              </section>
              <section>
                <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">Revistas Indexadas (Selección Curada)</h3>
                <div className="grid sm:grid-cols-2 gap-6">
                  {NOMBRES_REVISTAS.map((grupo, i) => (
                    <div key={i}>
                      <h4 className="font-bold text-slate-700 mb-2 text-sm uppercase tracking-wide">{grupo.categoria}</h4>
                      <ul className="text-sm text-slate-600 space-y-1 list-disc pl-4 marker:text-slate-300">
                        {grupo.lista.map((revista, j) => <li key={j}>{revista}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="bg-slate-800 p-2.5 rounded-xl text-white shadow-md"><BookOpen size={22}/></div>
            <h1 className="text-xl font-bold tracking-tight">EduPapers Radar</h1>
            <button onClick={() => setShowInfo(true)} className="ml-2 text-slate-400 hover:text-blue-600 transition-colors" title="Información y revistas"><Info size={20}/></button>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <select className="bg-slate-100 border-none rounded-lg px-3 py-2 text-sm font-bold text-slate-600 cursor-pointer w-full md:w-auto truncate max-w-[180px]" value={selectedJournal} onChange={e => setSelectedJournal(e.target.value)}>
              {["Todas las revistas", ...new Set(articles.map(a => a.journal))].map(j => <option key={j} value={j}>{j}</option>)}
            </select>
            <input className="bg-slate-100 border-none rounded-lg px-4 py-2 text-sm font-medium flex-1 focus:ring-2 focus:ring-blue-500" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        {!isLoading && !error && !selectedArticle && (
          <div className="max-w-4xl mx-auto flex gap-6 mt-4 text-sm font-bold overflow-x-auto no-scrollbar pt-2">
            <button onClick={() => setViewMode('radar')} className={`pb-2 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'radar' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Clock size={16}/> Radar</button>
            <button onClick={() => setViewMode('historico')} className={`pb-2 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'historico' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><List size={16}/> Todo ({filtered.length})</button>
            <button onClick={() => setViewMode('biogeo')} className={`pb-2 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'biogeo' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Leaf size={16}/> BioGeo ({bioGeoList.length})</button>
            <button onClick={() => setViewMode('fisqui')} className={`pb-2 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${viewMode === 'fisqui' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Atom size={16}/> Fís/Quím ({fisQuiList.length})</button>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {selectedArticle ? (
          <div className="animate-in slide-in-from-bottom-4 duration-300">
            <button onClick={() => setSelectedArticle(null)} className="flex items-center gap-2 text-slate-500 mb-6 hover:text-blue-600 font-bold transition-colors"><ArrowLeft size={20} /> Volver al listado</button>
            <article className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-100">
                <div className="flex gap-2 mb-4 text-xs font-bold uppercase text-slate-400">
                  <span className="bg-slate-100 px-2 py-1 rounded text-slate-600">{selectedArticle.journal}</span><span className="py-1">{selectedArticle.date}</span>
                </div>
                <h1 className="text-2xl font-bold mb-4 leading-tight">{selectedArticle.title}</h1>
                <p className="text-slate-600 font-medium">{selectedArticle.authors.join(', ')}</p>
              </div>
              <div className="p-6 sm:p-8 bg-slate-50/50 relative">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Abstract Original</h3>
                  {!selectedArticle.abstract.includes("no disponible") && (
                    <div className="flex gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                      <button onClick={() => handleTranslate('deepl', selectedArticle.abstract)} className="px-3 py-1.5 text-xs font-bold hover:text-blue-600 flex items-center gap-1.5"><Languages size={14}/> DeepL (ES)</button>
                      <button onClick={() => handleTranslate('softcatala', selectedArticle.abstract)} className="px-3 py-1.5 text-xs font-bold border-l border-slate-100 hover:text-orange-600 flex items-center gap-1.5"><Languages size={14}/> Softcatalà (VA)</button>
                    </div>
                  )}
                </div>
                <p className="text-lg leading-relaxed text-slate-700">{selectedArticle.abstract}</p>
                {translateFeedback && <div className="absolute top-4 right-8 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold animate-bounce shadow-lg">¡Copiado! Pega el texto (Ctrl+V)</div>}
              </div>
              <div className="p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-4">
                <a href={selectedArticle.url} target="_blank" className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold text-center hover:bg-blue-700 transition-all shadow-md">Ir a la fuente original</a>
                <button onClick={() => copyObsidian(selectedArticle)} className={`flex-1 py-4 rounded-xl font-bold border transition-all ${copied ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white border-slate-200 hover:bg-slate-50"}`}>{copied ? "¡Copiado para Obsidian!" : "Exportar a Obsidian"}</button>
              </div>
            </article>
          </div>
        ) : isLoading ? (
          <div className="text-center py-20 text-slate-400 font-bold animate-pulse"><Loader2 className="mx-auto animate-spin mb-4" />Actualizando los últimos 200 artículos...</div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 font-bold">{error}</div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            {viewMode === 'radar' && (
              <>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Novedades de Hoy</h2>
                {hoy.length ? hoy.map(a => <ArticleCard key={a.id} article={a}/>) : <div className="p-10 text-center bg-white border border-dashed rounded-2xl text-slate-300 font-bold">Sin novedades en las últimas 24h</div>}
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-10 mb-4">Esta semana</h2>
                {semana.length ? semana.map(a => <ArticleCard key={a.id} article={a}/>) : <div className="p-10 text-center bg-white border border-dashed rounded-2xl text-slate-300 font-bold">Sin novedades en los últimos 7 días</div>}
              </>
            )}
            {viewMode === 'biogeo' && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl flex items-start gap-4 mb-2 shadow-sm">
                  <Leaf className="text-emerald-600 mt-1" />
                  <div><h2 className="font-bold text-emerald-900 text-lg">Especialidad: Biología y Geología</h2><p className="text-sm text-emerald-800 font-medium">Ciencias de la vida, de la tierra y proyectos de sostenibilidad.</p></div>
                </div>
                {bioGeoList.length ? bioGeoList.map(a => <ArticleCard key={a.id} article={a}/>) : <div className="p-10 text-center bg-white border border-dashed rounded-2xl text-slate-400 font-bold italic">No hay evidencias detectadas hoy.</div>}
              </div>
            )}
            {viewMode === 'fisqui' && (
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 p-5 rounded-xl flex items-start gap-4 mb-2 shadow-sm">
                  <Atom className="text-purple-600 mt-1" />
                  <div><h2 className="font-bold text-purple-900 text-lg">Especialidad: Física y Química</h2><p className="text-sm text-purple-800 font-medium">Leyes físicas, procesos químicos y didáctica de ciencias exactas.</p></div>
                </div>
                {fisQuiList.length ? fisQuiList.map(a => <ArticleCard key={a.id} article={a}/>) : <div className="p-10 text-center bg-white border border-dashed rounded-2xl text-slate-400 font-bold italic">No hay evidencias detectadas hoy.</div>}
              </div>
            )}
            {viewMode === 'historico' && (
              <div className="space-y-4">
                <div className="mb-2 pl-1"><h2 className="text-lg font-bold text-slate-800">Listado completo (Últimas 200 pub.)</h2></div>
                {filtered.map(a => <ArticleCard key={a.id} article={a}/>)}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
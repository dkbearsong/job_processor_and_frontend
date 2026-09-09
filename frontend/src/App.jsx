import { useState, useEffect } from 'react';
import { initSessionToken } from './api/axiosClient';
import { Briefcase, Settings, Database } from 'lucide-react';
import DataViewer from './components/DataViewer';

function App() {
  const [activeTab, setActiveTab] = useState('data_apply_queue');

  useEffect(() => {
    initSessionToken().catch(err => {
      console.error('Session token handshake error:', err);
    });
  }, []);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <header className="relative z-50 w-full max-w-[1400px] mb-8 flex items-center justify-between glass-card p-6 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-3 rounded-lg text-primary">
            <Briefcase size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Local Job Processor</h1>
            <p className="text-sm text-muted-foreground">Job tracking and database manager</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 relative group">
          <Settings size={20} className="text-muted-foreground cursor-pointer hover:text-white transition-colors" />
          <div className="absolute right-0 top-8 mt-2 w-72 p-4 glass-card rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div>
              <label className="block text-sm font-medium mb-1">Database Configuration</label>
              <p className="text-xs text-muted-foreground">
                Please configure your SQL database connection securely using the <code className="bg-muted px-1 py-0.5 rounded text-white">.env</code> file.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1400px] flex flex-col gap-6">
        <div className="glass-card p-4 rounded-xl relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent"></div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            <button 
              onClick={() => setActiveTab('data_apply_queue')}
              className={`pb-2 text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'data_apply_queue' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
            >
              <Database size={14} className="inline mr-1" /> Apply Queue
            </button>
            <button 
              onClick={() => setActiveTab('data_jobs_companies')}
              className={`pb-2 text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'data_jobs_companies' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
            >
              <Database size={14} className="inline mr-1" /> Jobs & Companies Data
            </button>
            <button 
              onClick={() => setActiveTab('data_jobs_by_date')}
              className={`pb-2 text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'data_jobs_by_date' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
            >
              <Database size={14} className="inline mr-1" /> Jobs By Date
            </button>
            <button 
              onClick={() => setActiveTab('data_cheap_llm_analysis')}
              className={`pb-2 text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'data_cheap_llm_analysis' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
            >
              <Database size={14} className="inline mr-1" /> Cheap LLM Analysis
            </button>
            <button 
              onClick={() => setActiveTab('data_strong_llm_analysis')}
              className={`pb-2 text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'data_strong_llm_analysis' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
            >
              <Database size={14} className="inline mr-1" /> Strong LLM Analysis
            </button>
                        <button 
              onClick={() => setActiveTab('data_jobs_applied')}
              className={`pb-2 text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'data_jobs_applied' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
            >
              <Database size={14} className="inline mr-1" /> Jobs Applied
            </button>
                        <button 
              onClick={() => setActiveTab('data_jobs_rejected_from')}
              className={`pb-2 text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'data_jobs_rejected_from' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-white'}`}
            >
              <Database size={14} className="inline mr-1" /> Jobs Rejected From
            </button>
          </div>
        </div>

        {activeTab === 'data_apply_queue' && (
          <div className="max-h-[650px] flex flex-col animate-fadeIn">
            <DataViewer queryName="apply_queue" tabName="Apply Queue" />
          </div>
        )}
        
        {activeTab === 'data_jobs_companies' && (
          <div className="max-h-[650px] flex flex-col animate-fadeIn">
            <DataViewer queryName="jobs_with_companies" tabName="Jobs & Companies Data" />
          </div>
        )}

        {activeTab === 'data_jobs_by_date' && (
          <div className="max-h-[650px] flex flex-col animate-fadeIn">
            <DataViewer queryName="jobs_by_date" tabName="Jobs by Date" />
          </div>
        )}

        {activeTab === 'data_cheap_llm_analysis' && (
          <div className="max-h-[650px] flex flex-col animate-fadeIn">
            <DataViewer queryName="cheap_llm_analysis" tabName="Cheap LLM Analysis" />
          </div>
        )}

        {activeTab === 'data_strong_llm_analysis' && (
          <div className="max-h-[650px] flex flex-col animate-fadeIn">
            <DataViewer queryName="strong_llm_analysis" tabName="Strong LLM Analysis" />
          </div>
        )}

        {activeTab === 'data_jobs_applied' && (
          <div className="max-h-[650px] flex flex-col animate-fadeIn">
            <DataViewer queryName="jobs_applied" tabName="Jobs Applied" />
          </div>
        )}

        {activeTab === 'data_jobs_rejected_from' && (
          <div className="max-h-[650px] flex flex-col animate-fadeIn">
            <DataViewer queryName="jobs_rejected_from" tabName="Jobs Rejected From" />
          </div>
        )}

      </main>
    </div>
  );
}

export default App;

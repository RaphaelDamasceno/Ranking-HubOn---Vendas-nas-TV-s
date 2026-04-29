import { useState, useEffect, type FormEvent } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { NumericFormat } from 'react-number-format';

const DIRECTORY_TREE: Record<string, string[]> = {
  'RIBEIRO': [
    'CHAMPIONS - CÉLIA AMARAL',
    'GOLDEN TEAM - FELIPE RIBEIRO',
    'BRAVO - ANDERSON LUIZ',
    'PRIME - RONDINELLI VALENÇA'
  ],
  'NASCIMENTO': [
    'GARRA - RODRIGO SANDERSON',
    'ALPHA TEAM - ROSANA BEATRIZ',
    'REINO - CARLOS ANDREY',
    'TORNADO - FRANCISCO VIEIRA',
    'ELITE - HEITOR MADRUGA'
  ],
  'MOURA': [
    'WINNERS - FÁBIO MOURA',
    'DOMUS - WILMA HELENA',
    'ARRETADOS - HUGO BORGES'
  ],
  'ALBUQUERQUE': [
    'DUBAI BROKERS - DENILSON ALBUQUERQUE',
    'GADE - WERICA ALBUQUERQUE',
    'SEALS - JORGE GUEDES'
  ]
};

export default function SaleForm() {
  const [brokerName, setBrokerName] = useState('');
  const [vgv, setVgv] = useState('');
  const [leader, setLeader] = useState('');
  const [director, setDirector] = useState('');
  const [traineeLeader, setTraineeLeader] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    setStatus('idle');

    try {
      await addDoc(collection(db, 'sales'), {
        brokerName,
        vgv: parseFloat(vgv),
        leader,
        director,
        ...(traineeLeader ? { traineeLeader } : {}),
        createdAt: serverTimestamp()
      });
      
      setStatus('success');
      setVgv('');
      // Keep broker, leader, director for convenience to avoid re-typing
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sales');
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'success') {
    return (
      <div className="w-full max-w-xl mx-auto p-8 bg-white sm:rounded-[40px] sm:shadow-2xl flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-green-100">
          <CheckCircle2 size={48} className="text-white" />
        </div>
        <h2 className="text-3xl font-black text-brand-dark uppercase tracking-tighter mb-2">Venda Registrada!</h2>
        <p className="text-slate-500 font-bold mb-8">Sua venda já está aparecendo em tempo real no dashboard do hub.</p>
        <button 
          onClick={() => setStatus('idle')}
          className="bg-brand-dark text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brand-blue transition-all active:scale-95 shadow-lg"
        >
          Registrar Outra Venda
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto p-4 sm:p-8 bg-white sm:rounded-[40px] sm:shadow-2xl sm:border-t-[12px] border-brand-blue relative overflow-hidden">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-brand-dark uppercase tracking-tighter">
            Nova Venda
          </h2>
          <p className="text-brand-blue text-[10px] font-black uppercase tracking-[0.4em]">
            HUB NOGUEIRA
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">VGV (Valor)</label>
          <NumericFormat
            required
            value={vgv}
            onValueChange={(values) => setVgv(values.value)}
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
            decimalScale={2}
            fixedDecimalScale
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-bold text-brand-dark placeholder:text-slate-300"
            placeholder="Ex: R$ 250.000,00"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Corretor</label>
          <input
            required
            type="text"
            value={brokerName}
            onChange={(e) => setBrokerName(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-bold text-brand-dark placeholder:text-slate-300"
            placeholder="Seu nome completo"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Diretor</label>
            <div className="relative">
              <select
                required
                value={director}
                onChange={(e) => {
                  setDirector(e.target.value);
                  setLeader(''); // Reset leader when director changes
                }}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-bold text-brand-dark appearance-none"
              >
                <option value="">Selecione...</option>
                {Object.keys(DIRECTORY_TREE).map((dir) => (
                  <option key={dir} value={dir}>{dir}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Líder</label>
            <div className="relative">
              <select
                required
                value={leader}
                onChange={(e) => setLeader(e.target.value)}
                disabled={!director}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-bold text-brand-dark appearance-none disabled:opacity-50"
              >
                <option value="">Selecione...</option>
                {director && DIRECTORY_TREE[director]?.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 font-bold">Líder Trainee (Opcional)</label>
            <input
              type="text"
              value={traineeLeader}
              onChange={(e) => setTraineeLeader(e.target.value)}
              className="w-full bg-orange-50/30 border-2 border-orange-100/50 rounded-2xl px-6 py-4 focus:border-orange-200 focus:ring-0 transition-all outline-none font-bold text-brand-dark placeholder:text-slate-300"
              placeholder="Nome do líder trainee"
            />
          </div>
        </div>

        <button
          disabled={isSubmitting}
          type="submit"
          className={cn(
            "w-full font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
            status === 'success' ? "bg-green-500 text-white shadow-green-100" : "bg-brand-blue text-white shadow-blue-100 hover:bg-blue-700"
          )}
        >
          {isSubmitting ? (
            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
          ) : status === 'success' ? (
            <>
              <CheckCircle2 />
              VENDA REGISTRADA!
            </>
          ) : status === 'error' ? (
            <>
              <AlertCircle />
              ERRO AO SALVAR
            </>
          ) : (
            <>
              <Send size={18} />
              REGISTRAR VENDA
            </>
          )}
        </button>
      </form>
    </div>
  );
}

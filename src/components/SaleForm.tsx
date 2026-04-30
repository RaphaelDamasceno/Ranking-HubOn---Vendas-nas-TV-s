import { useState, useEffect, type FormEvent } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { NumericFormat } from 'react-number-format';
import { motion, AnimatePresence } from 'motion/react';

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
  
  // Partner state
  const [numPartners, setNumPartners] = useState(0); 
  const [isLeaderSale, setIsLeaderSale] = useState(false);
  
  // Partner 1
  const [partnerName, setPartnerName] = useState('');
  const [partnerLeader, setPartnerLeader] = useState('');
  const [partnerDirector, setPartnerDirector] = useState('');
  const [partnerTraineeLeader, setPartnerTraineeLeader] = useState('');

  // Partner 2
  const [partner2Name, setPartner2Name] = useState('');
  const [partner2Leader, setPartner2Leader] = useState('');
  const [partner2Director, setPartner2Director] = useState('');
  const [partner2TraineeLeader, setPartner2TraineeLeader] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    setStatus('idle');

    try {
      const vgvValue = parseFloat(vgv);
      const denominator = 1 + numPartners;
      const finalVgv = vgvValue / denominator;
      
      const partnerList = [];
      if (numPartners >= 1) partnerList.push(partnerName);
      if (numPartners >= 2) partnerList.push(partner2Name);
      
      const commonData = {
        createdAt: serverTimestamp(),
        isShared: numPartners > 0,
        isLeaderSale: isLeaderSale,
        originalVgv: vgvValue,
        partnershipCount: denominator
      };

      // Helper function to build partner names for a specific participant
      const getPartnersFor = (name: string) => {
        const others = [brokerName, partnerName, partner2Name]
          .filter(n => n !== name && n !== '')
          .slice(0, numPartners);
        return others.join(' & ') || null;
      };

      // Save first broker
      await addDoc(collection(db, 'sales'), {
        ...commonData,
        brokerName,
        vgv: finalVgv,
        leader,
        director,
        ...(traineeLeader ? { traineeLeader } : {}),
        partnerName: getPartnersFor(brokerName)
      });

      // Save partner 1 broker if shared
      if (numPartners >= 1) {
        await addDoc(collection(db, 'sales'), {
          ...commonData,
          brokerName: partnerName,
          vgv: finalVgv,
          leader: partnerLeader,
          director: partnerDirector,
          ...(partnerTraineeLeader ? { traineeLeader: partnerTraineeLeader } : {}),
          partnerName: getPartnersFor(partnerName)
        });
      }

      // Save partner 2 broker if shared with 3 people
      if (numPartners >= 2) {
        await addDoc(collection(db, 'sales'), {
          ...commonData,
          brokerName: partner2Name,
          vgv: finalVgv,
          leader: partner2Leader,
          director: partner2Director,
          ...(partner2TraineeLeader ? { traineeLeader: partner2TraineeLeader } : {}),
          partnerName: getPartnersFor(partner2Name)
        });
      }
      
      setStatus('success');
      setVgv('');
      setNumPartners(0);
      setIsLeaderSale(false);
      setPartnerName('');
      setPartnerLeader('');
      setPartnerDirector('');
      setPartnerTraineeLeader('');
      setPartner2Name('');
      setPartner2Leader('');
      setPartner2Director('');
      setPartner2TraineeLeader('');
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
        <h2 className="text-3xl font-medium text-brand-dark uppercase tracking-tighter mb-2">Venda Registrada!</h2>
        <p className="text-slate-500 font-medium mb-8">Sua venda já está aparecendo em tempo real no dashboard do hub.</p>
        <button 
          onClick={() => setStatus('idle')}
          className="bg-brand-dark text-white px-8 py-4 rounded-2xl font-medium uppercase tracking-widest text-xs hover:bg-brand-blue transition-all active:scale-95 shadow-lg"
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
          <h2 className="text-2xl sm:text-3xl font-medium text-brand-dark uppercase tracking-tighter">
            Nova Venda
          </h2>
          <p className="text-brand-blue text-[10px] font-medium uppercase tracking-[0.4em]">
            HUB NOGUEIRA
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2">VGV (Valor)</label>
          <NumericFormat
            required
            value={vgv}
            onValueChange={(values) => setVgv(values.value)}
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
            decimalScale={2}
            fixedDecimalScale
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-medium text-brand-dark placeholder:text-slate-300"
            placeholder="Ex: R$ 250.000,00"
          />
          {numPartners > 0 && vgv && (
            <p className="text-[10px] font-medium text-brand-blue mt-1 ml-2 uppercase tracking-widest animate-pulse">
              Cada corretor receberá: {(parseFloat(vgv) / (1 + numPartners)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2">Corretor</label>
          <input
            required
            type="text"
            value={brokerName}
            onChange={(e) => setBrokerName(e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-medium text-brand-dark placeholder:text-slate-300"
            placeholder="Seu nome completo"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2">Diretor</label>
            <div className="relative">
              <select
                required
                value={director}
                onChange={(e) => {
                  setDirector(e.target.value);
                  setLeader(''); // Reset leader when director changes
                }}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-medium text-brand-dark appearance-none"
              >
                <option value="">Selecione...</option>
                {Object.keys(DIRECTORY_TREE).map((dir) => (
                  <option key={dir} value={dir}>{dir}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2">Líder</label>
            <div className="relative">
              <select
                required
                value={leader}
                onChange={(e) => setLeader(e.target.value)}
                disabled={!director}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-medium text-brand-dark appearance-none disabled:opacity-50"
              >
                <option value="">Selecione...</option>
                {director && DIRECTORY_TREE[director]?.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2 font-medium">Líder Trainee (Opcional)</label>
            <input
              type="text"
              value={traineeLeader}
              onChange={(e) => setTraineeLeader(e.target.value)}
              className="w-full bg-orange-50/30 border-2 border-orange-100/50 rounded-2xl px-6 py-4 focus:border-orange-200 focus:ring-0 transition-all outline-none font-medium text-brand-dark placeholder:text-slate-300"
              placeholder="Nome do líder trainee"
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2">Tipo de Participação</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 0, label: 'Individual' },
                { val: 1, label: 'Dupla (50%)' },
                { val: 2, label: 'Trio (33%)' }
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setNumPartners(opt.val)}
                  className={cn(
                    "py-2 rounded-xl text-[10px] font-medium uppercase tracking-widest border-2 transition-all",
                    numPartners === opt.val 
                      ? "bg-brand-blue border-brand-blue text-white shadow-md" 
                      : "bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer group pt-2">
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isLeaderSale ? 'bg-amber-500' : 'bg-slate-200'}`}>
              <motion.div 
                animate={{ x: isLeaderSale ? 24 : 0 }}
                className="w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </div>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={isLeaderSale} 
              onChange={(e) => setIsLeaderSale(e.target.checked)} 
            />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-600 uppercase tracking-widest group-hover:text-amber-500 transition-colors">Venda de Líder (Gestão)</span>
              <span className="text-[9px] text-slate-400 uppercase">Não aparecerá nos rankings individuais (Série A/B)</span>
            </div>
          </label>
        </div>

        <AnimatePresence>
          {numPartners >= 1 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-4 pt-4"
            >
              <div className="p-6 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 space-y-6">
                <p className="text-[10px] font-medium text-brand-blue uppercase tracking-[0.4em] text-center italic">Dados do Parceiro 01</p>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2">Nome do Parceiro</label>
                  <input
                    required={numPartners >= 1}
                    type="text"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-medium text-brand-dark placeholder:text-slate-200"
                    placeholder="Nome do corretor parceiro"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2">Diretor Parceiro</label>
                    <div className="relative">
                      <select
                        required={numPartners >= 1}
                        value={partnerDirector}
                        onChange={(e) => {
                          setPartnerDirector(e.target.value);
                          setPartnerLeader('');
                        }}
                        className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-medium text-brand-dark appearance-none"
                      >
                        <option value="">Selecione...</option>
                        {Object.keys(DIRECTORY_TREE).map((dir) => (
                          <option key={dir} value={dir}>{dir}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2">Líder Parceiro</label>
                    <div className="relative">
                      <select
                        required={numPartners >= 1}
                        value={partnerLeader}
                        onChange={(e) => setPartnerLeader(e.target.value)}
                        disabled={!partnerDirector}
                        className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-medium text-brand-dark appearance-none disabled:opacity-50"
                      >
                        <option value="">Selecione...</option>
                        {partnerDirector && DIRECTORY_TREE[partnerDirector]?.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2 font-medium">Líder Trainee Parceiro (Op)</label>
                  <input
                    type="text"
                    value={partnerTraineeLeader}
                    onChange={(e) => setPartnerTraineeLeader(e.target.value)}
                    className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-orange-200 focus:ring-0 transition-all outline-none font-medium text-brand-dark placeholder:text-slate-200"
                    placeholder="Líder trainee do parceiro"
                  />
                </div>
              </div>

              {numPartners >= 2 && (
                <div className="p-6 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 space-y-6">
                  <p className="text-[10px] font-medium text-brand-blue uppercase tracking-[0.4em] text-center italic">Dados do Parceiro 02</p>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2">Nome do Parceiro 2</label>
                    <input
                      required={numPartners >= 2}
                      type="text"
                      value={partner2Name}
                      onChange={(e) => setPartner2Name(e.target.value)}
                      className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-medium text-brand-dark placeholder:text-slate-200"
                      placeholder="Nome do segundo parceiro"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2">Diretor Parceiro 2</label>
                      <div className="relative">
                        <select
                          required={numPartners >= 2}
                          value={partner2Director}
                          onChange={(e) => {
                            setPartner2Director(e.target.value);
                            setPartner2Leader('');
                          }}
                          className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-medium text-brand-dark appearance-none"
                        >
                          <option value="">Selecione...</option>
                          {Object.keys(DIRECTORY_TREE).map((dir) => (
                            <option key={dir} value={dir}>{dir}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2">Líder Parceiro 2</label>
                      <div className="relative">
                        <select
                          required={numPartners >= 2}
                          value={partner2Leader}
                          onChange={(e) => setPartner2Leader(e.target.value)}
                          disabled={!partner2Director}
                          className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-brand-blue focus:ring-0 transition-all outline-none font-medium text-brand-dark appearance-none disabled:opacity-50"
                        >
                          <option value="">Selecione...</option>
                          {partner2Director && DIRECTORY_TREE[partner2Director]?.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-2 font-medium">Líder Trainee Parceiro 2 (Op)</label>
                    <input
                      type="text"
                      value={partner2TraineeLeader}
                      onChange={(e) => setPartner2TraineeLeader(e.target.value)}
                      className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 focus:border-orange-200 focus:ring-0 transition-all outline-none font-medium text-brand-dark placeholder:text-slate-200"
                      placeholder="Líder trainee do segundo parceiro"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          disabled={isSubmitting}
          type="submit"
          className={cn(
            "w-full font-medium py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
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

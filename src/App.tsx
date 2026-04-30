/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Triggering a new build to resolve deployment policy constraints.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Target, TrendingUp, Calendar, Medal, Award, Star, FormInput, LayoutDashboard, QrCode, ArrowUp, ArrowDown, Minus, ArrowLeft, Trash2, Crown, Settings, Download, Edit3, X, Save, BarChart3, Users } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, getDocs, writeBatch, doc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { animate } from 'motion';
import { QRCodeSVG } from 'qrcode.react';
import SaleForm from './components/SaleForm';
import * as XLSX from 'xlsx';

function Counter({ value, className }: { value: number; className?: string }) {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const controls = animate(
      parseInt(node.textContent?.replace(/[^\d]/g, '') || '0'), 
      value, 
      {
        duration: 2,
        ease: 'easeOut',
        onUpdate(latest) {
          node.textContent = latest.toLocaleString('pt-BR', { 
            style: 'currency', 
            currency: 'BRL', 
            maximumFractionDigits: 0 
          });
        }
      }
    );

    return () => controls.stop();
  }, [value]);

  return <span ref={nodeRef} className={className} />;
}

type ViewMode = 'ranking' | 'form' | 'series-a' | 'series-b' | 'ranking-directorate' | 'ranking-leader' | 'ranking-trainee-leader' | 'management';

interface Sale {
  id?: string;
  vgv: number;
  brokerName: string;
  leader: string;
  director: string;
  traineeLeader?: string;
  createdAt?: any;
  isShared?: boolean;
  originalVgv?: number;
  partnerName?: string;
  isLeaderSale?: boolean;
  partnershipCount?: number;
}

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('ranking');
  const [secondaryIndex, setSecondaryIndex] = useState(0);
  const [useMockData, setUseMockData] = useState(false);
  const [ranking, setRanking] = useState<any[]>([]);
  const [prevRanking, setPrevRanking] = useState<any[]>([]);
  const [directorateRanking, setDirectorateRanking] = useState<any[]>([]);
  const [leaderRanking, setLeaderRanking] = useState<any[]>([]);
  const [traineeLeaderRanking, setTraineeLeaderRanking] = useState<any[]>([]);
  const [totalAgendamentos, setTotalAgendamentos] = useState(0);
  const [totalVgvSum, setTotalVgvSum] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<{ id: string; text: string; type: 'rank' | 'meta' }[]>([]);
  const achievedTiersRef = useRef<Record<string, string[]>>({});
  const knownSaleIdsRef = useRef<Set<string>>(new Set());
  const [lastNotification, setLastNotification] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [marketNews, setMarketNews] = useState<string[]>([
    "MERCADO IMOBILIÁRIO: TENDÊNCIAS PARA O PRÓXIMO TRIMESTRE",
    "VALORIZAÇÃO DE IMÓVEIS SUPERA INFLAÇÃO NO ANO",
    "NOVOS EMPREENDIMENTOS SUSTENTÁVEIS GANHAM ESPAÇO",
    "JUROS DO FINANCIAMENTO IMOBILIÁRIO APRESENTAM ESTABILIDADE",
    "TECNOLOGIA NO MERCADO IMOBILIÁRIO: O FUTURO JÁ CHEGOU"
  ]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return;
        
        const genAI = new GoogleGenAI({ apiKey });
        
        const responseList = await genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: "Gere 10 manchetes curtíssimas (máximo 8 palavras cada) sobre o mercado imobiliário brasileiro atual para um ticker de notícias de TV. Retorne apenas um array JSON de strings. Evite caracteres especiais complexos.",
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        });
        
        if (responseList.text) {
          const news = JSON.parse(responseList.text);
          if (Array.isArray(news)) {
            setMarketNews(news.map(n => n.toUpperCase()));
          }
        }
      } catch (e: any) {
        // Silently fail for API issues to avoid console spam, keep using fallback/prev news
        // This covers both 429 (quota) and intermittent 500/Rpc errors
        console.warn("AI News: Service temporary unavailable or quota reached. News ticker will use previous/fallback data.");
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 15 * 60 * 1000); // 15 min
    return () => clearInterval(interval);
  }, []);

  const playSuccessSound = () => {
    try {
      // Usando o link direto transformado do Dropbox
      const soundUrl = 'https://www.dropbox.com/scl/fi/fpxnav712so29jzfz6ywc/freesound_community-decidemp3-14575.mp3?rlkey=2srjtwpmq91kmmxvvkkd3ptgt&e=2&st=kb5tg1lh&raw=1';
      const audio = new Audio(soundUrl);
      
      console.log("🔊 DEBUG: Tentando tocar o som do Dropbox...");
      
      audio.volume = 1.0;
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log("✅ DEBUG: Som reproduzido com sucesso!");
        }).catch(e => {
          console.warn("⚠️ DEBUG: Som bloqueado pelo navegador. Clique na tela uma vez.", e);
        });
      }
    } catch (err) {
      console.error("❌ DEBUG: Erro ao tentar tocar áudio:", err);
    }
  };

  useEffect(() => {
    // Desbloqueia o áudio em qualquer interação do usuário na página
    const unlock = () => {
      const audio = new Audio('https://www.dropbox.com/scl/fi/fpxnav712so29jzfz6ywc/freesound_community-decidemp3-14575.mp3?rlkey=2srjtwpmq91kmmxvvkkd3ptgt&e=2&st=kb5tg1lh&raw=1');
      audio.volume = 0;
      audio.play().then(() => {
        audio.pause();
        console.log("🔓 DEBUG: Áudio do sistema desbloqueado!");
      }).catch(() => {});
      
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  const addNotification = (text: string, type: 'rank' | 'meta') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [{ id, text, type }, ...prev].slice(0, 5));
    
    // Removido o playSuccessSound daqui para não tocar em cada mudança de ranking
    
    // Also set as last highlight for sidebar
    setLastNotification(text);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 8000);
  };
  const [newBooking, setNewBooking] = useState<any>(null);
  const metaEvento = 5000;

  const MOCK_BROKERS = [
    { brokerName: 'Ricardo Silva', leader: 'Marcos', director: 'Ribeiro', vgv: 1250000 },
    { brokerName: 'Ana Paula', leader: 'Juliana', director: 'Ribeiro', vgv: 980000 },
    { brokerName: 'Fernanda Lima', leader: 'Marcos', director: 'Ribeiro', vgv: 850000 },
    { brokerName: 'Bruno Gomes', leader: 'Juliana', director: 'Fama', vgv: 720000 },
    { brokerName: 'Thiago Souza', leader: 'Pedro', director: 'Fama', vgv: 680000 },
    { brokerName: 'Carla Dias', leader: 'Marcos', director: 'Ribeiro', vgv: 590000 },
    { brokerName: 'Gabriel Monte', leader: 'Juliana', director: 'Elite', vgv: 540000 },
    { brokerName: 'Lucas Ferreira', leader: 'Pedro', director: 'Elite', vgv: 510000 },
    { brokerName: 'Mariana Costa', leader: 'Juliana', director: 'Fama', vgv: 480000 },
    { brokerName: 'Rafael Bento', leader: 'Pedro', director: 'Fama', vgv: 420000 },
    { brokerName: 'Julio Cesar', leader: 'Marcos', director: 'Ribeiro', vgv: 390000 },
    { brokerName: 'Sophia Loren', leader: 'Juliana', director: 'Ribeiro', vgv: 350000 },
    { brokerName: 'Igor Santos', leader: 'Pedro', director: 'Elite', vgv: 320000 },
    { brokerName: 'Patricia Araujo', leader: 'Marcos', director: 'Fama', vgv: 310000 },
    { brokerName: 'Hugo Boss', leader: 'Pedro', director: 'Ribeiro', vgv: 280000 },
    { brokerName: 'Vitoria Regia', leader: 'Juliana', director: 'Fama', vgv: 250000 },
    { brokerName: 'Caio Castro', leader: 'Marcos', director: 'Elite', vgv: 220000 },
    { brokerName: 'Bia Haddad', leader: 'Juliana', director: 'Ribeiro', vgv: 210000 },
    { brokerName: 'Danilo Gentili', leader: 'Pedro', director: 'Fama', vgv: 190000 },
    { brokerName: 'Erika Januza', leader: 'Marcos', director: 'Elite', vgv: 180000 },
    { brokerName: 'Fabio Porchat', leader: 'Pedro', director: 'Fama', vgv: 170000 },
    { brokerName: 'Gisele Bundchen', leader: 'Juliana', director: 'Elite', vgv: 650000 },
    { brokerName: 'Zico Galinho', leader: 'Marcos', director: 'Fama', vgv: 150000 },
    { brokerName: 'Marta Silva', leader: 'Pedro', director: 'Ribeiro', vgv: 140000 },
    { brokerName: 'Neymar Jr', leader: 'Juliana', director: 'Elite', vgv: 130000 },
    { brokerName: 'Felipe Massa', leader: 'Marcos', director: 'Ribeiro', vgv: 120000 },
    { brokerName: 'Rubens Barrichello', leader: 'Pedro', director: 'Fama', vgv: 110000 },
    { brokerName: 'Ayrton Senna', leader: 'Juliana', director: 'Elite', vgv: 2550000 },
    { brokerName: 'Pele Rei', leader: 'Marcos', director: 'Fama', vgv: 2150000 },
    { brokerName: 'Ronaldo Fenomeno', leader: 'Pedro', director: 'Ribeiro', vgv: 1950000 },
    { brokerName: 'Romario Baixinho', leader: 'Juliana', director: 'Elite', vgv: 1850000 },
    { brokerName: 'Zidane Magnifico', leader: 'Marcos', director: 'Fama', vgv: 1750000 },
    { brokerName: 'Ronaldinho Gaucho', leader: 'Pedro', director: 'Ribeiro', vgv: 1650000 },
    { brokerName: 'Kaka Elegante', leader: 'Juliana', director: 'Elite', vgv: 1550000 },
    { brokerName: 'Rivellino Elastico', leader: 'Marcos', director: 'Fama', vgv: 1450000 },
    { brokerName: 'Tostao Sabio', leader: 'Pedro', director: 'Ribeiro', vgv: 1350000 },
    { brokerName: 'Jairzinho Furacao', leader: 'Juliana', director: 'Elite', vgv: 1250000 },
    { brokerName: 'Gerson Canhota', leader: 'Marcos', director: 'Fama', vgv: 1150000 },
    { brokerName: 'Carlos Alberto Capitao', leader: 'Pedro', director: 'Ribeiro', vgv: 1050000 },
    { brokerName: 'Claudio Taffarel', leader: 'Juliana', director: 'Elite', vgv: 950000 },
  ];
  
  // Use a ref to track the previous count without triggering useEffect re-runs
  const prevCountRef = useRef(0);
  const isInitialLoad = useRef(true);

  // Simple simple routing check for URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'form') {
      setViewMode('form');
    }
  }, []);

  const exportToExcel = () => {
    const dataToExport = allSales.map(sale => ({
      'Consultor': sale.brokerName,
      'Líder': sale.leader,
      'Líder Trainee': sale.traineeLeader || '---',
      'Diretoria': sale.director,
      'VGV (R$)': sale.vgv,
      'Data': sale.createdAt ? new Date(sale.createdAt.seconds * 1000).toLocaleString('pt-BR') : '---'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendas');
    XLSX.writeFile(workbook, `Vendas_Nascimento_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const updateSale = async (id: string, updates: Partial<Sale>) => {
    try {
      await updateDoc(doc(db, 'sales', id), updates);
      setEditingSaleId(null);
      addNotification('Venda atualizada!', 'rank');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sales/${id}`);
    }
  };

  const deleteSale = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sales', id));
      addNotification('Venda excluída!', 'rank');
      setConfirmingDeleteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sales/${id}`);
    }
  };

  const importInitialData = async () => {
    try {
      const data = [
        "NASCIMENTO:ALPHA TEAM - ROSANA BEATRIZ:233.900,00:Luís Gustavo Coelho Chaprão",
        "NASCIMENTO:ALPHA TEAM - ROSANA BEATRIZ:215.000,00:Maria Clara Bezerra da Silva",
        "NASCIMENTO:ALPHA TEAM - ROSANA BEATRIZ:225.900,00:Kaline Aparecida Rodrigues Chaves",
        "RIBEIRO:BRAVO - ANDERSON LUIZ:359.900,00:Emily Caroline da Silva Martins",
        "RIBEIRO:BRAVO - ANDERSON LUIZ:322.700,00:Rebeccka Phaelante de Araújo",
        "RIBEIRO:BRAVO - ANDERSON LUIZ:280.000,00:Luciano José Ferreira",
        "RIBEIRO:BRAVO - ANDERSON LUIZ:1.775.000,00:Rebeccka Phaelante de Araújo",
        "RIBEIRO:BRAVO - ANDERSON LUIZ:260.000,00:Katarina Maria da Silva",
        "RIBEIRO:BRAVO - ANDERSON LUIZ:245.000,00:Katarina Maria da Silva",
        "RIBEIRO:BRAVO - ANDERSON LUIZ:229.990,00:Katarina Maria da Silva",
        "RIBEIRO:BRAVO - ANDERSON LUIZ:475.000,00:Guilherme Carvalho Silva",
        "RIBEIRO:BRAVO - ANDERSON LUIZ:224.990,00:Katarina Maria da Silva",
        "MOURA:DOMUS - WILMA HELENA:312.070,00:Roseane Pasini Fetzner",
        "ALBUQUERQUE:DUBAI BROKERS - DENILSON ALBUQUERQUE:1.280.000,00:Sergio Guedes Braga",
        "ALBUQUERQUE:DUBAI BROKERS - DENILSON ALBUQUERQUE:1.125.000,00:Edvaldo Sebastião de Morais Junior",
        "ALBUQUERQUE:DUBAI BROKERS - DENILSON ALBUQUERQUE:3.200.000,00:Italo Santos de Souza",
        "ALBUQUERQUE:DUBAI BROKERS - DENILSON ALBUQUERQUE:311.918,00:Edvaldo Sebastião de Morais Junior",
        "ALBUQUERQUE:DUBAI BROKERS - DENILSON ALBUQUERQUE:314.793,00:Edvaldo Sebastião de Morais Junior",
        "ALBUQUERQUE:DUBAI BROKERS - DENILSON ALBUQUERQUE:309.000,00:Edvaldo Sebastião de Morais Junior",
        "NASCIMENTO:ELITE - HEITOR MADRUGA:1.882.000,00:André Luis de Santana Chaves",
        "ALBUQUERQUE:GADE - WERICA ALBUQUERQUE:243.900,00:levi carlos lima da silva",
        "ALBUQUERQUE:GADE - WERICA ALBUQUERQUE:353.000,00:Alyson Anthony da Silva Bezerra",
        "ALBUQUERQUE:GADE - WERICA ALBUQUERQUE:244.529,00:levi carlos lima da silva",
        "ALBUQUERQUE:GADE - WERICA ALBUQUERQUE:315.942,00:Werica Albuquerque",
        "ALBUQUERQUE:GADE - WERICA ALBUQUERQUE:795.440,00:Werica Albuquerque",
        "NASCIMENTO:GARRA - RODRIGO SANDERSON:222.990,00:Danilo Moraes Marques",
        "NASCIMENTO:GARRA - RODRIGO SANDERSON:212.100,00:Ana Claudia Lima de Oliveira dos Santos",
        "NASCIMENTO:GARRA - RODRIGO SANDERSON:222.000,00:Wilson da Silva de Lima",
        "NASCIMENTO:GARRA - RODRIGO SANDERSON:236.900,00:Geraldo Anderson do Nascimento",
        "NASCIMENTO:GARRA - RODRIGO SANDERSON:245.000,00:Geraldo Anderson do Nascimento",
        "NASCIMENTO:GARRA - RODRIGO SANDERSON:233.900,00:Wilson da Silva de Lima",
        "NASCIMENTO:GARRA - RODRIGO SANDERSON:241.900,00:Noara Pereira de Souza",
        "NASCIMENTO:GARRA - RODRIGO SANDERSON:228.900,00:Noara Pereira de Souza",
        "NASCIMENTO:GARRA - RODRIGO SANDERSON:217.000,00:Noara Pereira de Souza",
        "RIBEIRO:GOLDEN TEAM - FELIPE RIBEIRO:330.000,00:Camila Vitória Gomes Cavalcanti",
        "RIBEIRO:GOLDEN TEAM - FELIPE RIBEIRO:311.918,00:Djair Agostinhos dos Santos",
        "RIBEIRO:GOLDEN TEAM - FELIPE RIBEIRO:241.900,00:Caio César Chagas Fraga de Lima",
        "RIBEIRO:GOLDEN TEAM - FELIPE RIBEIRO:313.068,00:Djair Agostinhos dos Santos",
        "NASCIMENTO:REINO - CARLOS ANDREY:1.126.930,00:Carlos Andrey Macedo Ribeiro",
        "ALBUQUERQUE:SEALS - JORGE GUEDES:1.125.000,00:Jorge Fernandes Guedes Neto",
        "NASCIMENTO:TORNADO - FRANCISCO VIEIRA:385.500,00:Juvanete Moura Silva",
        "NASCIMENTO:TORNADO - FRANCISCO VIEIRA:309.400,00:Juvanete Moura Silva",
        "NASCIMENTO:TORNADO - FRANCISCO VIEIRA:351.700,00:Edson Luiz Américo Branco",
        "NASCIMENTO:TORNADO - FRANCISCO VIEIRA:267.500,00:Marcelo Francisco Coelho Nunes",
        "MOURA:WINNERS - FÁBIO MOURA:384.500,00:Gerlane Andresa de Lima",
        "MOURA:WINNERS - FÁBIO MOURA:266.000,00:Aline de Castro",
        "MOURA:WINNERS - FÁBIO MOURA:1.825.000,00:Fabio Fernando de Moura Nascimento",
        "MOURA:WINNERS - FÁBIO MOURA:2.300.000,00:Kamylla de Brito Silva"
      ];

      const batch = writeBatch(db);
      const salesCol = collection(db, 'sales');
      
      data.forEach(line => {
        const parts = line.split(':');
        if (parts.length < 4) return;
        const director = parts[0].trim();
        const leader = parts[1].trim();
        const valueStr = parts[2].trim();
        const brokerName = parts[3].trim();
        const vgv = parseFloat(valueStr.replace(/\./g, '').replace(',', '.'));
        
        if (!isNaN(vgv)) {
          batch.set(doc(salesCol), {
            director, leader, vgv, brokerName,
            createdAt: serverTimestamp()
          });
        }
      });
      
      await batch.commit();
      localStorage.removeItem('nascimento_data_cleared');
      addNotification("✅ Base de dados real importada!", 'rank');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sales-batch');
    }
  };

  const clearAllSales = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 5000); // Reset after 5s
      return;
    }
    
    setIsCleaning(true);
    try {
      const salesSnap = await getDocs(collection(db, 'sales'));
      if (salesSnap.empty) {
        console.log('Nenhuma venda para limpar.');
        setConfirmClear(false);
        return;
      }
      
      const batch = writeBatch(db);
      salesSnap.docs.forEach((d) => {
        batch.delete(doc(db, 'sales', d.id));
      });
      await batch.commit();
      
      localStorage.setItem('nascimento_data_cleared', 'true');
      console.log('Tabela de vendas limpa com sucesso!');
      setConfirmClear(false);
      achievedTiersRef.current = {}; // Reset achievements
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'sales');
    } finally {
      setIsCleaning(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
      
      // Update all Sales state (used in Management table)
      setAllSales(firestoreData);
      
      const dataRows: Sale[] = (useMockData ? [...MOCK_BROKERS, ...firestoreData] : firestoreData) as Sale[];
      
      const currentCount = firestoreData.length;
      
      const toTitleCase = (str: string) => {
        if (!str) return '';
        return str.toLowerCase().trim().split(/\s+/).map(word => {
          if (word.length === 0) return '';
          const lower = ['de', 'da', 'do', 'dos', 'das', 'e'].includes(word);
          if (lower) return word;
          return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
      };

      const brokerCounts: Record<string, { name: string, unit: string, leader: string, director: string, traineeLeader?: string, count: number, totalVgv: number }> = {};
      const dirCounts: Record<string, { name: string, count: number, vgv: number }> = {};
      const leaderCounts: Record<string, { name: string, count: number, vgv: number }> = {};
      const traineeLeaderCounts: Record<string, { name: string, count: number, vgv: number }> = {};
      let totalVgv = 0;
      
      dataRows.forEach(row => {
        const rawName = row.brokerName;
        const rawLeader = row.leader || '';
        const rawDir = row.director || 'OUTROS';
        const rawTrainee = row.traineeLeader || '';
        const vgvValue = row.vgv || 0;
        
        totalVgv += vgvValue;
        if (!rawName) return;
        
        const cleanNameKey = rawName.trim().toUpperCase().replace(/\s+/g, ' ');
        const displayName = toTitleCase(cleanNameKey);
        const cleanDir = rawDir.trim().toUpperCase();
        const cleanLeader = rawLeader.trim().toUpperCase();
        const cleanTrainee = rawTrainee.trim().toUpperCase();
        
        if (!row.isLeaderSale) {
          if (!brokerCounts[cleanNameKey]) {
            brokerCounts[cleanNameKey] = { 
              name: displayName, 
              unit: toTitleCase(`${rawLeader} / ${rawDir}`.replace(/^\s*\/?\s*|\s*\/?\s*$/g, '')), 
              leader: toTitleCase(cleanLeader),
              director: toTitleCase(cleanDir),
              traineeLeader: cleanTrainee ? toTitleCase(cleanTrainee) : undefined,
              count: 0,
              totalVgv: 0
            };
          }
          brokerCounts[cleanNameKey].count++;
          brokerCounts[cleanNameKey].totalVgv += vgvValue;
        }

        if (!dirCounts[cleanDir]) {
          dirCounts[cleanDir] = { name: toTitleCase(cleanDir), count: 0, vgv: 0 };
        }
        dirCounts[cleanDir].count++;
        dirCounts[cleanDir].vgv += vgvValue;

        if (cleanLeader) {
          if (!leaderCounts[cleanLeader]) {
            leaderCounts[cleanLeader] = { name: toTitleCase(cleanLeader), count: 0, vgv: 0 };
          }
          leaderCounts[cleanLeader].count++;
          leaderCounts[cleanLeader].vgv += vgvValue;
        }

        if (cleanTrainee) {
          if (!traineeLeaderCounts[cleanTrainee]) {
            traineeLeaderCounts[cleanTrainee] = { name: toTitleCase(cleanTrainee), count: 0, vgv: 0 };
          }
          traineeLeaderCounts[cleanTrainee].count++;
          traineeLeaderCounts[cleanTrainee].vgv += vgvValue;
        }
      });

      const processedRanking = Object.values(brokerCounts)
        .sort((a, b) => b.totalVgv - a.totalVgv || b.count - a.count);

      const processedDirRanking = Object.values(dirCounts)
        .sort((a, b) => b.vgv - a.vgv || b.count - a.count);

      const processedLeadRanking = Object.values(leaderCounts)
        .sort((a, b) => b.vgv - a.vgv || b.count - a.count);

      const processedTraineeRanking = Object.values(traineeLeaderCounts)
        .sort((a, b) => b.vgv - a.vgv || b.count - a.count);

      // Handle Notifications & Ranking State
      if (!isInitialLoad.current) {
        // Find exactly which IDs are NEW
        const currentIds = new Set(firestoreData.map(d => d.id as string));
        const newIds = Array.from(currentIds).filter(id => !knownSaleIdsRef.current.has(id));
        
        if (newIds.length > 0) {
          // Process the newest among the new ones
          const newlyAddedSales = firestoreData.filter(d => newIds.includes(d.id as string));
          // Sort by createdAt desc to pick the absolute newest if multiple arrived
          const trulyNewest = newlyAddedSales.sort((a, b) => {
            const timeA = a.createdAt?.seconds ?? Date.now() / 1000;
            const timeB = b.createdAt?.seconds ?? Date.now() / 1000;
            return timeB - timeA;
          })[0];

          if (trulyNewest) {
            const brokerName = toTitleCase(trulyNewest.brokerName);
            
            // Only show popup/notif for regular broker sales (not leader sales)
            if (!trulyNewest.isLeaderSale) {
              setNewBooking({
                name: brokerName,
                team: toTitleCase(trulyNewest.leader || 'Equipe Principal'),
                vgv: trulyNewest.vgv || 0,
                isShared: trulyNewest.isShared || false,
                partnerName: trulyNewest.partnerName ? toTitleCase(trulyNewest.partnerName) : undefined,
                partnershipCount: trulyNewest.partnershipCount || 2
              });
              setShowPopup(true);
              playSuccessSound(); 
              setTimeout(() => setShowPopup(false), 8000);
              addNotification(`🚀 VENDA! ${brokerName} tá imparável!`, 'rank');
            } else {
              // Just a silent notification OR nothing
              console.log('Leader sale - hidden from broker ranking and popup');
            }
          }
          
          // Update known IDs
          newIds.forEach(id => knownSaleIdsRef.current.add(id));
        }
      } else {
        // Initial load: record all existing IDs
        firestoreData.forEach(d => {
          if (d.id) knownSaleIdsRef.current.add(d.id);
        });
      }

      setRanking(prev => {
        const newRanking = processedRanking.map((item, index) => {
          const currentRank = index + 1;
          const prevItem = prev.find(p => p.name === item.name);
          let change: 'up' | 'down' | 'stable' = 'stable';
          
          if (prevItem) {
            if (currentRank < prevItem.rank) change = 'up';
            else if (currentRank > prevItem.rank) change = 'down';
            
            // Notification for rank up
            if (!isInitialLoad.current && currentRank < prevItem.rank) {
              addNotification(`📈 SUBIU! ${item.name} agora é ${index + 1}º no Ranking!`, 'rank');
            }
          }
          return { ...item, rank: currentRank, change };
        });

        return newRanking;
      });

      // Meta achievements
      if (!isInitialLoad.current) {
        const checkMeta = (item: any, type: 'broker' | 'leader' | 'director') => {
          const thresholds = {
            broker: { bronze: 200000, silver: 500000, gold: 1000000, diamond: 1700000 },
            leader: { bronze: 2000000, silver: 3500000, gold: 5000000, diamond: 7000000 },
            director: { bronze: 4000000, silver: 7000000, gold: 10000000, diamond: 15000000 }
          }[type];
          const vgv = type === 'broker' ? item.totalVgv : item.vgv;
          const key = `${type}:${item.name}`;
          const currentTiers = achievedTiersRef.current[key] || [];
          
          let achievedTier = '';
          if (vgv >= thresholds.diamond && !currentTiers.includes('diamond')) achievedTier = 'diamond';
          else if (vgv >= thresholds.gold && !currentTiers.includes('gold')) achievedTier = 'gold';
          else if (vgv >= thresholds.silver && !currentTiers.includes('silver')) achievedTier = 'silver';
          else if (vgv >= thresholds.bronze && !currentTiers.includes('bronze')) achievedTier = 'bronze';
          
          if (achievedTier) {
            const tierLabels = { bronze: 'BRONZE', silver: 'PRATA', gold: 'OURO', diamond: 'DIAMANTE' };
            const label = tierLabels[achievedTier as keyof typeof tierLabels];
            addNotification(`🎯 META! ${item.name} bateu ${label}!`, 'meta');
            achievedTiersRef.current[key] = [...currentTiers, achievedTier];
          }
        };
        processedRanking.forEach(item => checkMeta(item, 'broker'));
        processedLeadRanking.forEach(item => checkMeta(item, 'leader'));
        processedDirRanking.forEach(item => checkMeta(item, 'director'));
      } else {
        // Initial setup for tiers
        processedRanking.forEach(item => {
          const tiers = [];
          if (item.totalVgv >= 200000) tiers.push('bronze');
          if (item.totalVgv >= 500000) tiers.push('silver');
          if (item.totalVgv >= 1000000) tiers.push('gold');
          if (item.totalVgv >= 1700000) tiers.push('diamond');
          achievedTiersRef.current[`broker:${item.name}`] = tiers;
        });
      }

      setDirectorateRanking(processedDirRanking);
      setLeaderRanking(processedLeadRanking);
      setTraineeLeaderRanking(processedTraineeRanking);
      setTotalVgvSum(totalVgv);
      setTotalAgendamentos(currentCount);
      prevCountRef.current = currentCount;
      setIsLoading(false);
      isInitialLoad.current = false;
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales');
    });

    return () => unsubscribe();
  }, [useMockData]);

  const rotateView = () => {
    setViewMode(current => {
      if (current === 'ranking') {
        if (secondaryIndex === 0) return 'series-a';
        if (secondaryIndex === 1) return 'ranking-directorate';
        if (secondaryIndex === 2) return 'ranking-leader';
        return 'ranking-trainee-leader';
      }
      
      if (current === 'series-a') return 'series-b';
      
      if (current === 'series-b' || current === 'ranking-directorate' || current === 'ranking-leader' || current === 'ranking-trainee-leader') {
        setSecondaryIndex(prev => (prev + 1) % 4);
        return 'ranking';
      }
      
      return 'ranking';
    });
  };

  // View Rotation logic
  useEffect(() => {
    if (viewMode === 'form' || viewMode === 'management') return;

    const getRotationTime = (mode: ViewMode) => {
      if (mode === 'ranking') return 60000; // 1 minute for main dashboard
      return 30000; // 30 seconds for secondary screens
    };

    const interval = setTimeout(rotateView, getRotationTime(viewMode));

    return () => clearTimeout(interval);
  }, [viewMode, secondaryIndex]);

  const [itemsPerPage, setItemsPerPage] = useState(8);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewMode !== 'ranking' || !tableContainerRef.current) return;
    
    const calculateRows = () => {
      if (!tableContainerRef.current) return;
      const containerHeight = tableContainerRef.current.clientHeight;
      const headerHeight = 60; // table thead height (tightened from 65)
      const rowHeight = 66;   // table tr height (tightened from 72)
      const count = Math.floor((containerHeight - headerHeight) / rowHeight);
      setItemsPerPage(Math.max(1, count));
    };

    const observer = new ResizeObserver(calculateRows);
    observer.observe(tableContainerRef.current);
    calculateRows();

    return () => observer.disconnect();
  }, [viewMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-brand-dark font-medium tracking-widest uppercase text-sm">Carregando Ranking...</p>
        </div>
      </div>
    );
  }

  const seriesA = ranking.slice(0, 10);
  const seriesB = ranking.slice(10, 20);
  const podium = ranking.slice(0, 3);
  const list = ranking.slice(3, 3 + itemsPerPage); 

  const cycleGoal = 10000000;
  const currentCycleVgv = totalVgvSum % cycleGoal;
  const goalProgress = (currentCycleVgv / cycleGoal) * 100;
  const cycleCount = Math.floor(totalVgvSum / cycleGoal) + 1;

  const getTierInfo = (value: number, type: 'broker' | 'leader' | 'director') => {
    const thresholds = {
      broker: { bronze: 200000, silver: 500000, gold: 1000000, diamond: 1700000 },
      leader: { bronze: 2000000, silver: 3500000, gold: 5000000, diamond: 7000000 },
      director: { bronze: 4000000, silver: 7000000, gold: 10000000, diamond: 15000000 }
    }[type];

    if (value >= thresholds.diamond) return { label: 'DIAMANTE', color: 'bg-[#B9F2FF] text-brand-dark shadow-[0_0_10px_rgba(185,242,255,0.5)]' };
    if (value >= thresholds.gold) return { label: 'OURO', color: 'bg-[#FFD700] text-brand-dark' };
    if (value >= thresholds.silver) return { label: 'PRATA', color: 'bg-[#C0C0C0] text-brand-dark' };
    if (value >= thresholds.bronze) return { label: 'BRONZE', color: 'bg-[#CD7F32] text-white' };
    return null;
  };

  const getChangeIcon = (change: 'up' | 'down' | 'stable') => {
    if (change === 'up') return <ArrowUp size={12} className="text-emerald-500" />;
    if (change === 'down') return <ArrowDown size={12} className="text-rose-500" />;
    return <Minus size={12} className="text-slate-300" />;
  };

  // Reorder for podium display: 2nd, 1st, 3rd
  const displayPodium = [];
  if (podium[1]) displayPodium.push(podium[1]);
  if (podium[0]) displayPodium.push(podium[0]);
  if (podium[2]) displayPodium.push(podium[2]);

  // Form URL for QR Code
  const formUrl = typeof window !== 'undefined' ? `${window.location.origin}?mode=form` : '';

  return (
    <div className="h-screen flex flex-col font-sans overflow-hidden relative bg-transparent">
      <div className="absolute inset-0 bg-dot-pattern opacity-30 pointer-events-none" />
      {/* AUDIO ELEMENT FOR SALES */}
      <audio 
        id="venda-audio" 
        src="https://www.dropbox.com/scl/fi/fpxnav712so29jzfz6ywc/freesound_community-decidemp3-14575.mp3?rlkey=2srjtwpmq91kmmxvvkkd3ptgt&e=2&st=kb5tg1lh&raw=1" 
        preload="auto" 
        style={{ display: 'none' }}
      />

      {/* NOTIFICATIONS TOASTS */}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className={`p-4 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-xl border border-white/20 min-w-[300px] pointer-events-auto ${
                notif.type === 'meta' ? 'bg-amber-500 text-white' : 'bg-brand-dark text-white'
              }`}
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                {notif.type === 'meta' ? <Award size={20} /> : <TrendingUp size={20} />}
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest opacity-60">
                  {notif.type === 'meta' ? 'META ALCANÇADA' : 'ATUALIZAÇÃO DE RANKING'}
                </p>
                <p className="text-sm font-semibold uppercase tracking-tighter">{notif.text}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* TV MODE OVERLAY FOR TABLES */}
      <AnimatePresence>
        {(viewMode === 'series-a' || viewMode === 'series-b' || viewMode === 'ranking-directorate' || viewMode === 'ranking-leader' || viewMode === 'ranking-trainee-leader') && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-3xl p-4 lg:p-6 overflow-hidden flex flex-col"
          >
             <div className="absolute inset-0 bg-dot-pattern opacity-10 pointer-events-none" />
             
             <div className="mb-6 flex justify-between items-end relative z-10">
                <div className="flex items-center gap-6">
                   <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center p-2.5 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                     <img src="https://morarbempe.com.br/wp-content/uploads/2023/06/logofull-600x163.png" alt="Morar Bem" className="w-full grayscale brightness-0" />
                   </div>
                   <div>
                     <h2 className="text-white font-medium text-4xl uppercase tracking-tighter leading-none mb-1">
                       {viewMode === 'series-a' ? 'BRASILEIRÃO - SÉRIE A' : 
                        viewMode === 'series-b' ? 'SÉRIE B - ACESSO' :
                        viewMode === 'ranking-directorate' ? 'RANKING DIRETORIAS' : 
                        viewMode === 'ranking-leader' ? 'RANKING LÍDERES' : 'RANKING LÍDERES TRAINEE'}
                     </h2>
                     <p className="text-brand-light font-medium uppercase tracking-[0.3em] text-[10px]">
                       {viewMode.includes('ranking') ? 'LIDERANÇA • SISTEMA HUB NOGUEIRA' : 'ELITE DOS CORRETORES • SISTEMA HUB NOGUEIRA'}
                     </p>
                   </div>
                </div>
                <div className="text-right">
                  <p className="text-white/20 font-medium uppercase tracking-widest text-[8px] mb-0.5">SISTEMA HUB</p>
                  <p className="text-white font-mono text-lg">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
             </div>

             <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex-1 glass-card rounded-[32px] shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden flex flex-col relative z-10"
             >
                <div className="flex-1 flex flex-col overflow-hidden divide-y divide-white/5">
                  {(() => {
                    const data = (viewMode === 'series-a' ? seriesA : 
                                 viewMode === 'series-b' ? seriesB : 
                                 viewMode === 'ranking-directorate' ? directorateRanking : 
                                 viewMode === 'ranking-leader' ? leaderRanking : traineeLeaderRanking);
                    
                    const isSecondaryRanking = viewMode.includes('ranking-');
                    
                    if (data.length === 0) return null;

                    return (
                      <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="bg-white/5 border-b border-white/5 backdrop-blur-md flex shrink-0 items-center">
                          <div className={`px-8 ${isSecondaryRanking ? 'py-5 text-[11px]' : 'py-3 text-[10px]'} font-medium text-slate-500 uppercase tracking-[0.2em] w-[140px]`}>Posição</div>
                          <div className={`px-6 ${isSecondaryRanking ? 'py-5 text-[11px]' : 'py-3 text-[10px]'} font-medium text-slate-500 uppercase tracking-[0.2em] flex-1`}>
                            {viewMode === 'ranking-directorate' ? 'Diretoria' : viewMode === 'ranking-leader' ? 'Líder / Equipe' : viewMode === 'ranking-trainee-leader' ? 'Líder Trainee' : 'Consultor'}
                          </div>
                          <div className={`px-8 ${isSecondaryRanking ? 'py-5 text-[11px]' : 'py-3 text-[10px]'} font-medium text-slate-500 uppercase tracking-[0.2em] w-[400px] text-right`}>
                            VGV Confirmado
                          </div>
                        </div>

                        {/* Body - Flex container to stretch rows */}
                        <div className="flex-1 flex flex-col divide-y divide-white/5 overflow-hidden">
                          {data.map((item, idx) => {
                            const rank = idx + 1;
                            const isG3 = (viewMode === 'series-a' || viewMode.includes('ranking')) && rank <= 3;
                            const isG7 = viewMode === 'series-a' && rank > 3 && rank <= 7;
                            const isZ2 = viewMode === 'series-a' && rank > 8;
                            const isPromotion = viewMode === 'series-b' && rank <= 4;

                            let glowClass = "";
                            if (isG3) {
                              if (rank === 1) glowClass = "border-l-[6px] border-amber-500 bg-amber-500/5 neon-glow-gold";
                              else glowClass = "border-l-[6px] border-brand-light bg-brand-light/5 neon-glow-blue";
                            }
                            else if (isG7) glowClass = "border-l-[6px] border-brand-blue bg-blue-500/5";
                            else if (isZ2) glowClass = "border-l-[6px] border-rose-500 bg-rose-500/5";
                            else if (isPromotion) glowClass = "border-l-[6px] border-emerald-500 bg-emerald-500/5";

                            const displayVgv = viewMode.includes('ranking') ? item.vgv : item.totalVgv;

                            return (
                              <motion.div 
                                key={item.name} 
                                initial={{ x: -10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.1 * idx }}
                                className={`flex-1 flex items-center px-2 transition-all ${glowClass}`}
                              >
                                <div className="w-[140px] px-6 flex items-center gap-3">
                                  <div className="w-4 flex justify-center scale-90">
                                    {viewMode.includes('series') ? getChangeIcon(item.change) : <Minus size={10} className="text-slate-500" />}
                                  </div>
                                  <span className={`font-medium tabular-nums text-xl ${rank <= 3 ? 'text-white' : 'text-slate-500'}`}>
                                    {rank}º
                                  </span>
                                </div>

                                <div className="flex-1 px-6 flex flex-col justify-center">
                                  <div className="flex items-center gap-4">
                                    {isG3 && <Star size={20} fill="currentColor" className={rank === 1 ? 'text-amber-500 shadow-lg' : 'text-brand-light shadow-lg'} />}
                                    <span className={`font-medium uppercase tracking-tighter truncate max-w-[80vw] ${isG3 ? 'text-3xl text-white' : 'text-2xl text-slate-300'}`}>
                                      {item.name}
                                    </span>
                                    {(() => {
                                      const tier = getTierInfo(
                                        displayVgv, 
                                        viewMode === 'ranking-directorate' ? 'director' : 
                                        viewMode === 'ranking-leader' ? 'leader' : 'broker'
                                      );
                                      if (!tier) return null;
                                      return (
                                        <span className={`text-[10px] font-medium px-4 py-1.5 rounded-full shrink-0 ${tier.color}`}>
                                          {tier.label}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  {!isSecondaryRanking && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-sm font-medium text-slate-500 uppercase tracking-tighter">
                                        {item.leader ? `LDR: ${item.leader}` : ''} {item.director ? ` • DIR: ${item.director}` : ''}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="w-[400px] px-8 text-right">
                                  <span className={`font-medium tabular-nums text-glow ${isG3 ? 'text-4xl text-emerald-400' : 'text-3xl text-white'}`}>
                                    {displayVgv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="bg-black/40 px-8 py-4 border-t border-white/10 flex justify-between items-center text-[9px] font-medium uppercase tracking-[0.2em] text-slate-500 shrink-0 backdrop-blur-md">
                  <div className="flex gap-8">
                    <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" /> G3 (LIBERTADORES)</span>
                    {!viewMode.includes('ranking') && (
                      <>
                        <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-brand-light shadow-[0_0_10px_rgba(59,130,246,0.5)]" /> G7 (SUDAMERICANA)</span>
                        {viewMode === 'series-a' && <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" /> REBAIXAMENTO</span>}
                        {viewMode === 'series-b' && <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" /> ACESSO (Z4)</span>}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-brand-light">{viewMode.includes('ranking') ? 'LIDERANÇA' : 'TV BRASILEIRÃO'} • MORAR BEM</span>
                    <div className="w-1.5 h-1.5 bg-brand-light rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                  </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Texture Overlay */}
      <div className="absolute inset-0 bg-texture pointer-events-none" />
      
      {/* NEW APPOINTMENT POPUP */}
      <AnimatePresence>
        {showPopup && newBooking && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-[20px]"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 100, rotate: -5 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="relative glass-card rounded-[40px] p-12 max-w-2xl w-full text-center shadow-[0_0_100px_rgba(59,130,246,0.3)] border-t-[12px] border-brand-light neon-glow-blue"
            >
              <div className="absolute -top-24 left-1/2 -translate-x-1/2">
                <div className="w-48 h-48 bg-brand-blue rounded-full flex items-center justify-center shadow-2xl border-8 border-slate-900 overflow-hidden relative group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-brand-blue to-white/20 animate-pulse" />
                  <TrendingUp size={80} className="text-white relative z-10" />
                </div>
              </div>

              <div className="mt-20 space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <span className="bg-brand-light text-brand-dark px-6 py-2 rounded-full font-medium text-sm uppercase tracking-[0.3em] inline-block mb-4 shadow-[0_0_20px_rgba(96,165,250,0.4)]">
                    🔥 BROCOU! VENDEU! 🔥
                  </span>
                  <h2 className="text-6xl font-medium text-white uppercase leading-[0.9] tracking-tighter mb-4 text-glow">
                    {newBooking.isShared && newBooking.partnerName ? `${newBooking.name} & ${newBooking.partnerName}` : newBooking.name}
                  </h2>
                  {newBooking.isShared && (
                    <div className="mb-4">
                      <span className="bg-white/10 text-brand-light border border-brand-light/30 px-4 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.2em] backdrop-blur-md">
                        🤝 Parceria {newBooking.partnershipCount === 3 ? 'Dividida (33%)' : 'Dividida (50/50)'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-2 text-brand-light font-display text-2xl font-medium uppercase">
                    <Star fill="currentColor" size={24} />
                    {newBooking.team}
                    <Star fill="currentColor" size={24} />
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white/5 border-2 border-dashed border-white/10 rounded-3xl p-8 mt-8"
                >
                  <p className="text-slate-500 font-medium uppercase text-xs tracking-[0.2em] mb-2">{newBooking.isShared ? `SEU VGV (${newBooking.partnershipCount === 3 ? '33%' : '50%'}):` : 'VGV (VALOR):'}</p>
                  <p className="text-5xl font-medium text-emerald-400 uppercase tracking-tight text-glow">
                    {newBooking.vgv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  {newBooking.isShared && (
                    <p className="mt-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                      VALOR TOTAL DA VENDA: {(newBooking.vgv * (newBooking.partnershipCount || 2)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="pt-6"
                >
                  <p className="text-white font-medium text-xl italic uppercase font-display opacity-80">"Sente o cheiro da comissão! BORA VENDER!"</p>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`flex-1 w-full p-2 lg:p-3 grid grid-cols-1 lg:grid-cols-[20%_1fr] gap-3 overflow-hidden relative z-10 transition-all duration-700 ${(viewMode === 'series-a' || viewMode === 'series-b' || viewMode === 'ranking-directorate' || viewMode === 'ranking-leader') ? 'blur-2xl opacity-0 scale-95' : 'blur-0 opacity-100 scale-100'}`}>
        {/* Sidebar */}
        <motion.aside 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="glass-card rounded-[40px] p-8 flex flex-col h-full relative overflow-hidden shrink-0"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-light/5 rounded-full -mr-16 -mt-16 blur-2xl" />
          
          <div className="mb-12 relative z-10 px-2 text-center">
            <img 
              src="https://i.postimg.cc/Sxr6cxK7/NASCIMENTO-01.png" 
              alt="Nascimento Logo" 
              className="w-full h-auto object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            />
          </div>

          <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
            <div className="w-full space-y-8 h-full flex flex-col justify-between">
              {/* Clock and Date */}
              <div className="flex flex-col items-center gap-2 text-center shrink-0">
                <h3 className="text-6xl font-medium text-white tabular-nums tracking-tighter leading-none">
                  {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </h3>
                <p className="text-sm font-medium text-slate-500 tracking-[0.4em] uppercase">
                  {currentTime.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </p>
              </div>

              {/* Highlights Section */}
              <div className="grid grid-cols-1 gap-3 py-4 flex-1">
                {[
                  { label: 'DESTAQUE CORRETOR', data: ranking[0], type: 'broker' },
                  { label: 'DESTAQUE LÍDER TRAINEE', data: traineeLeaderRanking[0], type: 'trainee' },
                  { label: 'DESTAQUE LÍDER', data: leaderRanking[0], type: 'leader' },
                  { label: 'DESTAQUE DIRETOR', data: directorateRanking[0], type: 'director' }
                ].map((highlight, idx) => (
                  <motion.div 
                    key={highlight.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center relative overflow-hidden group hover:bg-white/[0.08] transition-colors"
                  >
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                      {idx === 0 ? <Trophy size={20} /> : <Star size={20} />}
                    </div>
                    <p className="text-[10px] font-medium text-brand-light uppercase tracking-[0.3em] mb-1">{highlight.label}</p>
                    <h4 className="text-white font-medium uppercase text-base truncate pr-4">
                      {highlight.data?.name || '---'}
                    </h4>
                    <div className="flex justify-between items-baseline mt-1">
                      <p className="text-xs text-slate-500 font-mono">
                        {highlight.data?.count || 0} {highlight.data?.count === 1 ? 'VENDA' : 'VENDAS'}
                      </p>
                      <p className="text-emerald-400 font-medium text-sm tabular-nums">
                        {(highlight.data?.totalVgv || highlight.data?.vgv || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* QR Code Section */}
              <div 
                onClick={() => setViewMode('form')}
                className="flex flex-col items-center gap-4 shrink-0 pt-4 cursor-pointer group"
              >
                <div className="bg-white p-3 rounded-[2rem] shadow-[0_0_50px_rgba(255,255,255,0.1)] ring-4 ring-white/5 group-hover:scale-105 transition-transform">
                   <QRCodeSVG 
                    value={typeof window !== "undefined" ? window.location.origin + window.location.pathname + "?mode=form" : ""} 
                    size={140}
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-medium text-brand-light uppercase tracking-[0.3em] group-hover:text-white transition-colors">REGISTRAR VGV</p>
                </div>
              </div>
            </div>
          </div>
        </motion.aside>

        {/* Main Content Area */}
        <div className="flex flex-col gap-4 overflow-hidden h-full">
          
          {/* Header Bar */}
          <motion.header 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center justify-between px-2 shrink-0 h-[100px]"
          >
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)] ring-1 ring-white/20">
                  <Trophy className="text-brand-dark" size={28} />
                </div>
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -bottom-1 -right-1 bg-brand-light w-3.5 h-3.5 rounded-full border-2 border-brand-dark"
                />
              </div>
              <div className="flex flex-col">
                  <h2 className="font-display text-[64px] leading-[0.8] font-medium text-white uppercase tracking-tighter">
                    {viewMode === 'ranking' ? (
                      <>
                        RANKING <span className="text-brand-light">DE VENDAS</span>
                      </>
                    ) : viewMode === 'series-a' ? 'SÉRIE A' : viewMode === 'series-b' ? 'SÉRIE B' : 'REGISTRO'}
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-[22px] font-semibold text-slate-500 uppercase tracking-tight">
                      {viewMode === 'ranking' ? 'DESTAQUES DO MÊS =' : viewMode === 'form' ? 'GERAL' : 'DE VENDAS'}
                    </span>
                  <div className="h-[2px] bg-white/10 flex-1 min-w-[60px]" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2 mb-1">
                  <button 
                    onClick={() => setViewMode(viewMode === 'management' ? 'ranking' : 'management')}
                    className={`text-[8px] font-medium px-2 py-0.5 rounded cursor-pointer transition-all shadow-sm ${viewMode === 'management' ? 'bg-amber-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                  >
                    {viewMode === 'management' ? 'VOLTAR AO RANKING' : 'GERENCIAR DADOS'}
                  </button>
                  {!useMockData && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={importInitialData}
                        className="text-[8px] font-medium px-2 py-0.5 rounded cursor-pointer bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all border border-emerald-500/20"
                        title="Importar dados de exemplo para o banco real"
                      >
                        ADICIONAR DADOS INICIAIS
                      </button>
                      <button 
                        onClick={clearAllSales}
                        className={`text-[8px] font-medium px-2 py-0.5 rounded cursor-pointer transition-all ${confirmClear ? 'bg-rose-600 text-white animate-pulse' : 'bg-brand-blue/20 text-brand-light border border-brand-blue/20 hover:bg-rose-500 hover:text-white'}`}
                        title="Clique para excluir todas as vendas reais"
                      >
                        {confirmClear ? (isCleaning ? 'APAGANDO...' : 'CONFIRMAR?') : 'LIMPAR TUDO'}
                      </button>
                    </div>
                  )}
                  {useMockData && (
                    <span className="text-[8px] font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/20">
                      DADOS: SIMULADOS
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest leading-none mb-1">VGV TOTAL CONSOLIDADO</p>
                  <Counter 
                    value={totalVgvSum} 
                    className="font-display text-4xl leading-none font-medium text-white tabular-nums tracking-tighter text-glow"
                  />
                </div>
              </div>
            </div>
          </motion.header>

          <main className="flex-1 overflow-hidden flex flex-col">
            {viewMode === 'ranking' ? (
              <div className="flex flex-col flex-1 overflow-hidden pt-0 gap-2">
                <section className="flex flex-col lg:flex-row justify-center items-end gap-6 lg:gap-14 px-4 lg:px-12 pt-20 lg:pt-28 pb-0 overflow-visible shrink-0">
                  <AnimatePresence mode="popLayout">
                    {displayPodium.map((user) => {
                      const actualRank = user === podium[0] ? 1 : user === podium[1] ? 2 : 3;
                      const isFirst = actualRank === 1;

                          const rankInfo = {
                            1: { 
                              label: '1', 
                              color: 'border-yellow-400/60 bg-gradient-to-b from-[#1a1600] to-[#0d0b00] neon-glow-gold', 
                              badge: 'bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-600 text-slate-950 border-white/40 shadow-[0_0_50px_rgba(250,204,21,0.6)] ring-1 ring-white/30', 
                              vgvColor: 'text-yellow-400', 
                              glow: 'bg-yellow-400/40',
                              dimensions: 'w-full max-w-[700px] h-[400px]'
                            },
                            2: { 
                              label: '2', 
                              color: 'border-slate-400/40 bg-gradient-to-b from-[#0f1115] to-[#050507] neon-glow-silver', 
                              badge: 'bg-gradient-to-b from-slate-100 via-slate-400 to-slate-600 text-slate-950 border-white/40 shadow-[0_0_30px_rgba(203,213,225,0.4)] ring-1 ring-white/20', 
                              vgvColor: 'text-white', 
                              glow: 'bg-slate-400/20',
                              dimensions: 'w-full max-w-[450px] h-[300px]'
                            },
                            3: { 
                              label: '3', 
                              color: 'border-orange-600/40 bg-gradient-to-b from-[#150a00] to-[#070300] neon-glow-bronze', 
                              badge: 'bg-gradient-to-b from-orange-200 via-orange-500 to-orange-800 text-slate-950 border-white/40 shadow-[0_0_30px_rgba(234,88,12,0.4)] ring-1 ring-white/20', 
                              vgvColor: 'text-orange-400', 
                              glow: 'bg-orange-600/20',
                              dimensions: 'w-full max-w-[450px] h-[300px]'
                            }
                          }[actualRank as 1 | 2 | 3];

                      return (
                        <motion.div
                          key={user.name}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ 
                            y: 0, 
                            opacity: 1, 
                            scale: 1,
                            transition: { duration: 0.6, ease: "easeOut" }
                          }}
                          className={`flex flex-col items-center justify-center p-8 rounded-[40px] border backdrop-blur-3xl group relative overflow-visible ${rankInfo.color} ${isFirst ? 'z-20' : 'z-10'} ${rankInfo.dimensions} shadow-[0_20px_80px_rgba(0,0,0,0.8)]`}
                        >
                          {/* METALLIC SHINE EFFECT (First Place Only) */}
                          {isFirst && (
                             <div className="absolute inset-0 rounded-[40px] overflow-hidden pointer-events-none">
                               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-200/50 to-transparent" />
                               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-yellow-400/30 blur-md rounded-full" />
                             </div>
                          )}

                          {/* LARGE LIGHT BURST SPREAD */}
                          <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 ${rankInfo.glow} rounded-full blur-[120px] opacity-60 pointer-events-none z-0`} />
                          
                          {/* Rank Circle Badge */}
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                            <div className={`${isFirst ? 'w-32 h-32 text-7xl' : 'w-24 h-24 text-5xl'} rounded-full border-2 ${rankInfo.badge} flex items-center justify-center font-medium shadow-[0_10px_40px_rgba(0,0,0,0.8)] ring-8 ring-[#050507]/90 relative overflow-hidden`}>
                              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent pointer-events-none" />
                              {rankInfo.label}
                            </div>
                          </div>

                          <div className={`${isFirst ? 'mt-10' : 'mt-8'} flex flex-col items-center w-full relative z-10`}>
                            <div className="mb-4 text-center w-full px-4">
                              <h3 className={`${isFirst ? 'text-4xl' : 'text-2xl'} font-medium text-white uppercase tracking-tight line-clamp-1 leading-none drop-shadow-2xl`}>{user.name}</h3>
                            </div>

                            <div className={`${isFirst ? 'px-5 py-2 mb-8' : 'px-4 py-1.5 mb-6'} bg-white/5 border border-white/10 rounded-lg flex items-center gap-2.5 shadow-inner backdrop-blur-sm`}>
                              <span className={`${isFirst ? 'text-3xl' : 'text-xl'} text-white font-medium leading-none`}>+{user.count}</span>
                              <span className={`${isFirst ? 'text-[10px]' : 'text-[9px]'} font-medium uppercase text-slate-400 tracking-[0.2em]`}>{user.count === 1 ? 'Venda' : 'Vendas'}</span>
                            </div>

                            <div className="relative">
                               <p className={`${isFirst ? 'text-7xl' : 'text-5xl'} font-medium tabular-nums tracking-tighter text-glow ${rankInfo.vgvColor} drop-shadow-[0_0_40px_rgba(0,0,0,0.8)] flex items-baseline gap-2`}>
                                 <span className={`${isFirst ? 'text-3xl' : 'text-2xl'} opacity-80`}>R$</span>
                                 {user.totalVgv.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                               </p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </section>

                <section ref={tableContainerRef} className="glass-card rounded-[32px] shadow-[0_30px_100px_rgba(0,0,0,0.9)] border border-white/10 overflow-hidden flex flex-col mb-4 mx-0 flex-1">
                  <div className="overflow-y-auto h-full scrollbar-none">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-3xl z-20 border-b border-white/10">
                        <tr>
                          <th className="px-6 lg:px-10 py-6 font-display text-[10px] lg:text-xs font-medium text-slate-500 uppercase tracking-[0.3em]">Posição</th>
                          <th className="px-6 lg:px-10 py-6 font-display text-[10px] lg:text-xs font-medium text-slate-500 uppercase tracking-[0.3em]">Consultor</th>
                          <th className="px-6 lg:px-10 py-6 font-display text-[10px] lg:text-xs font-medium text-slate-500 uppercase tracking-[0.3em]">Líder / Diretor</th>
                          <th className="px-6 lg:px-10 py-6 font-display text-[10px] lg:text-xs font-medium text-slate-500 uppercase tracking-[0.3em]">VGV Acumulado</th>
                          <th className="px-6 lg:px-10 py-6 font-display text-[10px] lg:text-xs font-medium text-slate-500 uppercase tracking-[0.3em] text-right">Vendas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {list.map((user) => (
                          <motion.tr 
                            key={user.name}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="hover:bg-white/5 transition-all group h-[60px] lg:h-[70px]"
                          >
                            <td className="px-6 lg:px-10 py-4">
                              <div className="flex items-center gap-3 lg:gap-4">
                                {getChangeIcon(user.change)}
                                <span className="font-display text-lg lg:text-xl font-medium text-slate-600 group-hover:text-white transition-colors">
                                  #{user.rank}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 lg:px-10 py-4">
                              <div className="flex items-center gap-4 lg:gap-6">
                                <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-gradient-to-br from-white/15 to-white/5 text-white flex items-center justify-center font-medium text-base lg:text-lg border border-white/10 shadow-xl">
                                  {user.name.charAt(0)}
                                </div>
                                 <span className="font-medium text-lg lg:text-2xl text-white uppercase tracking-tighter group-hover:translate-x-1 transition-transform">{user.name}</span>
                                {(() => {
                                  const tier = getTierInfo(user.totalVgv, 'broker');
                                  if (!tier) return null;
                                  return (
                                    <span className={`text-[8px] lg:text-[10px] font-medium px-2 lg:px-3 py-0.5 lg:py-1 rounded-full ${tier.color} shadow-lg`}>
                                      {tier.label}
                                    </span>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="px-6 lg:px-10 py-4 text-center">
                              <span className="text-[10px] lg:text-[12px] font-medium text-slate-400 uppercase tracking-widest bg-white/5 px-3 lg:px-4 py-1 lg:py-1.5 rounded-xl border border-white/5 inline-block">{user.unit}</span>
                            </td>
                            <td className="px-6 lg:px-10 py-4">
                               <div className="flex items-baseline gap-1 lg:gap-2">
                                 <span className="text-emerald-500/60 font-medium text-[10px] lg:text-sm">R$</span>
                                 <span className="font-medium text-lg lg:text-2xl text-emerald-400 tabular-nums text-glow drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                                   {user.totalVgv.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                 </span>
                               </div>
                            </td>
                            <td className="px-6 lg:px-10 py-4 text-right">
                              <span className="font-display text-xl lg:text-3xl font-medium text-white tabular-nums drop-shadow-md">
                                {user.count}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                    {ranking.length === 0 && (
                      <div className="p-20 text-center">
                        <p className="text-slate-600 font-medium uppercase tracking-widest">Nenhuma venda registrada ainda</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Footer Ticker */}
                <div className="mt-auto bg-brand-blue/20 border-t border-white/10 backdrop-blur-xl px-12 py-3 flex items-center justify-between overflow-hidden shrink-0">
                  <div className="flex items-center gap-4 flex-1">
                    <Trophy size={20} className="text-brand-light animate-bounce" />
                    <div className="flex gap-4 items-center">
                       <p className="text-sm font-medium text-white uppercase tracking-widest whitespace-nowrap">PARABÉNS A TODOS OS CORRETORES PELOS RESULTADOS!</p>
                       <div className="w-1 h-1 rounded-full bg-brand-light/40" />
                       <div className="flex gap-6 items-center">
                         {['FOCO', 'DISCIPLINA', 'CONSTÂNCIA', 'RESULTADOS'].map((word, i) => (
                           <span key={word} className="text-xs font-medium text-slate-400 uppercase tracking-[0.3em] flex items-center gap-6">
                             {word}
                             {i < 3 && <div className="w-1 h-1 rounded-full bg-slate-700" />}
                           </span>
                         ))}
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (viewMode === 'ranking-directorate' || viewMode === 'ranking-leader' || viewMode === 'series-a' || viewMode === 'series-b') ? (
              <div className="h-full flex items-center justify-center bg-white/30 rounded-[32px] border-2 border-dashed border-slate-200">
                <div className="text-center">
                  <LayoutDashboard size={48} className="text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-medium uppercase tracking-widest italic animate-pulse">Exibindo Rankings na TV...</p>
                  <p className="text-slate-300 text-[10px] uppercase font-medium tracking-tighter mt-2">Pressione ESC para voltar manual (Em breve)</p>
                </div>
              </div>
            ) : viewMode === 'management' ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-[32px] shadow-2xl border border-white/5 overflow-hidden flex flex-col h-full"
              >
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                  <div>
                    <h3 className="text-2xl font-medium text-white uppercase tracking-tighter">Gerenciamento de Vendas</h3>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-widest leading-none mt-1">Base de Dados Real • Total: {allSales.length} Registros</p>
                  </div>
                  <button 
                    onClick={exportToExcel}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-2xl font-medium uppercase text-xs tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                  >
                    <Download size={18} />
                    Exportar Excel
                  </button>
                </div>
                <div className="flex-1 overflow-auto scrollbar-none">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-slate-900 shadow-sm z-10 border-b border-white/5">
                      <tr>
                        <th className="px-8 py-5 text-[10px] font-medium text-slate-500 uppercase tracking-widest">Consultor</th>
                        <th className="px-8 py-5 text-[10px] font-medium text-slate-500 uppercase tracking-widest">Líderes / Diretor</th>
                        <th className="px-8 py-5 text-[10px] font-medium text-slate-500 uppercase tracking-widest">VGV</th>
                        <th className="px-8 py-5 text-[10px] font-medium text-slate-500 uppercase tracking-widest text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {allSales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-8 py-4">
                            {editingSaleId === sale.id ? (
                              <input 
                                type="text"
                                defaultValue={sale.brokerName}
                                onBlur={(e) => updateSale(sale.id!, { brokerName: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') updateSale(sale.id!, { brokerName: e.currentTarget.value });
                                  if (e.key === 'Escape') setEditingSaleId(null);
                                }}
                                autoFocus
                                className="glass-input rounded-lg px-3 py-1 font-medium text-white uppercase w-full"
                              />
                            ) : (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-3">
                                  <span className="font-medium text-lg text-white uppercase tracking-tighter">{sale.brokerName}</span>
                                  {sale.isShared && (
                                    <span className="text-[8px] font-medium bg-brand-blue/20 text-brand-light px-2 py-0.5 rounded border border-brand-blue/20">
                                      PARCERIA {sale.partnershipCount === 3 ? '33%' : '50%'}
                                    </span>
                                  )}
                                  {sale.isLeaderSale && (
                                    <span className="text-[8px] font-medium bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20">LÍDER / GESTÃO</span>
                                  )}
                                </div>
                                <button onClick={() => setEditingSaleId(sale.id!)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-brand-light transition-all w-fit">
                                  <Edit3 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-8 py-4">
                            {editingSaleId === sale.id ? (
                              <div className="flex flex-col gap-1">
                                <input 
                                  type="text"
                                  defaultValue={sale.leader}
                                  placeholder="Líder"
                                  onBlur={(e) => updateSale(sale.id!, { leader: e.target.value })}
                                  className="glass-input rounded px-2 py-0.5 text-[10px] font-medium uppercase text-white"
                                />
                                <input 
                                  type="text"
                                  defaultValue={sale.traineeLeader || ''}
                                  placeholder="Líder Trainee (Opcional)"
                                  onBlur={(e) => updateSale(sale.id!, { traineeLeader: e.target.value })}
                                  className="glass-input border-orange-500/20 rounded px-2 py-0.5 text-[9px] font-medium uppercase text-orange-400"
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-medium text-slate-300 uppercase">{sale.leader}</span>
                                  {sale.traineeLeader && (
                                    <span className="text-[9px] font-medium bg-orange-400/20 text-orange-400 px-1.5 py-0.5 rounded uppercase border border-orange-400/20">{sale.traineeLeader} (Trainee)</span>
                                  )}
                                </div>
                                <span className="text-[8px] font-medium text-slate-500 uppercase">{sale.director}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-8 py-4">
                            {editingSaleId === sale.id ? (
                              <input 
                                type="number"
                                defaultValue={sale.vgv}
                                onBlur={(e) => updateSale(sale.id!, { vgv: parseFloat(e.target.value) })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') updateSale(sale.id!, { vgv: parseFloat(e.currentTarget.value) });
                                  if (e.key === 'Escape') setEditingSaleId(null);
                                }}
                                className="glass-input rounded-lg px-3 py-1 font-medium text-emerald-400 w-full"
                              />
                            ) : (
                              <span className="font-medium text-emerald-400 tabular-nums text-glow">
                                {sale.vgv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            )}
                          </td>
                          <td className="px-8 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {confirmingDeleteId === sale.id ? (
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => deleteSale(sale.id!)}
                                    className="px-3 py-1 bg-rose-600 text-white rounded-lg font-medium text-[10px] uppercase hover:bg-rose-700 transition-all shadow-sm"
                                  >
                                    Confirmar
                                  </button>
                                  <button 
                                    onClick={() => setConfirmingDeleteId(null)}
                                    className="p-1.5 rounded-lg bg-white/5 text-slate-500 hover:text-white transition-all"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setConfirmingDeleteId(sale.id!)}
                                  className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-rose-500/20"
                                  title="Excluir Venda"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            ) : viewMode === 'form' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="fixed inset-0 z-[200] bg-slate-50 overflow-y-auto"
              >
                <div className="min-h-screen flex flex-col">
                  <header className="sticky top-0 z-10 bg-white border-b border-slate-100 p-6 flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-brand-dark rounded-2xl flex items-center justify-center mb-3 shadow-lg relative">
                      <FormInput className="text-brand-light" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-medium text-brand-dark uppercase tracking-tighter">Registrar Venda</h2>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-none mt-1">Canal Direto • Hub Nogueira</p>
                    </div>
                  </header>
                  
                  <div className="flex-1 flex items-center justify-center p-0 md:p-10">
                    <SaleForm />
                  </div>
                </div>
              </motion.div>
            ) : null}
          </main>
        </div>
      </div>

      <div className="absolute top-10 right-10 opacity-5 pointer-events-none">
        <Award size={400} strokeWidth={1} />
      </div>
    </div>
  );
}


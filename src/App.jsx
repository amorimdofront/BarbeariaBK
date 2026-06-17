import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import AgendamentoModal from './AgendamentoModal';
import PainelAdmin from './PainelAdmin';
import './App.css'; 

// Imagens representativas para os serviços
const imagemCorte = 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=600&auto=format&fit=crop';
const imagemBarba = 'https://images.unsplash.com/photo-1593702275687-f8b402bf1fb5?q=80&w=600&auto=format&fit=crop';
const imagemCorteBarba = 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=600&auto=format&fit=crop';

function App() {
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Autenticação e Navegação
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [mostrarAuth, setMostrarAuth] = useState(false);
  const [mostrarAdmin, setMostrarAdmin] = useState(false);
  
  // Estados de Agendamento
  const [servicoSelecionado, setServicoSelecionado] = useState(null);
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  // 1. RECEPTOR DO MERCADO PAGO (AGORA DENTRO DA FUNÇÃO!)
  useEffect(() => {
    // Lê a URL atual do site para procurar os parâmetros do Mercado Pago
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status'); 
    const preferenceId = params.get('preference_id');

    // Se o cliente voltou com status de aprovado
    if (status === 'approved' && preferenceId) {
      const confirmarRetorno = async () => {
        // Atualiza o banco silenciosamente
        const { error } = await supabase
          .from('agendamentos')
          .update({ status_pagamento: 'aprovado', status: 'confirmado' })
          .eq('pagamento_id', preferenceId);
        
        if (!error) {
          alert('✅ Pagamento aprovado! Seu horário foi confirmado com sucesso na barbearia.');
        }
        
        // Limpa a URL para tirar aqueles códigos feios do Mercado Pago
        window.history.replaceState(null, '', window.location.pathname);
      };

      confirmarRetorno();
    }
  }, []);

  // 2. BUSCA DE SERVIÇOS E SESSÃO
  useEffect(() => {
    async function buscarServicos() {
      // Busca serviços ativos no Supabase
      const { data, error } = await supabase
        .from('servicos')
        .select('*')
        .eq('ativo', true);

      if (error) {
        console.error('Erro ao buscar serviços:', error);
      } else {
        // Se houver serviços no Supabase, substitui os de exemplo
        if (data && data.length > 0) {
          setServicos(data);
        } else {
          // Dados de exemplo baseados na imagem de referência
          setServicos([
            { id: 1, nome: 'Corte Clássico', descricao: 'Corte tradicional com tesoura e máquina.', valor: 35.00, duracao_minutos: 30, imagem: imagemCorte },
            { id: 2, nome: 'Barba', descricao: 'Acabamento perfeito com navalha e toalha quente.', valor: 25.00, duracao_minutos: 20, imagem: imagemBarba },
            { id: 3, nome: 'Corte + Barba', descricao: 'Combo completo para um visual impecável.', valor: 55.00, duracao_minutos: 50, imagem: imagemCorteBarba }
          ]);
        }
      }
      setLoading(false);
    }

    buscarServicos();

    // Verifica se já existe uma sessão ativa ao carregar a página
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUsuarioLogado(session?.user ?? null);
    });

    // Fica escutando se o usuário faz login ou logout
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuarioLogado(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 1. TELA DE LOGIN / CADASTRO
  if (mostrarAuth) {
    return (
      <Auth 
        onVoltar={() => setMostrarAuth(false)} 
        onLoginSuccess={(user) => {
          setUsuarioLogado(user);
          setMostrarAuth(false); // Fecha a tela de login ao logar com sucesso
        }} 
      />
    );
  }

  // 2. TELA DO PAINEL ADMIN
  if (mostrarAdmin) {
    return <PainelAdmin onVoltar={() => setMostrarAdmin(false)} />;
  }

  // 3. TELA PRINCIPAL (LANDING PAGE)
  return (
    <div className="dark-theme-app">
      
      {/* ALERTA GLOBAL DE SUCESSO */}
      {mensagemSucesso && (
        <div className="alerta-global sucesso">
          {mensagemSucesso}
          <button onClick={() => setMensagemSucesso('')}>✕</button>
        </div>
      )}

      {/* MODAL DE AGENDAMENTO */}
      {servicoSelecionado && (
        <AgendamentoModal 
          servico={servicoSelecionado} 
          usuario={usuarioLogado}
          onClose={() => setServicoSelecionado(null)}
          onSuccess={() => {
            setServicoSelecionado(null);
            setMensagemSucesso('Horário agendado com sucesso! Te esperamos na barbearia.');
            setTimeout(() => setMensagemSucesso(''), 5000);
          }}
        />
      )}

      {/* CABEÇALHO */}
      <header className="navbar">
        <div className="navbar-container">
          <div className="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-scissor">
              <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
              <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/>
              <line x1="8.12" y1="8.12" x2="12" y2="12"/>
            </svg>
            <span className="logo-text">Barbearia Stylus</span>
          </div>
          <nav>
            <ul>
              <li>Home</li>
              <li><a href="#servicos" style={{ color: 'inherit', textDecoration: 'none' }}>Serviços</a></li>
              <li>Galeria</li>
              <li>Depoimentos</li>
            </ul>
            
            {/* Botões dinâmicos da Navbar */}
            {usuarioLogado ? (
              <div style={{ display: 'flex', gap: '15px' }}>
                <button className="btn-agendar-nav" style={{ background: 'transparent', color: 'white', border: '1px solid white' }} onClick={() => setMostrarAdmin(true)}>
                  ⚙️ Painel Admin
                </button>
                <button className="btn-agendar-nav" onClick={() => supabase.auth.signOut()}>Sair</button>
              </div>
            ) : (
              <button className="btn-agendar-nav" onClick={() => setMostrarAuth(true)}>Acessar / Agendar</button>
            )}
            
          </nav>
        </div>
      </header>

      {/* SEÇÃO PRINCIPAL (HERO) */}
      <section className="hero">
        <div className="glow-effect"></div>
        <div className="hero-content">
          <h1>BARBEARIA STYLUS</h1>
          <p>Mais que uma barbearia, uma experiência única para cuidar do seu estilo</p>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => !usuarioLogado ? setMostrarAuth(true) : window.location.href="#servicos"}>
              Agende seu horário
            </button>
            <a href="#servicos" className="btn-secondary">Nossos serviços</a>
          </div>
        </div>
      </section>

      {/* SEÇÃO DE SERVIÇOS */}
      <section id="servicos" className="servicos-section">
        <div className="section-header">
          <h2>Nossos Serviços</h2>
          <p className="subtitle">Oferecemos uma variedade de serviços profissionais para cuidar do seu estilo com excelência.</p>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Carregando serviços...</p>
          </div>
        ) : servicos.length === 0 ? (
          <p className="empty-state">Nenhum serviço disponível no momento.</p>
        ) : (
          <div className="grid-servicos">
            {servicos.map((servico) => (
              <div key={servico.id} className="card-servico">
                <div className="card-image-container">
                  <img src={servico.imagem || imagemCorte} alt={servico.nome} className="card-image" />
                </div>
                <div className="card-content">
                  <div className="card-body">
                    <h3>{servico.nome}</h3>
                    <p className="descricao">{servico.descricao}</p>
                  </div>
                  <div className="card-footer">
                    <span className="preco">R$ {servico.valor.toFixed(0)}</span>
                    <span className="duracao">
                      ⏱ {servico.duracao_minutos} min
                    </span>
                    <button 
                      className="btn-agendar-card"
                      onClick={() => {
                        if (!usuarioLogado) {
                          setMostrarAuth(true); // Pede login se não estiver logado
                        } else {
                          setServicoSelecionado(servico); // Abre calendário se estiver logado
                        }
                      }}
                    >
                      Agendar
                    </button>
                  </div>
                </div>
                <div className="card-glow"></div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* RODAPÉ */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-column">
            <h4>Contato</h4>
            <ul>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-footer"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                (71) 99999-9999
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-footer"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                contato@barbeariastylus.com
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-footer"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Rua Da Paz, 123 - Bairro da Paz, Salvador - BA
              </li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Horário de Funcionamento</h4>
            <ul>
              <li>⏱ Segunda à Sexta: 9h às 20h</li>
              <li>⏱ Sábado: 9h às 18h</li>
              <li>⏱ Domingo: Fechado</li>
            </ul>
          </div>
          <div className="footer-column social-column">
            <h4>Redes Sociais</h4>
            <div className="social-icons">
              <a href="#"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
              <a href="#"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 <strong>Barbearia Stylus</strong>. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
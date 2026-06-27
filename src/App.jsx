import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import AgendamentoModal from './AgendamentoModal';
import PainelAdmin from './PainelAdmin';
import PerfilCliente from './PerfilCliente';
import LojaPlanos from './LojaPlanos';
import './App.css';
import navalhadoImg from './assets/navalhado.png';

const imagemCorte = navalhadoImg; // Imagem local para corte
const imagemBarba = 'https://images.unsplash.com/photo-1593702275687-f8b402bf1fb5?q=80&w=600&auto=format&fit=crop';
const imagemCorteBarba = 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=600&auto=format&fit=crop';

function App() {
  const [servicos, setServicos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [mostrarAuth, setMostrarAuth] = useState(false);
  const [mostrarAdmin, setMostrarAdmin] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [mostrarPlanos, setMostrarPlanos] = useState(false);
  const [telaSucesso, setTelaSucesso] = useState(false);
  
  const [servicoSelecionado, setServicoSelecionado] = useState(null);
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'approved') {
      setTelaSucesso(true);
      window.history.replaceState(null, '', window.location.pathname);
    }

    async function init() {
      const { data } = await supabase.from('servicos').select('*').eq('ativo', true);
      setServicos(data && data.length > 0 ? data : [
        { id: 1, nome: 'Corte Clássico', descricao: 'Corte tradicional com tesoura e máquina.', valor: 35.00, duracao_minutos: 30, imagem: imagemCorte },
        { id: 2, nome: 'Barba', descricao: 'Acabamento perfeito com navalha e toalha quente.', valor: 25.00, duracao_minutos: 20, imagem: imagemBarba },
        { id: 3, nome: 'Corte + Barba', descricao: 'Combo completo para um visual impecável.', valor: 55.00, duracao_minutos: 50, imagem: imagemCorteBarba }
      ]);
      
      const { data: { session } } = await supabase.auth.getSession();
      setUsuarioLogado(session?.user ?? null);
      setLoading(false);
    }
    init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuarioLogado(session?.user ?? null);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  if (mostrarAuth) return <Auth onVoltar={() => setMostrarAuth(false)} onLoginSuccess={(user) => { setUsuarioLogado(user); setMostrarAuth(false); }} />;
  if (mostrarAdmin) return <PainelAdmin onVoltar={() => setMostrarAdmin(false)} />;
  if (mostrarPerfil && usuarioLogado) return <PerfilCliente usuario={usuarioLogado} onVoltar={() => setMostrarPerfil(false)} onIrParaPlanos={() => { setMostrarPerfil(false); setMostrarPlanos(true); }} />;
  if (mostrarPlanos && usuarioLogado) return <LojaPlanos usuario={usuarioLogado} onVoltar={() => setMostrarPlanos(false)} />;

  // ====== TELA DE SUCESSO PREMIUM ======
  if (telaSucesso) {
    return (
      <div className="dark-theme-app" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh', 
        padding: '20px',
        background: 'linear-gradient(135deg, #000000 0%, #111111 100%)' // Fundo mais denso
      }}>
        <div className="auth-modal" style={{ 
          textAlign: 'center', 
          maxWidth: '500px',
          width: '100%',
          background: '#151515', 
          border: '1px solid #f39c12', // Borda dourada
          borderRadius: '16px', 
          padding: '40px 30px', 
          boxShadow: '0 10px 40px rgba(243, 156, 18, 0.15)' // Brilho suave dourado
        }}>
          
          <div style={{ 
            width: '80px', 
            height: '80px', 
            background: 'rgba(243, 156, 18, 0.1)', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 20px', 
            border: '2px solid #f39c12' 
          }}>
            {/* Ícone SVG de Check estilisado */}
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f39c12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>

          <h2 style={{ 
            color: '#f39c12', 
            marginBottom: '10px', 
            fontSize: '2.2rem', 
            textTransform: 'uppercase', 
            letterSpacing: '1px' 
          }}>
            Tudo Certo!
          </h2>
          
          <p style={{ color: '#e2e8f0', fontSize: '1.1rem', marginBottom: '20px', lineHeight: '1.6' }}>
            Seu pagamento foi <strong>Aprovado</strong>.
          </p>

          <div style={{ 
            background: 'rgba(255, 255, 255, 0.03)', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '30px', 
            borderLeft: '4px solid #f39c12' 
          }}>
            <p style={{ margin: 0, color: '#94a3b8', fontStyle: 'italic' }}>
              "Venha fazer seu corte e ficar novo de novo!"
            </p>
          </div>

          <button 
            onClick={() => setTelaSucesso(false)} 
            style={{ 
              width: '100%', 
              padding: '15px', 
              fontSize: '1.1rem', 
              background: '#f39c12', 
              color: 'black', 
              fontWeight: 'bold', 
              textTransform: 'uppercase', 
              letterSpacing: '1px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background 0.3s'
            }}
            onMouseOver={(e) => e.target.style.background = '#d68910'}
            onMouseOut={(e) => e.target.style.background = '#f39c12'}
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }
  // =====================================

  return (
    <div className="dark-theme-app">
      {mensagemSucesso && <div className="alerta-global sucesso">{mensagemSucesso} <button onClick={() => setMensagemSucesso('')}>✕</button></div>}
      
      {servicoSelecionado && (
        <AgendamentoModal 
          servico={servicoSelecionado} 
          usuario={usuarioLogado}
          onClose={() => setServicoSelecionado(null)}
          onSuccess={() => { setServicoSelecionado(null); setMensagemSucesso('Agendamento confirmado com sucesso!'); }}
        />
      )}

      <header className="navbar">
        <div className="navbar-container">
          <div className="logo">
            <span className="logo-text">Barbearia do Bakana</span>
          </div>
          <nav>
            <ul>
              <li>Home</li>
              <li><a href="#servicos" style={{ color: 'inherit', textDecoration: 'none' }}>Serviços</a></li>
            </ul>
            {usuarioLogado ? (
              <div style={{ display: 'flex', gap: '15px' }}>
                <button className="btn-agendar-nav" style={{ background: 'transparent', color: 'white', border: '1px solid white' }} onClick={() => setMostrarPerfil(true)}>👤 Meu Perfil</button>
                <button className="btn-agendar-nav" style={{ background: '#f39c12', color: 'black' }} onClick={() => setMostrarPlanos(true)}>💎 Assinar Clube</button>
                {/* Lembre-se de manter o e-mail correto do administrador aqui */}
                {usuarioLogado.email === 'pablo_pan2015@outlook.com' && (
                  <button className="btn-agendar-nav" style={{ background: 'transparent', color: 'white', border: '1px solid white' }} onClick={() => setMostrarAdmin(true)}>⚙️ Painel Admin</button>
                )}
                <button className="btn-agendar-nav" onClick={() => supabase.auth.signOut()}>Sair</button>
              </div>
            ) : (
              <button className="btn-agendar-nav" onClick={() => setMostrarAuth(true)}>Acessar / Agendar</button>
            )}
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="glow-effect"></div>
        <div className="hero-content">
          <h1>BARBEARIA BAKANA</h1>
          <p>Mais que uma barbearia, uma experiência única para cuidar do seu estilo</p>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => !usuarioLogado ? setMostrarAuth(true) : window.location.href="#servicos"}>Agende seu horário</button>
          </div>
        </div>
      </section>

      <section id="servicos" className="servicos-section">
        <div className="section-header">
          <h2>Nossos Serviços</h2>
          <p className="subtitle">Oferecemos uma variedade de serviços profissionais para cuidar do seu estilo com excelência.</p>
        </div>
        {loading ? (
          <div className="loading-container"><div className="spinner"></div></div>
        ) : (
          <div className="grid-servicos">
            {servicos.map((s) => (
              <div key={s.id} className="card-servico">
                <div className="card-image-container">
                  <img src={s.imagem || imagemCorte} alt={s.nome} className="card-image" />
                </div>
                <div className="card-content">
                  <div className="card-body">
                    <h3>{s.nome}</h3>
                    <p className="descricao">{s.descricao}</p>
                  </div>
                  <div className="card-footer">
                    <span className="preco">R$ {s.valor.toFixed(0)}</span>
                    <span className="duracao">⏱ {s.duracao_minutos} min</span>
                    <button className="btn-agendar-card" onClick={() => !usuarioLogado ? setMostrarAuth(true) : setServicoSelecionado(s)}>Agendar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* RODAPÉ INSERIDO AQUI */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-column">
            <h4>Contato</h4>
            <ul>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-footer"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                (71) 99676-9201
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-footer"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                SemNoMomento@gmail.com
              </li>
              <li>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-footer"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Rua da Resistência , 34 - 41515230 Bairro da Paz - Salvador/BA
              </li>
            </ul>
          </div>
          <div className="footer-column">
            <h4>Horário de Funcionamento</h4>
            <ul>
              <li>⏱ Segunda à Sexta: 8h às 20h</li>
              <li>⏱ Sábado: 9h às 14h</li>
              <li>⏱ Domingo: Fechado</li>
            </ul>
          </div>
          <div className="footer-column social-column">
            <h4>Redes Sociais</h4>
            <div className="social-icons">
              <a href="https://www.instagram.com/bakanabarber_ofc?igsh=ej" target="_blank" rel="noopener noreferrer">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 <strong>Barbearia Do Bakana</strong>. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
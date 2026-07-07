import { useState } from 'react';
import { supabase } from './supabaseClient';
import planobkImage from './assets/planobk.png';
import planobarbaImage from './assets/planobarba.png';
import planobasicoImage from './assets/planobasico.png';
const PLANOS = [
  { 
    id: 'basico', 
    nome: 'Plano Básico', 
    valor: 1, 
    servicos: 4, 
    destaque: false,
    beneficios: ['4 Cortes por mês', 'Desconto em pomadas', 'Agendamento prático'],
    // Pode colocar a URL da sua imagem aqui ou usar um import
    imagem: planobasicoImage
  },
  { 
    id: 'barba', 
    nome: 'Plano Barba', 
    valor: 180, 
    servicos: 4, 
    destaque: false,
    beneficios: ['4 Barbas', ' premium'],
    imagem: planobarbaImage
  },
  { 
    id: 'bk', 
    nome: 'Plano BK VIP', 
    valor: 250,
    servicos: 4, 
    destaque: true,
    beneficios: ['4 Cortes + Barba', 'Prioridade na Agenda', 'Tratamento de Rei'],
    imagem: planobkImage
  }
];

export default function LojaPlanos({ usuario, onVoltar }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const assinarPlano = async (plano) => {
    setLoading(true);
    setErro('');
    
    try {
      const ACCESS_TOKEN = 'APP_USR-5888724309282332-121722-f264b12e3b0f72771a5c336e21099951-3074782821';

      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${ACCESS_TOKEN}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          items: [{ title: plano.nome, unit_price: plano.valor, quantity: 1, currency_id: 'BRL' }],
          payer: { name: usuario.user_metadata?.nome || 'Cliente', email: usuario.email },
          back_urls: { 
            success: "https://barbearia-bk.vercel.app/", 
            failure: "https://barbearia-bk.vercel.app/", 
            pending: "https://barbearia-bk.vercel.app/" 
          },
          auto_return: "approved",
          external_reference: `assinatura_${plano.id}_${usuario.id}`,
        })
      });

      const data = await response.json();

      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        console.error("Erro detalhado do MP:", data);
        setErro('O Mercado Pago recusou a criação do link: ' + (data.message || 'Verifique o console.'));
      }
    } catch (err) {
      console.error(err);
      setErro("Falha na comunicação com o Mercado Pago.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', padding: '20px' }}>
      <div className="admin-header-top" style={{ borderBottom: '1px solid #333', paddingBottom: '20px', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '2rem', color: '#f39c12', textTransform: 'uppercase', letterSpacing: '1px' }}>Clube de Assinatura BK</h2>
        <button className="btn-secundario" onClick={onVoltar} style={{ padding: '10px 20px', borderRadius: '8px' }}>Voltar ao Site</button>
      </div>

      {erro && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ef4444', textAlign: 'center', fontWeight: 'bold' }}>
          {erro}
        </div>
      )}

      <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '40px', fontSize: '1.1rem' }}>
        Escolha o plano ideal para manter o seu estilo impecável o mês inteiro.
      </p>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '30px', 
        maxWidth: '1000px', 
        margin: '0 auto' 
      }}>
        {PLANOS.map(p => (
          <div key={p.id} style={{ 
            background: p.destaque ? 'linear-gradient(180deg, #1f1a0b 0%, #111 100%)' : '#111',
            border: p.destaque ? '2px solid #f39c12' : '1px solid #333',
            borderRadius: '16px',
            padding: '20px', // Reduzi um pouco para dar espaço à imagem
            textAlign: 'center',
            position: 'relative',
            transition: 'transform 0.3s, box-shadow 0.3s',
            boxShadow: p.destaque ? '0 10px 30px rgba(243, 156, 18, 0.15)' : 'none',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {p.destaque && (
              <div style={{
                position: 'absolute',
                top: '-15px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#f39c12',
                color: 'black',
                padding: '5px 15px',
                borderRadius: '20px',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                zIndex: 2
              }}>
                Mais Escolhido
              </div>
            )}

            {/* FOTO DO PLANO */}
            <div style={{
              width: '100%',
              height: '160px',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '20px',
              border: p.destaque ? '1px solid rgba(243, 156, 18, 0.3)' : '1px solid rgba(255,255,255,0.05)'
            }}>
              <img 
                src={p.imagem} 
                alt={`Imagem do ${p.nome}`} 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transition: 'transform 0.3s ease'
                }}
                onMouseOver={e => e.target.style.transform = 'scale(1.05)'}
                onMouseOut={e => e.target.style.transform = 'scale(1)'}
              />
            </div>

            <h3 style={{ fontSize: '1.5rem', color: p.destaque ? '#f39c12' : 'white', marginBottom: '10px' }}>{p.nome}</h3>
            
            <div style={{ margin: '15px 0', paddingBottom: '20px', borderBottom: '1px solid #333' }}>
              <span style={{ fontSize: '1.2rem', color: '#888' }}>R$</span>
              <span style={{ fontSize: '3.5rem', fontWeight: 'bold', color: 'white', marginLeft: '5px' }}>{p.valor}</span>
              <span style={{ color: '#888' }}>/mês</span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 30px 0', textAlign: 'left', flex: 1 }}>
              {p.beneficios.map((ben, index) => (
                <li key={index} style={{ marginBottom: '12px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#34d399', fontWeight: 'bold' }}>✓</span> {ben}
                </li>
              ))}
            </ul>

            <button 
              style={{ 
                width: '100%', 
                padding: '15px', 
                fontSize: '1.1rem',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: p.destaque ? '#f39c12' : '#333',
                color: p.destaque ? 'black' : 'white',
                textTransform: 'uppercase',
                transition: 'background 0.3s'
              }} 
              onClick={() => assinarPlano(p)} 
              disabled={loading}
              onMouseOver={(e) => { if(!loading) e.target.style.background = p.destaque ? '#d68910' : '#444' }}
              onMouseOut={(e) => { if(!loading) e.target.style.background = p.destaque ? '#f39c12' : '#333' }}
            >
              {loading ? 'Redirecionando...' : 'Assinar Agora'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
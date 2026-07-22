import { useState } from 'react';
import { supabase } from './supabaseClient';
import planobkImage from './assets/planobk.png';
import planobarbaImage from './assets/planobarba.png';
import planobasicoImage from './assets/planobasico.png';

const PLANOS = [
  { 
    id: 'basico', 
    nome: 'Assinatura Básica', 
    valor: 90, 
    servicos: 4, 
    destaque: false,
    beneficios: ['4 Cortes por mês', 'Desconto em pomadas', 'Agendamento prático'],
    imagem: planobasicoImage
  },
  { 
    id: 'bk', 
    nome: 'Assinatura VIP', 
    valor: 130,
    servicos: 4, 
    destaque: true,
    beneficios: ['4 Cortes + Barba', 'Sobrancelha', '2 Pigmentações'],
    imagem: planobkImage
  }
];

export default function LojaPlanos({ usuario, onVoltar }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [cpfCliente, setCpfCliente] = useState(''); 
  
  // 🛡️ Novo estado para a Forma de Pagamento
  const [metodoPagamento, setMetodoPagamento] = useState('PIX');

  // Função para formatar o CPF
  const handleCpfChange = (e) => {
    let value = e.target.value.replace(/\D/g, ''); 
    if (value.length > 11) value = value.slice(0, 11); 
    
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    
    setCpfCliente(value);
  };

  const assinarPlano = async (plano) => {
    setErro('');
    
    const cpfLimpo = cpfCliente.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      setErro('Por favor, informe um CPF válido (11 dígitos) antes de assinar o plano.');
      return;
    }

    setLoading(true);
    
    try {
      const ASAAS_API_KEY = import.meta.env.VITE_ASAAS_API_KEY;
      // ==========================================
      // ETAPA 1: Criar o Cliente no Asaas
      // ==========================================
      const customerResponse = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers: { 
          'access_token': ASAAS_API_KEY, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          name: usuario.user_metadata?.nome || 'Cliente BK',
          email: usuario.email,
          cpfCnpj: cpfLimpo, 
          externalReference: usuario.id 
        })
      });

      const customerData = await customerResponse.json();
      
      if (customerData.errors) {
        throw new Error(customerData.errors[0].description);
      }

      const customerId = customerData.id;

      // ==========================================
      // ETAPA 2: Criar a Cobrança com a Taxa Calculada
      // ==========================================
      
      // 🧮 Calcula o valor final: Se for cartão, adiciona 5% de taxa
      const valorFinal = metodoPagamento === 'CREDIT_CARD' 
        ? Number(plano.valor) * 1.05 
        : Number(plano.valor);

      const paymentResponse = await fetch(`${ASAAS_URL}/payments`, {
        method: 'POST',
        headers: { 
          'access_token': ASAAS_API_KEY, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          customer: customerId,
          billingType: metodoPagamento, // Envia 'PIX' ou 'CREDIT_CARD' invés de UNDEFINED
          value: Number(valorFinal.toFixed(2)), // Valor com ou sem a taxa embutida
          dueDate: new Date().toISOString().split('T')[0], 
          description: `Assinatura - ${plano.nome}`, 
          externalReference: `pacote_${plano.id}_${usuario.id}`
        })
      });

      const paymentData = await paymentResponse.json();

      if (paymentData.errors) {
        throw new Error(paymentData.errors[0].description);
      }

      // Redireciona para a tela de pagamento do Asaas
      if (paymentData.invoiceUrl) {
        window.location.href = paymentData.invoiceUrl; 
      }

    } catch (err) {
      console.error(err);
      setErro(`Erro ao gerar pagamento: ${err.message}`);
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

      <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: '30px', fontSize: '1.1rem' }}>
        Escolha o plano ideal para manter o seu estilo impecável o mês inteiro.
      </p>

      {/* 🛡️ CONTROLES DE PAGAMENTO (CPF e Forma de Pagamento) */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        justifyContent: 'center', 
        gap: '20px', 
        marginBottom: '40px',
        background: '#111',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #333',
        maxWidth: '700px',
        margin: '0 auto 40px auto'
      }}>
        
        <div style={{ flex: '1', minWidth: '250px' }}>
          <label style={{ display: 'block', color: 'white', marginBottom: '8px', fontSize: '1rem' }}>
            Seu CPF:
          </label>
          <input 
            type="text" 
            placeholder="000.000.000-00"
            value={cpfCliente}
            onChange={handleCpfChange}
            style={{
              padding: '12px 15px', borderRadius: '8px', border: '1px solid #f39c12',
              background: '#000', color: 'white', fontSize: '1.1rem', width: '100%', outline: 'none'
            }}
          />
        </div>

        <div style={{ flex: '1', minWidth: '250px' }}>
          <label style={{ display: 'block', color: 'white', marginBottom: '8px', fontSize: '1rem' }}>
            Forma de Pagamento:
          </label>
          <select 
            value={metodoPagamento}
            onChange={(e) => setMetodoPagamento(e.target.value)}
            style={{
              padding: '12px 15px', borderRadius: '8px', border: '1px solid #f39c12',
              background: '#000', color: 'white', fontSize: '1.1rem', width: '100%', outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="PIX">Pix (Sem taxas)</option>
            <option value="CREDIT_CARD">Cartão de Crédito (+5% de taxa)</option>
          </select>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '30px', 
        maxWidth: '1000px', 
        margin: '0 auto' 
      }}>
        {PLANOS.map(p => {
          // 🧮 Atualiza o valor exibido na tela em tempo real dependendo do método escolhido
          const valorExibido = metodoPagamento === 'CREDIT_CARD' 
            ? (p.valor * 1.05).toFixed(2) 
            : p.valor.toFixed(2);

          return (
            <div key={p.id} style={{ 
              background: p.destaque ? 'linear-gradient(180deg, #1f1a0b 0%, #111 100%)' : '#111',
              border: p.destaque ? '2px solid #f39c12' : '1px solid #333',
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center',
              position: 'relative',
              transition: 'transform 0.3s, box-shadow 0.3s',
              boxShadow: p.destaque ? '0 10px 30px rgba(243, 156, 18, 0.15)' : 'none',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {p.destaque && (
                <div style={{
                  position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
                  background: '#f39c12', color: 'black', padding: '5px 15px', borderRadius: '20px',
                  fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', zIndex: 2
                }}>
                  Mais Escolhido
                </div>
              )}

              {/* FOTO DO PLANO */}
              <div style={{
                width: '100%', height: '160px', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px',
                border: p.destaque ? '1px solid rgba(243, 156, 18, 0.3)' : '1px solid rgba(255,255,255,0.05)'
              }}>
                <img 
                  src={p.imagem} 
                  alt={`Imagem do ${p.nome}`} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                  onMouseOver={e => e.target.style.transform = 'scale(1.05)'}
                  onMouseOut={e => e.target.style.transform = 'scale(1)'}
                />
              </div>

              <h3 style={{ fontSize: '1.5rem', color: p.destaque ? '#f39c12' : 'white', marginBottom: '10px' }}>{p.nome}</h3>
              
              <div style={{ margin: '15px 0', paddingBottom: '20px', borderBottom: '1px solid #333' }}>
                <span style={{ fontSize: '1.2rem', color: '#888' }}>R$</span>
                {/* 🌟 Aqui o valor muda sozinho se ele marcar cartão! */}
                <span style={{ fontSize: '3.5rem', fontWeight: 'bold', color: 'white', marginLeft: '5px' }}>
                  {valorExibido.replace('.', ',')}
                </span>
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
                  width: '100%', padding: '15px', fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '8px', border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: p.destaque ? '#f39c12' : '#333', color: p.destaque ? 'black' : 'white',
                  textTransform: 'uppercase', transition: 'background 0.3s'
                }} 
                onClick={() => assinarPlano(p)} 
                disabled={loading}
                onMouseOver={(e) => { if(!loading) e.target.style.background = p.destaque ? '#d68910' : '#444' }}
                onMouseOut={(e) => { if(!loading) e.target.style.background = p.destaque ? '#f39c12' : '#333' }}
              >
                {loading ? 'Redirecionando...' : 'Assinar Agora'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
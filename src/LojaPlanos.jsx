import { useState } from 'react';
import { supabase } from './supabaseClient';

const PLANOS = [
  { id: 'basico', nome: 'Plano Basico', valor: 100, servicos: 4 },
  { id: 'barba', nome: 'Plano Barba', valor: 180, servicos: 4 },
  { id: 'bk', nome: 'Plano bk', valor: 250, servicos: 4 }
];

export default function LojaPlanos({ usuario, onVoltar }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const assinarPlano = async (plano) => {
    setLoading(true);
    setErro('');
    
    try {
      // O seu Token de Teste do Mercado Pago
      const ACCESS_TOKEN = 'TEST-1701025156407162-021100-0422e3248ffbf41bf142bdfd102920ef-266359559';

      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${ACCESS_TOKEN}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          items: [{ title: plano.nome, unit_price: plano.valor, quantity: 1, currency_id: 'BRL' }],
          payer: { name: usuario.user_metadata?.nome || 'Cliente', email: usuario.email },
          // AQUI ESTÁ A CORREÇÃO MÁXIMA: URLs explícitas e blindadas
          back_urls: { 
            success: "https://barbearia-bk.vercel.app/", 
            failure: "https://barbearia-bk.vercel.app/", 
            pending: "https://barbearia-bk.vercel.app/" 
          },
          auto_return: "approved",
          external_reference: `assinatura_${plano.id}_${usuario.id}`
        })
      });

      const data = await response.json();

      if (data.init_point) {
        // Redireciona o cliente para a tela de pagamento do Mercado Pago
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
    <div className="admin-container">
      <div className="admin-header-top">
        <h2>Clube de Assinatura BK</h2>
        <button className="btn-secundario" onClick={onVoltar}>Voltar ao Site</button>
      </div>

      {erro && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ef4444', textAlign: 'center' }}>
          {erro}
        </div>
      )}

      <div className="admin-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        {PLANOS.map(p => (
          <div key={p.id} className="auth-modal" style={{ textAlign: 'center', padding: '30px', margin: 0 }}>
            <h3>{p.nome}</h3>
            <h2 style={{ fontSize: '2.5rem', margin: '20px 0', color: '#f39c12' }}>R$ {p.valor}</h2>
            <p style={{ marginBottom: '20px', color: '#94a3b8' }}>Dá direito a <strong style={{ color: 'white' }}>{p.servicos} serviços</strong> por mês.</p>
            <button className="btn-primary" style={{ width: '100%' }} onClick={() => assinarPlano(p)} disabled={loading}>
              {loading ? 'Processando...' : 'Contratar Agora'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
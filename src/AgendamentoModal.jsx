import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react';

// 1. INICIALIZE O MERCADO PAGO COM SUA CHAVE PÚBLICA
initMercadoPago('TEST-626f2425-396b-4968-a4bb-bc383a65c026', { locale: 'pt-BR' });

export default function AgendamentoModal({ servico, usuario, onClose, onSuccess }) {
  const [data, setData] = useState('');
  const [horario, setHorario] = useState('');
  const [horariosDoBanco, setHorariosDoBanco] = useState([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  
  const [preferenceId, setPreferenceId] = useState(null);
  const [mensagemStatus, setMensagemStatus] = useState(''); // Controla a mensagem automática na tela

  // 1. BUSCA HORÁRIOS LIVRES QUANDO A DATA MUDA
  useEffect(() => {
    if (!data) return;
    async function buscarHorariosLivres() {
      setLoadingHorarios(true);
      setHorario(''); 
      const { data: slots, error } = await supabase
        .from('horarios_disponiveis')
        .select('horario')
        .eq('data', data)
        .eq('disponivel', true);

      if (!error) {
        setHorariosDoBanco(slots.map(s => s.horario.substring(0, 5)));
      }
      setLoadingHorarios(false);
    }
    buscarHorariosLivres();
  }, [data]);

  // 2. RASTREADOR AUTOMÁTICO DE PAGAMENTO (POLLING)
  useEffect(() => {
    let intervalo;

    // Só começa a rastrear se a cobrança já foi gerada na tela
    if (preferenceId) {
      intervalo = setInterval(async () => {
        try {
          const ACCESS_TOKEN = 'TEST-1701025156407162-021100-0422e3248ffbf41bf142bdfd102920ef-266359559';
          
          // Pergunta ao Mercado Pago se existe algum pagamento atrelado a esta cobrança
          const response = await fetch(`https://api.mercadopago.com/v1/payments/search?preference_id=${preferenceId}`, {
            headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
          });
          
          const dataMP = await response.json();

          // Se achou um pagamento, verifica o status
          if (dataMP.results && dataMP.results.length > 0) {
            const pagamento = dataMP.results[0];

            if (pagamento.status === 'approved') {
              clearInterval(intervalo); // Para o rastreamento
              setMensagemStatus('✅ Pagamento Aprovado! Seu horário está confirmado.');
              
              // Atualiza o Supabase automaticamente
              await supabase
                .from('agendamentos')
                .update({ status_pagamento: 'aprovado', status: 'confirmado' })
                .eq('pagamento_id', preferenceId);

              // Espera 3 segundos para o cliente ler a mensagem e fecha o modal
              setTimeout(() => {
                onSuccess(); 
              }, 3000);
              
            } else if (pagamento.status === 'rejected') {
              setMensagemStatus('❌ Pagamento recusado pelo cartão. Tente novamente.');
            }
          }
        } catch (err) {
          console.error("Erro no rastreio do pagamento:", err);
        }
      }, 4000); // Executa a cada 4 segundos
    }

    // Limpa o rastreador se o cliente fechar o modal antes
    return () => clearInterval(intervalo);
  }, [preferenceId, onSuccess]);


  // 3. GERA A COBRANÇA
  const gerarPagamento = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');

    try {
      const ACCESS_TOKEN = 'TEST-1701025156407162-021100-0422e3248ffbf41bf142bdfd102920ef-266359559';

      console.log("1. Iniciando chamada ao Mercado Pago...");
      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: [{ title: `Agendamento: ${servico.nome}`, unit_price: Number(servico.valor), quantity: 1, currency_id: 'BRL' }],
          payer: { name: usuario.user_metadata?.nome || 'Cliente', email: usuario.email },
          back_urls: {
            success: "https://barbearia-bk.vercel.app/",
            failure: "https://barbearia-bk.vercel.app/",
            pending: "https://barbearia-bk.vercel.app/"
          },
          auto_return: "approved"
        })
      });

      const dataMP = await response.json();
      console.log("2. Resposta bruta do Mercado Pago:", dataMP);

      if (dataMP.id) {
        console.log("3. Preference ID gerado com sucesso:", dataMP.id);
        
        // Validação das datas para evitar quebras de fuso horário
        const dataHoraInicio = new Date(`${data}T${horario}:00-03:00`);
        const dataHoraFim = new Date(dataHoraInicio.getTime() + (servico.duracao_minutos || 30) * 60000);

        if (isNaN(dataHoraInicio.getTime())) {
          throw new Error("Formato de data ou horário inválido.");
        }

        console.log("4. Tentando inserir agendamento no Supabase...");
        const { error: dbError } = await supabase
          .from('agendamentos')
          .insert([{
            cliente_id: usuario.id,
            servico_id: servico.id,
            pagamento_id: dataMP.id,
            data_hora_inicio: dataHoraInicio.toISOString(),
            data_hora_fim: dataHoraFim.toISOString(),
            status: 'pendente',
            status_pagamento: 'aguardando',
            metodo_pagamento: 'mercado_pago'
          }]);

        if (dbError) {
          console.error("❌ Erro retornado pelo Supabase:", dbError);
          setErro(`Erro no Banco: [${dbError.code}] ${dbError.message}`);
          return;
        }

        console.log("5. Agendamento criado! Atualizando tabela de horários...");
        const { error: slotError } = await supabase
          .from('horarios_disponiveis')
          .update({ disponivel: false })
          .eq('data', data)
          .eq('horario', `${horario}:00`);

        if (slotError) {
          console.error("⚠️ Erro ao ocupar horário:", slotError);
        }

        // Só exibe o botão do Mercado Pago se salvou tudo corretamente
        setPreferenceId(dataMP.id); 

      } else {
        console.error("❌ Mercado Pago rejeitou os parâmetros:", dataMP);
        setErro('Erro Mercado Pago: ' + (dataMP.message || 'Parâmetros inválidos.'));
      }

    } catch (err) {
      console.error("❌ Erro capturado no bloco catch:", err);
      setErro('Falha no processo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const dataDeHoje = new Date().toISOString().split('T')[0];

  return (
    <div className="auth-overlay">
      <div className="auth-modal agendamento-modal">
        <button className="btn-fechar" onClick={onClose} disabled={preferenceId || mensagemStatus.includes('✅')}>✕</button>
        
        <div className="auth-header">
          <h2>Agendar {servico.nome}</h2>
        </div>

        {erro && <div className="alerta erro">{erro}</div>}

        {preferenceId ? (
          <div className="checkout-container" style={{ textAlign: 'center', marginTop: '20px' }}>
            <p style={{ color: 'var(--text-muted)' }}>Finalize o pagamento de R$ {servico.valor.toFixed(2)} abaixo:</p>
            
            <div style={{ pointerEvents: mensagemStatus.includes('✅') ? 'none' : 'auto', opacity: mensagemStatus.includes('✅') ? 0.5 : 1 }}>
              <Wallet initialization={{ preferenceId: preferenceId }} customization={{ texts: { valueProp: 'security_safety' } }} />
            </div>

            {/* MENSAGEM DINÂMICA AO INVÉS DO BOTÃO */}
            {mensagemStatus ? (
              <p style={{ 
                marginTop: '20px', 
                fontWeight: 'bold', 
                fontSize: '1.1rem',
                color: mensagemStatus.includes('✅') ? '#34d399' : '#ef4444' 
              }}>
                {mensagemStatus}
              </p>
            ) : (
              <p style={{ color: '#fbbf24', marginTop: '20px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fbbf24' }}></span>
                Aguardando pagamento...
              </p>
            )}
            
          </div>
        ) : (
          <form onSubmit={gerarPagamento} className="auth-form">
            <div className="input-group">
              <label>Data</label>
              <input type="date" required min={dataDeHoje} value={data} onChange={(e) => setData(e.target.value)} />
            </div>

            {data && (
              <div className="input-group">
                <label>Horários Disponíveis</label>
                {loadingHorarios ? <p style={{ color: '#94a3b8' }}>Buscando vagas...</p> : 
                  <div className="grid-horarios">
                    {horariosDoBanco.map(h => (
                      <button key={h} type="button" className={`btn-horario ${horario === h ? 'selecionado' : ''}`} onClick={() => setHorario(h)}>
                        {h}
                      </button>
                    ))}
                  </div>
                }
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={loading || !data || !horario} style={{ marginTop: '20px' }}>
              {loading ? 'Processando...' : 'Ir para Pagamento'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
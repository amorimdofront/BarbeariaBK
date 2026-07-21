import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react';

initMercadoPago('APP_USR-02a3b70e-f235-4680-a732-3ec374751c26', { locale: 'pt-BR' });

const mesesNomes = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function AgendamentoModal({ servico, usuario, onClose, onSuccess }) {
  const hoje = new Date();
  const [mesAtivo, setMesAtivo] = useState(hoje.getMonth());
  const [anoAtivo, setAnoAtivo] = useState(hoje.getFullYear());
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  const [data, setData] = useState('');
  const [horario, setHorario] = useState('');
  const [horariosDoBanco, setHorariosDoBanco] = useState([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  
  const [preferenceId, setPreferenceId] = useState(null);
  const [mensagemStatus, setMensagemStatus] = useState('');
  const [assinatura, setAssinatura] = useState(null);
  
  const [temAgendamentoAberto, setTemAgendamentoAberto] = useState(false);
  const [loadingVerificacao, setLoadingVerificacao] = useState(true);

  // 🖱️ Lógica para Arrastar os Meses no Computador
  const scrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const diasNoMes = new Date(anoAtivo, mesAtivo + 1, 0).getDate();
  const listaDias = Array.from({ length: diasNoMes }, (_, i) => i + 1);

  useEffect(() => {
    async function verificarRegrasCliente() {
      setLoadingVerificacao(true);
      
      const { data: agendamentosConfirmados } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('cliente_id', usuario.id)
        .eq('status', 'confirmado') 
        .limit(1);
        
      if (agendamentosConfirmados && agendamentosConfirmados.length > 0) {
        setTemAgendamentoAberto(true);
        setLoadingVerificacao(false);
        return; 
      }

      const { data } = await supabase
        .from('assinaturas')
        .select('*')
        .eq('cliente_id', usuario.id)
        .eq('status', 'ativa')
        .gt('servicos_restantes', 0)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        const planoAtual = data[0];
        if (planoAtual.data_vencimento) {
          const validade = new Date(planoAtual.data_vencimento);
          const agora = new Date();
          if (agora >= validade) {
            await supabase.from('assinaturas').update({ status: 'vencido' }).eq('id', planoAtual.id);
            setAssinatura(null); 
            setLoadingVerificacao(false);
            return;
          }
        }
        setAssinatura(planoAtual);
      }
      
      setLoadingVerificacao(false);
    }
    verificarRegrasCliente();
  }, [usuario.id]);

  useEffect(() => {
    setDiaSelecionado(null); setData(''); setHorario(''); setHorariosDoBanco([]);
  }, [mesAtivo]);

  const handleDiaClick = (dia) => {
    setDiaSelecionado(dia);
    setData(`${anoAtivo}-${String(mesAtivo + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
  };

  useEffect(() => {
    if (!data) return;
    async function buscarHorariosLivres() {
      setLoadingHorarios(true); setHorario(''); 
      const { data: slots, error } = await supabase.from('horarios_disponiveis').select('horario').eq('data', data).eq('disponivel', true).order('horario', { ascending: true });
      if (!error && slots) setHorariosDoBanco(slots.map(s => s.horario.substring(0, 5)));
      setLoadingHorarios(false);
    }
    buscarHorariosLivres();
  }, [data]);

  useEffect(() => {
    let intervalo;
    if (preferenceId) {
      intervalo = setInterval(async () => {
        try {
          const ACCESS_TOKEN = 'APP_USR-515042990931776-071412-a1f85ea12159922220fc0239b6e7af3d-230216815';
          const response = await fetch(`https://api.mercadopago.com/v1/payments/search?preference_id=${preferenceId}`, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
          const dataMP = await response.json();

          if (dataMP.results && dataMP.results.length > 0) {
            const pagamento = dataMP.results[0];
            if (pagamento.status === 'approved') {
              clearInterval(intervalo); 
              setMensagemStatus('✅ Pagamento Aprovado! Seu horário está confirmado.');
              await supabase.from('agendamentos').update({ status_pagamento: 'aprovado', status: 'confirmado' }).eq('pagamento_id', preferenceId);
              setTimeout(() => onSuccess(), 3000);
            } else if (pagamento.status === 'rejected') {
              setMensagemStatus('❌ Pagamento recusado pelo cartão. Tente novamente.');
            }
          }
        } catch (err) { console.error("Erro:", err); }
      }, 4000); 
    }
    return () => clearInterval(intervalo);
  }, [preferenceId, onSuccess]);

  const gerarPagamento = async (e) => {
    e.preventDefault(); setLoading(true); setErro('');

    const dataHoraInicio = new Date(`${data}T${horario}:00-03:00`);
    const dataHoraFim = new Date(dataHoraInicio.getTime() + (servico.duracao_minutos || 30) * 60000);

    if (isNaN(dataHoraInicio.getTime())) { setErro("Formato de data ou horário inválido."); setLoading(false); return; }

    try {
      if (assinatura) {
        const { error: dbError } = await supabase.from('agendamentos').insert([{
          cliente_id: usuario.id, servico_id: servico.id, data_hora_inicio: dataHoraInicio.toISOString(),
          data_hora_fim: dataHoraFim.toISOString(), status: 'confirmado', status_pagamento: 'aprovado',
          usado_credito_assinatura: true, metodo_pagamento: 'credito_assinatura'
        }]);
        if (dbError) throw new Error(`Falha: ${dbError.message}`);

        const { error: updateError } = await supabase.from('horarios_disponiveis').update({ disponivel: false }).eq('data', data).eq('horario', `${horario}:00`);
        if (updateError) throw new Error(`Falha: ${updateError.message}`);

        setMensagemStatus('🌟 Agendamento reservado pelo seu PLANO BK!');
        setTimeout(() => onSuccess(), 2500);

      } else {
        const ACCESS_TOKEN = 'APP_USR-515042990931776-071412-a1f85ea12159922220fc0239b6e7af3d-230216815';
        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ title: `Agendamento: ${servico.nome}`, unit_price: Number(servico.valor), quantity: 1, currency_id: 'BRL' }],
            payer: { name: usuario.user_metadata?.nome || 'Cliente', email: usuario.email },
            back_urls: { success: "https://www.barbeariadobakana.com/", failure: "https://www.barbeariadobakana.com/", pending: "https://www.barbeariadobakana.com/" },
            auto_return: "approved"
          })
        });

        const dataMP = await response.json();

        if (dataMP.id) {
          const { error: dbError } = await supabase.from('agendamentos').insert([{
            cliente_id: usuario.id, servico_id: servico.id, pagamento_id: dataMP.id,
            data_hora_inicio: dataHoraInicio.toISOString(), data_hora_fim: dataHoraFim.toISOString(),
            status: 'pendente', status_pagamento: 'aguardando', metodo_pagamento: 'mercado_pago'
          }]);
          if (dbError) throw new Error(`Falha: ${dbError.message}`);
          setPreferenceId(dataMP.id); 
        } else {
          throw new Error('Erro Mercado Pago: ' + (dataMP.message || 'Parâmetros inválidos.'));
        }
      }
    } catch (err) { setErro(err.message); } finally { setLoading(false); }
  };

  // Funções para controle do arrastar dos meses e cliques nas setas
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };
  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Velocidade do arrasto
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };
  const scrollarMeses = (direcao) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direcao === 'esq' ? -150 : 150, behavior: 'smooth' });
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal agendamento-modal" style={{ maxWidth: '600px', width: '95%' }}>
        <button className="btn-fechar" onClick={onClose} disabled={preferenceId || mensagemStatus.includes('✅') || mensagemStatus.includes('🌟')}>✕</button>
        <div className="auth-header"><h2>Agendar {servico.nome}  <br /></h2>
        <h4>Pagamentos via cartão em manutenção</h4>
        </div>
        
        {erro && <div className="alerta erro">{erro}</div>}

        {loadingVerificacao ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#f39c12' }}>
            <span className="spinner" style={{ width: '30px', height: '30px', borderTopColor: '#f39c12', marginBottom: '15px' }}></span>
            <p>Verificando sua conta...</p>
          </div>
        ) : temAgendamentoAberto ? (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '20px', borderRadius: '8px', textAlign: 'center', margin: '20px 0' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>⚠️ Agendamento Bloqueado</h3>
            <p style={{ margin: 0 }}>Você já possui um agendamento em aberto. Conclua ou peça para cancelar seu serviço pendente antes de marcar um novo horário.</p>
          </div>
        ) : (
          <>
            {assinatura && !preferenceId && !mensagemStatus && (
              <div style={{ background: 'rgba(243, 156, 18, 0.15)', border: '1px solid #f39c12', color: '#f39c12', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold', textAlign: 'center' }}>
                🌟 Sócio Clube BK: O crédito será descontado após a conclusão do serviço no salão. ({assinatura.servicos_restantes} restantes)
              </div>
            )}

            {preferenceId ? (
              <div className="checkout-container" style={{ textAlign: 'center', marginTop: '20px' }}>
                <p style={{ color: 'var(--text-muted)' }}>Finalize o pagamento de R$ {servico.valor.toFixed(2)} abaixo:</p>
                <div style={{ pointerEvents: mensagemStatus.includes('✅') ? 'none' : 'auto', opacity: mensagemStatus.includes('✅') ? 0.5 : 1 }}>
                  <Wallet initialization={{ preferenceId: preferenceId }} customization={{ texts: { valueProp: 'security_safety' } }} />
                </div>
                {mensagemStatus ? ( <p style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '1.1rem', color: mensagemStatus.includes('✅') ? '#34d399' : '#ef4444' }}>{mensagemStatus}</p> ) : (
                  <p style={{ color: '#fbbf24', marginTop: '20px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fbbf24' }}></span>Aguardando pagamento...</p>
                )}
              </div>
            ) : mensagemStatus.includes('🌟') ? (
                <div style={{ textAlign: 'center', padding: '30px' }}><div style={{ fontSize: '3rem', marginBottom: '10px' }}>✂️</div><h3 style={{ color: '#34d399' }}>{mensagemStatus}</h3></div>
            ) : (
              <form onSubmit={gerarPagamento} className="auth-form">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
                  <button type="button" onClick={() => setAnoAtivo(anoAtivo - 1)} disabled={anoAtivo <= hoje.getFullYear()} style={{ background: 'none', border: 'none', color: anoAtivo <= hoje.getFullYear() ? '#333' : '#f39c12', fontSize: '1.5rem', cursor: anoAtivo <= hoje.getFullYear() ? 'not-allowed' : 'pointer' }}>◀</button>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{anoAtivo}</span>
                  <button type="button" onClick={() => setAnoAtivo(anoAtivo + 1)} style={{ background: 'none', border: 'none', color: '#f39c12', fontSize: '1.5rem', cursor: 'pointer' }}>▶</button>
                </div>

                {/* 🖱️ NOVO SELETOR DE MESES COM SETAS E ARRASTE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                  <button type="button" onClick={() => scrollarMeses('esq')} style={{ background: 'none', border: 'none', color: '#f39c12', fontSize: '1.2rem', cursor: 'pointer', padding: '0 5px' }}>❮</button>
                  
                  <div 
                    className={`seletor-meses ${isDragging ? 'arrastando' : ''}`}
                    ref={scrollRef}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                  >
                    {mesesNomes.map((mes, index) => {
                      const isMesPassado = index < hoje.getMonth() && anoAtivo === hoje.getFullYear();
                      return ( 
                        <button 
                          key={mes} 
                          type="button" 
                          className={`mes-item ${mesAtivo === index ? 'ativo' : ''} ${isMesPassado ? 'passado' : ''}`} 
                          onClick={() => { if (!isMesPassado && !isDragging) setMesAtivo(index); }} 
                          disabled={isMesPassado}
                        >
                          {mes}
                        </button> 
                      );
                    })}
                  </div>

                  <button type="button" onClick={() => scrollarMeses('dir')} style={{ background: 'none', border: 'none', color: '#f39c12', fontSize: '1.2rem', cursor: 'pointer', padding: '0 5px' }}>❯</button>
                </div>

                <div className="grid-dias">
                  {listaDias.map(dia => {
                      const isDiaPassado = dia < hoje.getDate() && mesAtivo === hoje.getMonth() && anoAtivo === hoje.getFullYear();
                      return ( <button key={dia} type="button" disabled={isDiaPassado} className={`dia-item ${diaSelecionado === dia ? 'selecionado' : ''} ${isDiaPassado ? 'desabilitado' : ''}`} onClick={() => handleDiaClick(dia)}>{dia}</button> )
                  })}
                </div>

                {data && (
                  <div className="horarios-section" style={{ marginTop: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-muted)' }}>Horários para dia {diaSelecionado} de {mesesNomes[mesAtivo]}</label>
                    {loadingHorarios ? ( <p style={{ color: '#fbbf24', textAlign: 'center' }}>Buscando vagas...</p> ) : horariosDoBanco.length > 0 ? (
                      <div className="grid-horarios">
                        {horariosDoBanco.map(h => ( <button key={h} type="button" className={`btn-horario ${horario === h ? 'selecionado' : ''}`} onClick={() => setHorario(h)}>{h}</button> ))}
                      </div>
                    ) : ( <p style={{ color: '#ef4444', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>Nenhum horário disponível.</p> )}
                  </div>
                )}
                <button type="submit" className="auth-submit" disabled={loading || !data || !horario} style={{ marginTop: '25px', width: '100%', padding: '15px' }}>
                  {loading ? 'Processando...' : assinatura ? 'Confirmar Agendamento' : `Ir para Pagamento (R$ ${servico.valor.toFixed(2)})`}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        /* Alteração Crítica AQUI: Permite a rolagem na caixa do modal */
        .agendamento-modal { 
          max-height: 90vh; 
          overflow-y: auto; 
          display: flex;
          flex-direction: column;
        }

        .seletor-meses { display: flex; overflow-x: auto; gap: 15px; scrollbar-width: none; flex: 1; cursor: grab; padding: 5px 0; }
        .seletor-meses.arrastando { cursor: grabbing; }
        .seletor-meses::-webkit-scrollbar { display: none; }
        .mes-item { background: none; border: none; color: #888; font-size: 1rem; cursor: pointer; white-space: nowrap; padding: 5px 10px; transition: 0.3s; outline: none; }
        .mes-item.ativo { color: #f39c12; font-weight: bold; border-bottom: 2px solid #f39c12; }
        .mes-item.passado { opacity: 0.3; cursor: not-allowed; }
        .grid-dias { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 10px; }
        .dia-item { background: #222; border: 1px solid #333; color: white; padding: 12px 5px; border-radius: 8px; cursor: pointer; transition: 0.2s; text-align: center; font-size: 1rem; }
        .dia-item:hover:not(.desabilitado) { background: #333; border-color: #f39c12; }
        .dia-item.selecionado { background: #f39c12; color: black; border-color: #f39c12; font-weight: bold; }
        .dia-item.desabilitado { opacity: 0.2; cursor: not-allowed; background: #111; border-color: #222; }
        .grid-horarios { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; }
        .btn-horario { background: #222; border: 1px solid #444; color: white; padding: 10px; border-radius: 8px; cursor: pointer; transition: 0.2s; font-size: 1rem; }
        .btn-horario:hover { border-color: #f39c12; }
        .btn-horario.selecionado { background: #34d399; border-color: #34d399; color: black; font-weight: bold; }
      `}} />
    </div>
  );
}
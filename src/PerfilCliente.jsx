import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function PerfilCliente({ usuario, onVoltar, onIrParaPlanos }) {
  const [agendamentos, setAgendamentos] = useState([]);
  const [agendamentosFiltrados, setAgendamentosFiltrados] = useState([]);
  const [assinatura, setAssinatura] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(usuario?.user_metadata?.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => { if (usuario) buscarHistoricoEAssinatura(); }, [usuario]);

  const buscarHistoricoEAssinatura = async () => {
    setLoading(true);
    try {
      const { data: agData } = await supabase.from('agendamentos')
        .select(`id, data_hora_inicio, status, status_pagamento, usado_credito_assinatura, servicos(nome, valor)`)
        .eq('cliente_id', usuario.id)
        .order('data_hora_inicio', { ascending: false }); 
      setAgendamentos(agData || []);
      setAgendamentosFiltrados(agData || []);

      const { data: assData } = await supabase.from('assinaturas')
        .select('*')
        .eq('cliente_id', usuario.id)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (assData && assData.length > 0) {
        let assAtual = assData[0];
        
        // AUTO-SUSPENSÃO: Verifica se já passou da validade
        if (assAtual.status === 'ativa' && assAtual.data_vencimento) {
          const validade = new Date(assAtual.data_vencimento);
          if (new Date() >= validade) {
            assAtual.status = 'vencido';
            await supabase.from('assinaturas').update({ status: 'vencido' }).eq('id', assAtual.id);
          }
        }
        setAssinatura(assAtual);
      }
    } catch (err) { console.error("Erro:", err); } 
    finally { setLoading(false); }
  };

  const handleUploadAvatar = async (event) => {
    try {
      setUploadingAvatar(true);
      const file = event.target.files[0];
      if (!file) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${usuario.id}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      setAvatarUrl(publicUrl);
    } catch (error) { alert('Erro no upload.'); } finally { setUploadingAvatar(false); }
  };

  useEffect(() => {
    let filtrado = agendamentos;
    if (dataInicio) filtrado = filtrado.filter(ag => ag.data_hora_inicio.split('T')[0] >= dataInicio);
    if (dataFim) filtrado = filtrado.filter(ag => ag.data_hora_inicio.split('T')[0] <= dataFim);
    setAgendamentosFiltrados(filtrado);
  }, [dataInicio, dataFim, agendamentos]);

  const formatarDataHora = (iso) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  let corPlano = '#f39c12';
  const nomePlano = assinatura?.plano_nome?.toLowerCase();
  if (nomePlano === 'basico' || nomePlano === 'básico') corPlano = '#3b82f6';
  if (nomePlano === 'barba') corPlano = '#10b981';

  const getCorStatusPagamento = (status, usadoCredito) => {
    if (usadoCredito) return { color: '#f39c12', bg: 'rgba(243, 156, 18, 0.1)', text: 'SÓCIO (CRÉDITO)' };
    if (status === 'aprovado' || status === 'approved') return { color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)', text: 'APROVADO' };
    if (status === 'negado' || status === 'recusado' || status === 'rejected') return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', text: 'NEGADO' };
    return { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', text: 'AGUARDANDO' };
  };

  return (
    <div className="admin-container">
      <div className="admin-header-top"><h2>Meu Perfil</h2><button className="btn-secundario" onClick={onVoltar}>Voltar ao Site</button></div>
      <div className="admin-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          
          <div className="auth-modal" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '25px', margin: 0 }}>
            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
              {avatarUrl ? <img src={avatarUrl} alt="Perfil" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #333' }} /> : <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#f39c12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: 'black', fontWeight: 'bold' }}>{usuario?.user_metadata?.nome ? usuario.user_metadata.nome.charAt(0).toUpperCase() : 'C'}</div>}
              <label style={{ position: 'absolute', bottom: '-5px', right: '-5px', background: '#3b82f6', color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '3px solid #1a1a1a' }}><input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadAvatar} disabled={uploadingAvatar} />{uploadingAvatar ? <span className="spinner" style={{ width: '12px', height: '12px' }}></span> : '📷'}</label>
            </div>
            <div>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '1.4rem' }}>{usuario?.user_metadata?.nome || 'Cliente'}</h3>
              <p style={{ margin: 0, color: '#94a3b8' }}>{usuario?.email}</p>
            </div>
          </div>

          <div className="auth-modal" style={{ padding: '20px', margin: 0, border: `1px solid ${assinatura && assinatura.status === 'ativa' ? corPlano : (assinatura && assinatura.status === 'vencido' ? '#ef4444' : '#333')}` }}>
            <h3 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>💎 Meu Clube 
              {assinatura && (assinatura.status === 'ativa' || assinatura.status === 'vencido') && (
                <span style={{ background: assinatura.status === 'vencido' ? '#ef4444' : corPlano, color: (nomePlano === 'bk' && assinatura.status === 'ativa') ? 'black' : 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>{assinatura.plano_nome.toUpperCase()}</span>
              )}
            </h3>
            
            {!assinatura ? (
              <div><p style={{ color: '#94a3b8' }}>Você ainda não é sócio do nosso Clube.</p><span style={{ color: '#f39c12', fontSize: '0.9rem' }}>Acesse "Clube" no menu superior para ver os planos.</span></div>
            ) : assinatura.status === 'vencido' ? (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid #ef4444' }}>
                <p style={{ color: '#ef4444', fontWeight: 'bold', margin: '0 0 5px 0' }}>Seu plano expirou!</p>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#94a3b8' }}>Venceu em: {formatarDataHora(assinatura.data_vencimento)}</p>
                <button className="btn-primary" style={{ background: '#ef4444', width: '100%' }} onClick={onIrParaPlanos}>Renovar Clube Agora</button>
              </div>
            ) : assinatura.status === 'inativa' ? (
              <div><p style={{ color: '#ef4444', fontWeight: 'bold' }}>Sua assinatura está Inativa.</p></div>
            ) : (
              <div>
                <p style={{ color: '#34d399', fontWeight: 'bold' }}>Status: Ativo</p>
                {assinatura.data_vencimento ? (
                  <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '5px' }}>Válido até: <strong style={{color: 'white'}}>{formatarDataHora(assinatura.data_vencimento)}</strong></p>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: '#fbbf24', marginTop: '5px', background: 'rgba(251, 191, 36, 0.1)', padding: '5px', borderRadius: '4px' }}>⏳ A validade de 1 mês será iniciada no seu 1º agendamento.</p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '10px' }}>
                  <span>Serviços restantes:</span><strong>{assinatura.servicos_restantes} / 4</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', marginTop: '5px', overflow: 'hidden' }}>
                  <div style={{ width: `${(assinatura.servicos_restantes / 4) * 100}%`, height: '100%', background: corPlano, borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="auth-modal" style={{ padding: '20px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 15px 0' }}>Filtrar Histórico</h4>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: '1 1 200px' }}><label>Início</label><input type="date" className="admin-input" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
            <div className="input-group" style={{ flex: '1 1 200px' }}><label>Fim</label><input type="date" className="admin-input" value={dataFim} onChange={e => setDataFim(e.target.value)} /></div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="btn-secundario" style={{ height: '42px' }} onClick={() => { setDataInicio(''); setDataFim(''); }}>Limpar Filtro</button></div>
          </div>
        </div>

        <h3>Meus Agendamentos</h3>
        {loading ? <div className="loading-container"><div className="spinner"></div></div> : agendamentosFiltrados.length === 0 ? (
          <div className="auth-modal" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}><p>Nenhum histórico encontrado.</p></div>
        ) : (
          <div className="table-wrapper" style={{ marginTop: '15px' }}>
            <table className="admin-table">
              <thead><tr><th>Data e Hora</th><th>Serviço</th><th>Status da Vaga</th><th>Pagamento</th><th>Valor Original</th></tr></thead>
              <tbody>
                {agendamentosFiltrados.map(ag => {
                  const pagStatus = getCorStatusPagamento(ag.status_pagamento, ag.usado_credito_assinatura);
                  return (
                    <tr key={ag.id}>
                      <td className="destaque-data">{formatarDataHora(ag.data_hora_inicio)}</td>
                      <td style={{ fontWeight: 'bold' }}>{ag.servicos?.nome || 'Serviço Excluído'}</td>
                      <td><span className={`badge-status ${ag.status}`}>{ag.status}</span></td>
                      <td><span style={{ color: pagStatus.color, background: pagStatus.bg, padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>{pagStatus.text}</span></td>
                      <td>R$ {ag.servicos?.valor?.toFixed(2) || '0.00'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
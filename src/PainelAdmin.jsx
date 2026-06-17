import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function PainelAdmin({ onVoltar }) {
  const [abaAtiva, setAbaAtiva] = useState('agenda'); // agenda, servicos, clientes, config_agenda
  
  // Estados de Dados
  const [agendamentos, setAgendamentos] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [agendaCriada, setAgendaCriada] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados dos Formulários
  const [formServico, setFormServico] = useState({ id: null, nome: '', descricao: '', valor: '', duracao_minutos: '', ativo: true });
  const [editandoServico, setEditandoServico] = useState(false);
  const [novaDataSlot, setNovaDataSlot] = useState('');
  const [novoHorarioSlot, setNovoHorarioSlot] = useState('');

  useEffect(() => {
    carregarDados();
  }, [abaAtiva]);

  async function carregarDados() {
    setLoading(true);
    try {
      if (abaAtiva === 'agenda') {
        const { data } = await supabase
          .from('agendamentos')
          .select('id, data_hora_inicio, status, clientes(nome, telefone), servicos(nome, valor)')
          .order('data_hora_inicio', { ascending: true });
        setAgendamentos(data || []);
      } else if (abaAtiva === 'servicos') {
        const { data } = await supabase.from('servicos').select('*').order('nome');
        setServicos(data || []);
      } else if (abaAtiva === 'clientes') {
        const { data } = await supabase.from('clientes').select('*').order('nome');
        setClientes(data || []);
      } else if (abaAtiva === 'config_agenda') {
        const { data } = await supabase
          .from('horarios_disponiveis')
          .select('*')
          .gte('data', new Date().toISOString().split('T')[0]) // Traz só de hoje para frente
          .order('data', { ascending: true })
          .order('horario', { ascending: true });
        setAgendaCriada(data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    }
    setLoading(false);
  }

  // --- CONTROLE DA AGENDA DE CLIENTES ---
  // --- CONTROLE DA AGENDA DE CLIENTES ---
  const atualizarStatus = async (ag, novoStatus) => {
    const { error } = await supabase.from('agendamentos').update({ status: novoStatus }).eq('id', ag.id);
    
    if (!error) {
      carregarDados(); // Atualiza a tabela na tela

      // Se o status for "confirmado", dispara o WhatsApp para o cliente
      if (novoStatus === 'confirmado') {
        const telefoneLimpo = ag.clientes?.telefone?.replace(/\D/g, '');
        const nomeCliente = ag.clientes?.nome?.split(' ')[0]; // Pega só o primeiro nome
        const nomeServico = ag.servicos?.nome;
        
        // Formata a data para a mensagem ficar amigável (ex: 15/06 às 14:00)
        const dataObj = new Date(ag.data_hora_inicio);
        const dataFormatada = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(dataObj);
        const horaFormatada = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(dataObj);

        const mensagem = `Olá, ${nomeCliente}! ✂️\n\nPassando para avisar que o seu agendamento para *${nomeServico}* no dia *${dataFormatada} às ${horaFormatada}* foi confirmado com sucesso na Barbearia Stylus.\n\nTe esperamos lá!`;
        
        const urlZap = `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(mensagem)}`;
        window.open(urlZap, '_blank');
      }
    }
  };

  // --- GERENCIAMENTO DE SERVIÇOS ---
  const salvarServico = async (e) => {
    e.preventDefault();
    const dados = { ...formServico, valor: parseFloat(formServico.valor), duracao_minutos: parseInt(formServico.duracao_minutos) };
    if (editandoServico) {
      await supabase.from('servicos').update(dados).eq('id', formServico.id);
    } else {
      delete dados.id;
      await supabase.from('servicos').insert([dados]);
    }
    setEditandoServico(false);
    setFormServico({ id: null, nome: '', descricao: '', valor: '', duracao_minutos: '', ativo: true });
    carregarDados();
  };

  // --- GERENCIAMENTO DE HORÁRIOS DISPONÍVEIS ---
  const criarHorarioDisponivel = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('horarios_disponiveis')
      .insert([{ data: novaDataSlot, horario: novoHorarioSlot, disponivel: true }]);

    if (error) {
      alert('Erro ou Horário já cadastrado para este dia!');
    } else {
      setNovoHorarioSlot('');
      carregarDados();
    }
  };

  const deletarHorarioDisponivel = async (id) => {
    if (confirm('Deseja remover este horário das opções dos clientes?')) {
      await supabase.from('horarios_disponiveis').delete().eq('id', id);
      carregarDados();
    }
  };

  // --- FORMATADORES ---
  const formatarData = (isoString) => {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(isoString));
  };

  const formatarDataSimples = (dataString) => {
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <div className="admin-container">
      <div className="admin-header-top">
        <h2>Painel de Gerenciamento</h2>
        <button className="btn-secundario" onClick={onVoltar}>Sair do Painel</button>
      </div>

      <div className="admin-tabs">
        <button className={`tab-btn ${abaAtiva === 'agenda' ? 'active' : ''}`} onClick={() => setAbaAtiva('agenda')}>📅 Próximos Agendamentos</button>
        <button className={`tab-btn ${abaAtiva === 'config_agenda' ? 'active' : ''}`} onClick={() => setAbaAtiva('config_agenda')}>⚙️ Configurar Horários</button>
        <button className={`tab-btn ${abaAtiva === 'servicos' ? 'active' : ''}`} onClick={() => setAbaAtiva('servicos')}>✂️ Gerenciar Serviços</button>
        <button className={`tab-btn ${abaAtiva === 'clientes' ? 'active' : ''}`} onClick={() => setAbaAtiva('clientes')}>👥 Clientes</button>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="loading-container"><div className="spinner"></div></div>
        ) : (
          <>
            {/* TAB AGENDA */}
            {abaAtiva === 'agenda' && (
              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr><th>Data e Hora</th><th>Cliente</th><th>Serviço</th><th>Status</th><th>Ações</th></tr>
                  </thead>
                  <tbody>
                    {agendamentos.map((ag) => (
                      <tr key={ag.id}>
                        <td className="destaque-data">{formatarData(ag.data_hora_inicio)}</td>
                        <td>{ag.clientes?.nome} <br/><a href={`https://wa.me/55${ag.clientes?.telefone?.replace(/\D/g, '')}`} target="_blank" className="link-zap" rel="noreferrer">WhatsApp</a></td>
                        <td>{ag.servicos?.nome}</td>
                        <td><span className={`badge-status ${ag.status}`}>{ag.status}</span></td>
                        <td className="acoes-botoes">
                          {ag.status === 'pendente' && (
                            <>
                              <button className="btn-acao btn-confirmar" onClick={() => atualizarStatus(ag, 'confirmado')}>Confirmar</button>
                              <button className="btn-acao btn-cancelar" onClick={() => atualizarStatus(ag, 'cancelado')}>Cancelar</button>
                            </>
                          )}
                          {ag.status === 'confirmado' && (
                            <button className="btn-acao btn-concluir" onClick={() => atualizarStatus(ag, 'concluido')}>Concluir</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONFIGURAÇÃO DA AGENDA DE HORÁRIOS */}
            {abaAtiva === 'config_agenda' && (
              <div className="admin-grid-layout">
                <div className="form-painel">
                  <h3>Liberar Novo Horário</h3>
                  <form onSubmit={criarHorarioDisponivel}>
                    <div className="input-group">
                      <label>Data</label>
                      <input type="date" required min={new Date().toISOString().split('T')[0]} value={novaDataSlot} onChange={e => setNovaDataSlot(e.target.value)} className="admin-input" />
                    </div>
                    <div className="input-group">
                      <label>Horário de Atendimento</label>
                      <input type="time" required value={novoHorarioSlot} onChange={e => setNovoHorarioSlot(e.target.value)} className="admin-input" />
                    </div>
                    <button type="submit" className="btn-acao btn-confirmar" style={{ width: '100%', marginTop: '10px' }}>Abrir Horário para Clientes</button>
                  </form>
                </div>

                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Data</th><th>Horário liberado</th><th>Status da Vaga</th><th>Ações</th></tr>
                    </thead>
                    <tbody>
                      {agendaCriada.map(slot => (
                        <tr key={slot.id}>
                          <td className="destaque-data">{formatarDataSimples(slot.data)}</td>
                          <td>{slot.horario.substring(0, 5)}</td>
                          <td>
                            <span className={`badge-status ${slot.disponivel ? 'confirmado' : 'pendente'}`}>
                              {slot.disponivel ? 'Livre' : 'Reservado'}
                            </span>
                          </td>
                          <td>
                            <button className="btn-acao btn-cancelar" onClick={() => deletarHorarioDisponivel(slot.id)}>Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB SERVIÇOS */}
            {abaAtiva === 'servicos' && (
              <div className="admin-grid-layout">
                <div className="form-painel">
                  <h3>{editandoServico ? 'Editar Serviço' : 'Novo Serviço'}</h3>
                  <form onSubmit={salvarServico}>
                    <input type="text" placeholder="Nome" required value={formServico.nome} onChange={e => setFormServico({...formServico, nome: e.target.value})} className="admin-input" />
                    <textarea placeholder="Descrição" required value={formServico.descricao} onChange={e => setFormServico({...formServico, descricao: e.target.value})} className="admin-input" rows="3"></textarea>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input type="number" placeholder="Preço" required value={formServico.valor} onChange={e => setFormServico({...formServico, valor: e.target.value})} className="admin-input" />
                      <input type="number" placeholder="Duração (min)" required value={formServico.duracao_minutos} onChange={e => setFormServico({...formServico, duracao_minutos: e.target.value})} className="admin-input" />
                    </div>
                    <label style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#94a3b8' }}>
                      <input type="checkbox" checked={formServico.ativo} onChange={e => setFormServico({...formServico, ativo: e.target.checked})} /> Serviço Ativo
                    </label>
                    <button type="submit" className="btn-acao btn-confirmar" style={{ width: '100%', marginTop: '20px' }}>Salvar</button>
                  </form>
                </div>
                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead><tr><th>Serviço</th><th>Preço</th><th>Status</th><th>Ações</th></tr></thead>
                    <tbody>
                      {servicos.map(s => (
                        <tr key={s.id}>
                          <td>{s.nome}</td><td>R$ {s.valor}</td>
                          <td><span className={`badge-status ${s.ativo ? 'confirmado' : 'cancelado'}`}>{s.ativo ? 'Ativo' : 'Inativo'}</span></td>
                          <td><button className="btn-acao" style={{ background: '#3b82f6' }} onClick={() => setFormServico(s)}>Editar</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CLIENTES */}
            {abaAtiva === 'clientes' && (
              <div className="table-wrapper">
                <table className="admin-table">
                  <thead><tr><th>Nome</th><th>WhatsApp</th><th>E-mail</th></tr></thead>
                  <tbody>
                    {clientes.map(c => (
                      <tr key={c.id}>
                        <td>{c.nome}</td>
                        <td><a href={`https://wa.me/55${c.telefone?.replace(/\D/g, '')}`} target="_blank" className="link-zap" rel="noreferrer">{c.telefone}</a></td>
                        <td>{c.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
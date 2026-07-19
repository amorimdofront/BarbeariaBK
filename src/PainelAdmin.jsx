import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export default function PainelAdmin({ onVoltar }) {
  const [abaAtiva, setAbaAtiva] = useState('agenda');
  const [agendamentos, setAgendamentos] = useState([]);
  const [agendamentosFiltrados, setAgendamentosFiltrados] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [agendaCriada, setAgendaCriada] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulários e Configurações
  const [formServico, setFormServico] = useState({ id: null, nome: '', descricao: '', valor: '', duracao_minutos: '', ativo: true, imagem: '' });
  const [editandoServico, setEditandoServico] = useState(false);
  const [uploadingImagem, setUploadingImagem] = useState(false); 
  
  const [novaDataSlot, setNovaDataSlot] = useState('');
  const [novoHorarioSlot, setNovoHorarioSlot] = useState('');
  const [dataMassa, setDataMassa] = useState('');
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFim, setHoraFim] = useState('19:00');
  const [mensagemConfig, setMensagemConfig] = useState({ tipo: '', texto: '' });

  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [historicoServicos, setHistoricoServicos] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // 🛡️ Estado visual para carregamento do botão Concluir/Cancelar
  const [processandoAgendamentoId, setProcessandoAgendamentoId] = useState(null);

  // 📅 ESTADOS PARA O NOVO SISTEMA DE RESERVA MANUAL
  const [modalReserva, setModalReserva] = useState(false);
  const [slotParaReserva, setSlotParaReserva] = useState(null);
  const [loadingReserva, setLoadingReserva] = useState(false);
  const [mensagemReserva, setMensagemReserva] = useState({ tipo: '', texto: '' });
  const [reservaForm, setReservaForm] = useState({
    tipoCliente: 'existente',
    clienteId: '',
    nomeNovo: '',
    telefoneNovo: '',
    servicoId: '',
    usarCredito: false
  });

  const hojeLocal = new Date();
  const strHoje = `${hojeLocal.getFullYear()}-${String(hojeLocal.getMonth() + 1).padStart(2, '0')}-${String(hojeLocal.getDate()).padStart(2, '0')}`;
  
  const [filtroDataInicio, setFiltroDataInicio] = useState(strHoje);
  const [filtroDataFim, setFiltroDataFim] = useState(strHoje);
  const [filtroStatus, setFiltroStatus] = useState('todos');

  useEffect(() => { carregarDados(); }, [abaAtiva]);

  useEffect(() => {
    let filtrado = agendamentos;
    if (filtroDataInicio) filtrado = filtrado.filter(ag => ag.data_hora_inicio.split('T')[0] >= filtroDataInicio);
    if (filtroDataFim) filtrado = filtrado.filter(ag => ag.data_hora_inicio.split('T')[0] <= filtroDataFim);
    if (filtroStatus !== 'todos') filtrado = filtrado.filter(ag => ag.status === filtroStatus);
    setAgendamentosFiltrados(filtrado);
  }, [agendamentos, filtroDataInicio, filtroDataFim, filtroStatus]);

  async function carregarDados() {
    setLoading(true);
    try {
      if (abaAtiva === 'agenda') {
        const { data } = await supabase.from('agendamentos')
          .select('id, data_hora_inicio, status, status_pagamento, usado_credito_assinatura, cliente_id, clientes(nome, telefone), servicos(nome, valor)')
          .order('data_hora_inicio', { ascending: true });
        setAgendamentos(data || []);

      } else if (abaAtiva === 'servicos') {
        const { data } = await supabase.from('servicos').select('*').order('nome');
        setServicos(data || []);

      } else if (abaAtiva === 'config_agenda') {
        const { data } = await supabase.from('horarios_disponiveis').select('*').gte('data', new Date().toISOString().split('T')[0]).order('data', { ascending: true }).order('horario', { ascending: true });
        setAgendaCriada(data || []);

        const { data: listaClientes } = await supabase.from('clientes').select('*').order('nome');
        const { data: listaAssinaturas } = await supabase.from('assinaturas').select('*').order('created_at', { ascending: false });
        
        const unificados = (listaClientes || []).map(cli => {
          let ass = listaAssinaturas?.find(a => a.cliente_id === cli.id);
          return { ...cli, assinatura: ass || null };
        });
        setClientes(unificados);

        const { data: servs } = await supabase.from('servicos').select('*').order('nome');
        setServicos(servs || []);

      } else if (abaAtiva === 'clientes') {
        const { data: listaClientes } = await supabase.from('clientes').select('*').order('nome');
        const { data: listaAssinaturas } = await supabase.from('assinaturas').select('*').order('created_at', { ascending: false });
        
        const unificados = await Promise.all((listaClientes || []).map(async cli => {
          let ass = listaAssinaturas?.find(a => a.cliente_id === cli.id);
          
          if (ass && ass.status === 'ativa' && ass.data_vencimento) {
            if (new Date() >= new Date(ass.data_vencimento)) {
              ass.status = 'vencido';
              await supabase.from('assinaturas').update({ status: 'vencido' }).eq('id', ass.id);
            }
          }
          return { ...cli, assinatura: ass || null };
        }));
        setClientes(unificados);
      }
    } catch (error) { console.error(error); }
    setLoading(false);
  }

  // ==== FUNÇÕES DE RESERVA MANUAL ====
  const abrirModalReserva = (slot) => {
    setSlotParaReserva(slot);
    setReservaForm({
      tipoCliente: 'existente',
      clienteId: '',
      nomeNovo: '',
      telefoneNovo: '',
      servicoId: '',
      usarCredito: false
    });
    setMensagemReserva({ tipo: '', texto: '' });
    setModalReserva(true);
  };

  const realizarReservaManual = async (e) => {
    e.preventDefault();
    setLoadingReserva(true);
    setMensagemReserva({ tipo: '', texto: '' });

    try {
      let finalClienteId = reservaForm.clienteId;
      
      if (reservaForm.tipoCliente === 'novo') {
        if (!reservaForm.nomeNovo) throw new Error("Motivo da falha: O nome do cliente é obrigatório.");
        
        // Gera um e-mail único falso para o banco de dados não travar
        const emailFalso = `cliente_${Date.now()}@bakana.com`;

        const { data: newCli, error: errCli } = await supabase.from('clientes').insert([{
          nome: reservaForm.nomeNovo,
          telefone: reservaForm.telefoneNovo || 'Não informado',
          email: emailFalso
        }]).select().single();
        
        if (errCli) throw new Error("Falha de comunicação: Não foi possível registrar o cliente novo. " + errCli.message);
        finalClienteId = newCli.id;
      } else {
        if (!finalClienteId) throw new Error("Motivo da falha: Você precisa selecionar um cliente na lista.");
      }

      const servico = servicos.find(s => s.id == reservaForm.servicoId);
      if (!servico) throw new Error("Motivo da falha: Serviço inválido ou não selecionado.");

      let statusPagamento = 'aguardando';
      
      if (reservaForm.tipoCliente === 'existente' && reservaForm.usarCredito) {
        const clienteSelecionadoData = clientes.find(c => c.id == finalClienteId);
        
        if (!clienteSelecionadoData?.assinatura || clienteSelecionadoData.assinatura.status !== 'ativa') {
          throw new Error("Motivo da falha: O cliente selecionado não possui um plano ativo no momento.");
        }
        if (clienteSelecionadoData.assinatura.servicos_restantes <= 0) {
          throw new Error(`Reserva Bloqueada: O cliente ${clienteSelecionadoData.nome} não possui mais créditos. Você precisa concluir sem descontar plano ou renovar a assinatura dele.`);
        }
        statusPagamento = 'aprovado'; 
      }

      const dataHoraInicio = new Date(`${slotParaReserva.data}T${slotParaReserva.horario}-03:00`);
      const dataHoraFim = new Date(dataHoraInicio.getTime() + (servico.duracao_minutos || 30) * 60000);

      const { error: agError } = await supabase.from('agendamentos').insert([{
        cliente_id: finalClienteId,
        servico_id: servico.id,
        data_hora_inicio: dataHoraInicio.toISOString(),
        data_hora_fim: dataHoraFim.toISOString(),
        status: 'confirmado', 
        status_pagamento: statusPagamento,
        usado_credito_assinatura: reservaForm.tipoCliente === 'existente' ? reservaForm.usarCredito : false,
        metodo_pagamento: reservaForm.usarCredito ? 'credito_assinatura' : 'presencial'
      }]);

      if (agError) throw new Error("Erro do banco de dados ao salvar a reserva: " + agError.message);

      await supabase.from('horarios_disponiveis').update({ disponivel: false }).eq('id', slotParaReserva.id);

      setMensagemReserva({ tipo: 'sucesso', texto: '✅ Reserva efetuada com sucesso! Já está na agenda.' });
      
      await carregarDados(); 
      setTimeout(() => setModalReserva(false), 2000);

    } catch (err) {
      setMensagemReserva({ tipo: 'erro', texto: err.message });
    } finally {
      setLoadingReserva(false);
    }
  };

  const handleUploadImagemServico = async (event) => {
    try {
      setUploadingImagem(true);
      const file = event.target.files[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `servico-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('servicos').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('servicos').getPublicUrl(fileName);
      
      setFormServico({ ...formServico, imagem: publicUrl });

    } catch (error) {
      console.error("Erro no upload:", error);
      alert('Erro ao enviar imagem.');
    } finally {
      setUploadingImagem(false);
    }
  };

  const salvarServico = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dados = { 
      ...formServico, 
      valor: parseFloat(formServico.valor), 
      duracao_minutos: parseInt(formServico.duracao_minutos) 
    };

    try {
      if (editandoServico) {
        const { error } = await supabase.from('servicos').update(dados).eq('id', formServico.id);
        if (error) throw error;
        alert('Serviço atualizado com sucesso!');
      } else {
        delete dados.id; 
        const { error } = await supabase.from('servicos').insert([dados]);
        if (error) throw error;
        alert('Novo serviço criado com sucesso!');
      }
      
      setEditandoServico(false); 
      setFormServico({ id: null, nome: '', descricao: '', valor: '', duracao_minutos: '', ativo: true, imagem: '' });
      carregarDados();

    } catch (err) {
      console.error("Erro ao salvar serviço:", err);
      alert(`Erro ao salvar serviço: ${err.message}`); 
    } finally {
      setLoading(false);
    }
  };

  const abrirHistoricoCliente = async (cliente) => {
    setClienteSelecionado(cliente); setLoadingHistorico(true);
    try {
      const { data, error } = await supabase.from('agendamentos').select('id, cliente_id, data_hora_inicio, status, status_pagamento, usado_credito_assinatura, servicos(nome, valor)').eq('cliente_id', cliente.id).order('data_hora_inicio', { ascending: false });
      if (!error) setHistoricoServicos(data || []);
    } catch (err) { console.error(err); }
    setLoadingHistorico(false);
  };

  const alternarStatusAssinatura = async (idAssinatura, statusAtual) => {
    const novoStatus = statusAtual === 'ativa' ? 'inativa' : 'ativa';
    const { error } = await supabase.from('assinaturas').update({ status: novoStatus }).eq('id', idAssinatura);
    if (!error) {
      if (clienteSelecionado) setClienteSelecionado(prev => ({ ...prev, assinatura: { ...prev.assinatura, status: novoStatus } }));
      carregarDados();
    }
  };

  const renovarCortesManualmente = async (idAssinatura) => {
    if (window.confirm('Deseja renovar o plano deste cliente? Isso irá restaurar 4 cortes, ativar o plano e resetar o vencimento (um novo ciclo de 30 dias iniciará no próximo corte).')) {
      const { error } = await supabase.from('assinaturas').update({ 
        servicos_restantes: 4, 
        status: 'ativa',
        data_vencimento: null 
      }).eq('id', idAssinatura);

      if (!error) {
        if (clienteSelecionado) setClienteSelecionado(prev => ({ 
          ...prev, 
          assinatura: { ...prev.assinatura, servicos_restantes: 4, status: 'ativa', data_vencimento: null } 
        }));
        carregarDados();
        alert('Plano renovado com sucesso! O vencimento foi resetado.');
      } else {
        alert('Erro ao renovar: ' + error.message);
      }
    }
  };

  const atribuirPlanoManual = async (clienteId, planoNome) => {
    if (window.confirm(`Confirmar o pagamento e ativar o Clube ${planoNome.toUpperCase()} para este cliente?`)) {
      await supabase.from('assinaturas').update({ status: 'inativa' }).eq('cliente_id', clienteId);
      const { data, error } = await supabase.from('assinaturas').insert([{ cliente_id: clienteId, plano_nome: planoNome, status: 'ativa', servicos_restantes: 4, data_vencimento: null }]).select().single();
      if (error) alert('Erro ao ativar plano manual: ' + error.message);
      else {
        if (clienteSelecionado) setClienteSelecionado(prev => ({ ...prev, assinatura: data }));
        carregarDados(); alert(`Clube ${planoNome.toUpperCase()} ativado com sucesso!`);
      }
    }
  };

  // 🛡️ CORREÇÃO DEFINITIVA: Abre a aba ANTES para o navegador do PC não apagar o texto
  const atualizarStatus = async (ag, novoStatus) => {
  if (processandoAgendamentoId === ag.id) return;

  setProcessandoAgendamentoId(ag.id);

  // Abre imediatamente uma aba em branco (ação do clique)
  let whatsappTab = null;

  if (novoStatus === "confirmado") {
    whatsappTab = window.open("", "_blank");

    if (whatsappTab) {
      whatsappTab.document.write(`
        <html>
          <head>
            <title>Aguarde...</title>
            <style>
              body{
                font-family:Arial,sans-serif;
                display:flex;
                justify-content:center;
                align-items:center;
                height:100vh;
                background:#111;
                color:white;
              }
            </style>
          </head>
          <body>
            Abrindo WhatsApp...
          </body>
        </html>
      `);
      whatsappTab.document.close();
    }
  }

  try {

    // Verifica se outro usuário já alterou o status
    const { data: atual } = await supabase
      .from("agendamentos")
      .select("status")
      .eq("id", ag.id)
      .single();

    if (atual?.status === novoStatus) {
      if (whatsappTab) whatsappTab.close();
      return;
    }

    // Atualiza status
    const { error } = await supabase
      .from("agendamentos")
      .update({ status: novoStatus })
      .eq("id", ag.id);

    if (error) throw error;

    // Libera horário caso cancelado
    if (novoStatus === "cancelado") {

      const dataObj = new Date(ag.data_hora_inicio);

      const data =
        `${dataObj.getFullYear()}-` +
        `${String(dataObj.getMonth()+1).padStart(2,"0")}-` +
        `${String(dataObj.getDate()).padStart(2,"0")}`;

      const horario =
        `${String(dataObj.getHours()).padStart(2,"0")}:` +
        `${String(dataObj.getMinutes()).padStart(2,"0")}:00`;

      await supabase
        .from("horarios_disponiveis")
        .update({ disponivel: true })
        .eq("data", data)
        .eq("horario", horario);
    }

    // Lógica do plano
    if (novoStatus === "concluido") {

      const clienteId = ag.cliente_id || clienteSelecionado?.id;

      if (clienteId && ag.usado_credito_assinatura) {

        const { data: planos } = await supabase
          .from("assinaturas")
          .select("*")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending:false })
          .limit(1);

        const plano = planos?.[0];

        if (plano && plano.status === "ativa") {

          if (!plano.data_vencimento) {

            const validade = new Date();
            validade.setMonth(validade.getMonth()+1);

            const novaData = validade.toISOString();

            await supabase
              .from("assinaturas")
              .update({
                data_vencimento: novaData
              })
              .eq("id", plano.id);

            if (
              clienteSelecionado &&
              clienteSelecionado.id === clienteId
            ) {

              setClienteSelecionado(prev => ({
                ...prev,
                assinatura: {
                  ...prev.assinatura,
                  data_vencimento: novaData
                }
              }));
            }
          }
        }
      }
    }

    await carregarDados();

    // --------- WHATSAPP ---------

    if (novoStatus === "confirmado") {

      let telefone = ag.clientes?.telefone || "";

      telefone = telefone.replace(/\D/g, "");

      if (!telefone) {

        if (whatsappTab) whatsappTab.close();

        alert("Cliente não possui telefone cadastrado.");

        return;
      }

      // adiciona DDI apenas se não existir
      if (!telefone.startsWith("55")) {
        telefone = "55" + telefone;
      }

      const dataObj = new Date(ag.data_hora_inicio);

      const data =
        new Intl.DateTimeFormat("pt-BR", {
          day:"2-digit",
          month:"2-digit"
        }).format(dataObj);

      const hora =
        new Intl.DateTimeFormat("pt-BR", {
          hour:"2-digit",
          minute:"2-digit"
        }).format(dataObj);

      const primeiroNome =
        ag.clientes?.nome?.split(" ")[0] || "Cliente";

      const servico =
        ag.servicos?.nome || "serviço";

      const mensagem =
`Olá ${primeiroNome}, Seu agendamento para ${servico} no dia ${data} às ${hora} foi confirmado na Barbearia do Bakana.

📲💈

https://www.barbeariadobakana.com/`;

      const url =
`https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;

      if (whatsappTab) {

        // reutiliza a aba já aberta
        whatsappTab.location.replace(url);

      } else {

        // fallback
        window.location.href = url;

      }

    } else {

      if (whatsappTab) whatsappTab.close();

    }

  } catch (err) {

    console.error(err);

    if (whatsappTab) whatsappTab.close();

    alert("Erro ao atualizar agendamento.");

  } finally {

    setProcessandoAgendamentoId(null);

  }

};


  const gerarHorariosEmMassa = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const [hInicio, mInicio] = horaInicio.split(':').map(Number);
      const [hFim, mFim] = horaFim.split(':').map(Number);
      let minAtuais = hInicio * 60 + mInicio; const minFim = hFim * 60 + mFim;
      if (minAtuais >= minFim) throw new Error("A hora de início deve ser antes da final.");
      const list = [];
      while (minAtuais < minFim) {
        list.push({ data: dataMassa, horario: `${String(Math.floor(minAtuais / 60)).padStart(2, '0')}:${String(minAtuais % 60).padStart(2, '0')}:00`, disponivel: true });
        minAtuais += 30;
      }
      await supabase.from('horarios_disponiveis').insert(list);
      setMensagemConfig({ tipo: 'sucesso', texto: `✅ ${list.length} horários gerados!` });
      setDataMassa(''); carregarDados();
    } catch (err) { setMensagemConfig({ tipo: 'erro', texto: err.message }); }
    finally { setLoading(false); setTimeout(() => setMensagemConfig({ tipo: '', texto: '' }), 5000); }
  };

  const criarHorarioDisponivel = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('horarios_disponiveis').insert([{ data: novaDataSlot, horario: `${novoHorarioSlot}:00`, disponivel: true }]);
    if (error) setMensagemConfig({ tipo: 'erro', texto: 'Erro ou horário já existe!' });
    else { setMensagemConfig({ tipo: 'sucesso', texto: '✅ Horário liberado!' }); setNovoHorarioSlot(''); carregarDados(); }
    setTimeout(() => setMensagemConfig({ tipo: '', texto: '' }), 5000);
  };

  // 🗑️ NOVA FUNÇÃO PARA EXCLUIR HORÁRIOS DA GRADE
  const excluirHorario = async (id) => {
    if (window.confirm("Tem certeza que deseja apagar este horário da grade?")) {
      try {
        const { error } = await supabase.from('horarios_disponiveis').delete().eq('id', id);
        if (error) throw error;
        setMensagemConfig({ tipo: 'sucesso', texto: '✅ Horário apagado com sucesso!' });
        carregarDados();
      } catch (err) {
        setMensagemConfig({ tipo: 'erro', texto: 'Erro ao apagar horário: ' + err.message });
      }
      setTimeout(() => setMensagemConfig({ tipo: '', texto: '' }), 5000);
    }
  };

  const formatarData = (iso) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  const getCorStatusPagamento = (status, usadoCredito) => {
    if (usadoCredito) return { color: '#f39c12', bg: 'rgba(243, 156, 18, 0.1)', text: 'SÓCIO (CRÉDITO)' };
    if (status === 'aprovado' || status === 'approved') return { color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)', text: 'APROVADO' };
    if (status === 'negado' || status === 'recusado' || status === 'rejected') return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', text: 'NEGADO' };
    return { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', text: 'AGUARDANDO' };
  };

  return (
    <div className="admin-container">
      
      {/* ===== ESTILOS RESPONSIVOS INJETADOS ===== */}
      <style>{`
        .table-wrapper { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        
        @media (max-width: 768px) {
          /* Header e Abas */
          .admin-header-top { flex-direction: column; gap: 15px; text-align: center; }
          .admin-header-top button { width: 100%; }
          .admin-tabs { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
          .tab-btn { flex: 1 1 calc(50% - 8px); font-size: 0.9rem; padding: 12px 5px; }
          
          /* Grids que antes dividiam a tela (Serviços e Horários) */
          .admin-grid-layout { grid-template-columns: 1fr !important; }
          
          /* Filtros da Agenda */
          .auth-modal .input-group { flex: 1 1 100% !important; }
          .auth-modal > div > button { flex: 1 1 100%; }
          .auth-modal > div[style*="display: flex; gap: 10px"] { flex-wrap: wrap; width: 100%; }
          
          /* Forçar tabelas a não esmagarem as colunas */
          .admin-table { min-width: 750px; }
          
          /* Botões dentro das tabelas (Ações) */
          .acoes-botoes { display: flex; flex-direction: column; gap: 8px; min-width: 110px; }
          .acoes-botoes button { width: 100%; margin: 0; }
          
          /* Modal do Cliente e de Reserva */
          .auth-modal[style*="maxWidth: 700px"], .auth-modal[style*="maxWidth: 500px"] { width: 95% !important; padding: 15px !important; }
          .auth-modal h3 { font-size: 1.2rem; }
          
          /* Botões de ativar plano manual */
          .auth-modal > div > div > button.btn-acao { flex: 1 1 100% !important; margin-bottom: 5px; }
        }
      `}</style>
      {/* ========================================= */}

      <div className="admin-header-top">
        <h2>Painel Administrativo</h2>
        <button className="btn-secundario" onClick={onVoltar}>Sair do Painel</button>
      </div>

      <div className="admin-tabs">
        <button className={`tab-btn ${abaAtiva === 'agenda' ? 'active' : ''}`} onClick={() => setAbaAtiva('agenda')}>📅 Agenda</button>
        <button className={`tab-btn ${abaAtiva === 'config_agenda' ? 'active' : ''}`} onClick={() => setAbaAtiva('config_agenda')}>⚙️ Horários</button>
        <button className={`tab-btn ${abaAtiva === 'servicos' ? 'active' : ''}`} onClick={() => setAbaAtiva('servicos')}>✂️ Serviços</button>
        <button className={`tab-btn ${abaAtiva === 'clientes' ? 'active' : ''}`} onClick={() => setAbaAtiva('clientes')}>👥 Clientes e Planos</button>
      </div>

      <div className="admin-content">
        {loading ? <div className="loading-container"><div className="spinner"></div></div> : (
          <>
            {abaAtiva === 'agenda' && (
              <div>
                <div className="auth-modal" style={{ padding: '15px', marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end', background: '#111', border: '1px solid #333' }}>
                  <div className="input-group" style={{ flex: '1 1 150px' }}>
                    <label style={{ color: '#94a3b8', marginBottom: '5px', display: 'block' }}>Data Inicial</label>
                    <input type="date" className="admin-input" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} />
                  </div>
                  <div className="input-group" style={{ flex: '1 1 150px' }}>
                    <label style={{ color: '#94a3b8', marginBottom: '5px', display: 'block' }}>Data Final</label>
                    <input type="date" className="admin-input" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} />
                  </div>
                  <div className="input-group" style={{ flex: '1 1 150px' }}>
                    <label style={{ color: '#94a3b8', marginBottom: '5px', display: 'block' }}>Status Vaga</label>
                    <select className="admin-input" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                      <option value="todos">Todos os Status</option>
                      <option value="pendente">Pendentes</option>
                      <option value="confirmado">Confirmados</option>
                      <option value="concluido">Concluídos</option>
                      <option value="cancelado">Cancelados</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-secundario" style={{ height: '42px', padding: '0 20px' }} onClick={() => { setFiltroDataInicio(''); setFiltroDataFim(''); setFiltroStatus('todos'); }}>Ver Tudo</button>
                    <button className="btn-primary" style={{ height: '42px', padding: '0 20px', background: '#f39c12', color: 'black' }} onClick={() => { setFiltroDataInicio(strHoje); setFiltroDataFim(strHoje); setFiltroStatus('todos'); }}>Hoje</button>
                  </div>
                </div>

                {agendamentosFiltrados.length === 0 ? (
                  <div className="auth-modal" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <p>Nenhum agendamento encontrado para este filtro.</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="admin-table">
                      <thead><tr><th>Data e Hora</th><th>Cliente</th><th>Serviço</th><th>Status Vaga</th><th>Pagamento</th><th>Ações</th></tr></thead>
                      <tbody>
                        {agendamentosFiltrados.map(ag => {
                          const pagStatus = getCorStatusPagamento(ag.status_pagamento, ag.usado_credito_assinatura);
                          return (
                            <tr key={ag.id}>
                              <td className="destaque-data">{formatarData(ag.data_hora_inicio).replace(' às ', ' ')}</td>
                              <td>{ag.clientes?.nome} <br/><a href={`https://wa.me/55${ag.clientes?.telefone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="link-zap">WhatsApp</a></td>
                              <td>{ag.servicos?.nome}</td>
                              <td><span className={`badge-status ${ag.status}`}>{ag.status}</span></td>
                              <td>
                                <span style={{ 
                                  color: pagStatus.color, 
                                  background: pagStatus.bg, 
                                  padding: '4px 8px', 
                                  borderRadius: '4px', 
                                  fontSize: '0.85rem', 
                                  fontWeight: 'bold' 
                                }}>
                                  {pagStatus.text}
                                </span>
                              </td>
                              <td className="acoes-botoes">
                                {ag.status === 'pendente' && (
                                  <>
                                    <button className="btn-acao btn-confirmar" disabled={processandoAgendamentoId === ag.id} onClick={() => atualizarStatus(ag, 'confirmado')}>
                                      {processandoAgendamentoId === ag.id ? '...' : 'Confirmar'}
                                    </button>
                                    <button className="btn-acao btn-cancelar" disabled={processandoAgendamentoId === ag.id} onClick={() => atualizarStatus(ag, 'cancelado')}>
                                      {processandoAgendamentoId === ag.id ? '...' : 'Cancelar'}
                                    </button>
                                  </>
                                )}
                                {ag.status === 'confirmado' && (
                                  <>
                                    <button className="btn-acao btn-concluir" disabled={processandoAgendamentoId === ag.id} onClick={() => atualizarStatus(ag, 'concluido')}>
                                      {processandoAgendamentoId === ag.id ? '...' : 'Concluir'}
                                    </button>
                                    <button className="btn-acao btn-cancelar" disabled={processandoAgendamentoId === ag.id} onClick={() => atualizarStatus(ag, 'cancelado')}>
                                      {processandoAgendamentoId === ag.id ? '...' : 'Cancelar'}
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {abaAtiva === 'config_agenda' && (
              <div className="admin-grid-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {mensagemConfig.texto && (
                    <div style={{ padding: '10px', borderRadius: '8px', textAlign: 'center', background: mensagemConfig.tipo === 'sucesso' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: mensagemConfig.tipo === 'sucesso' ? '#34d399' : '#ef4444', border: `1px solid ${mensagemConfig.tipo === 'sucesso' ? '#34d399' : '#ef4444'}` }}>
                      {mensagemConfig.texto}
                    </div>
                  )}
                  <div className="form-painel">
                    <h3>⚡ Gerar Expediente</h3>
                    <form onSubmit={gerarHorariosEmMassa}>
                      <input type="date" required min={new Date().toISOString().split('T')[0]} value={dataMassa} onChange={e => setDataMassa(e.target.value)} className="admin-input" style={{marginBottom: '10px'}} />
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input type="time" required value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className="admin-input" />
                        <input type="time" required value={horaFim} onChange={e => setHoraFim(e.target.value)} className="admin-input" />
                      </div>
                      <button type="submit" className="btn-acao btn-confirmar" style={{ width: '100%', marginTop: '10px', background: '#f39c12', color: 'black' }}>Gerar Grade (30m)</button>
                    </form>
                  </div>
                  <div className="form-painel">
                    <h3>📍 Vaga Avulsa</h3>
                    <form onSubmit={criarHorarioDisponivel}>
                      <input type="date" required min={new Date().toISOString().split('T')[0]} value={novaDataSlot} onChange={e => setNovaDataSlot(e.target.value)} className="admin-input" style={{marginBottom: '10px'}}/>
                      <input type="time" required value={novoHorarioSlot} onChange={e => setNovoHorarioSlot(e.target.value)} className="admin-input" />
                      <button type="submit" className="btn-acao" style={{ width: '100%', marginTop: '10px', background: '#3b82f6' }}>Abrir Vaga</button>
                    </form>
                  </div>
                </div>
                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead><tr><th>Data</th><th>Horário liberado</th><th>Status da Vaga</th><th>Ações</th></tr></thead>
                    <tbody>
                      {agendaCriada.map(slot => (
                        <tr key={slot.id}>
                          <td className="destaque-data">{slot.data.split('-').reverse().join('/')}</td>
                          <td>{slot.horario.substring(0, 5)}</td>
                          <td><span className={`badge-status ${slot.disponivel ? 'confirmado' : 'pendente'}`}>{slot.disponivel ? 'Livre' : 'Reservado'}</span></td>
                          <td style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {slot.disponivel ? (
                              <button className="btn-acao btn-confirmar" style={{ padding: '4px 8px', fontSize: '0.85rem', margin: 0 }} onClick={() => abrirModalReserva(slot)}>
                                Reservar
                              </button>
                            ) : (
                              <span style={{ color: '#888', fontSize: '0.85rem' }}>Indisponível</span>
                            )}
                            
                            {/* BOTÃO X PARA APAGAR HORÁRIO */}
                            <button 
                              className="btn-acao btn-cancelar" 
                              style={{ padding: '4px 10px', fontSize: '0.85rem', margin: 0, background: '#ef4444' }} 
                              onClick={() => excluirHorario(slot.id)}
                              title="Excluir este horário da grade"
                            >
                              ✖
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {abaAtiva === 'servicos' && (
              <div className="admin-grid-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                <div className="form-painel">
                  <h3>{editandoServico ? 'Editar Serviço' : 'Novo Serviço'}</h3>
                  <form onSubmit={salvarServico}>
                    <input type="text" placeholder="Nome" required value={formServico.nome} onChange={e => setFormServico({...formServico, nome: e.target.value})} className="admin-input" style={{marginBottom:'10px'}}/>
                    <textarea placeholder="Descrição" required value={formServico.descricao} onChange={e => setFormServico({...formServico, descricao: e.target.value})} className="admin-input" rows="3" style={{marginBottom:'10px'}}></textarea>
                    
                    <div style={{ display: 'flex', gap: '10px', marginBottom:'10px' }}>
                      <input type="number" placeholder="Preço" required value={formServico.valor} onChange={e => setFormServico({...formServico, valor: e.target.value})} className="admin-input" />
                      <input type="number" placeholder="Duração (min)" required value={formServico.duracao_minutos} onChange={e => setFormServico({...formServico, duracao_minutos: e.target.value})} className="admin-input" />
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '8px' }}>Imagem do Serviço (opcional)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {formServico.imagem && (
                          <img src={formServico.imagem} alt="Preview" style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #333' }} />
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleUploadImagemServico} 
                          disabled={uploadingImagem} 
                          className="admin-input" 
                          style={{ flex: 1, padding: '8px', fontSize: '0.9rem' }} 
                        />
                      </div>
                      {uploadingImagem && <span style={{ color: '#f39c12', fontSize: '0.85rem', display: 'block', marginTop: '5px' }}>Enviando imagem... Aguarde.</span>}
                    </div>

                    <label style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#94a3b8' }}><input type="checkbox" checked={formServico.ativo} onChange={e => setFormServico({...formServico, ativo: e.target.checked})} /> Ativo</label>
                    <button type="submit" className="btn-acao btn-confirmar" disabled={uploadingImagem} style={{ width: '100%', marginTop: '20px' }}>{editandoServico ? 'Atualizar Serviço' : 'Salvar Novo'}</button>
                  </form>
                </div>
                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead><tr><th>Foto</th><th>Serviço</th><th>Preço</th><th>Status</th><th>Ações</th></tr></thead>
                    <tbody>
                      {servicos.map(s => (
                        <tr key={s.id}>
                          <td>
                            {s.imagem ? (
                              <img src={s.imagem} alt={s.nome} style={{ width: '40px', height: '40px', borderRadius: '5px', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '40px', height: '40px', background: '#333', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#888' }}>Sem Foto</div>
                            )}
                          </td>
                          <td style={{ fontWeight: 'bold' }}>{s.nome}</td>
                          <td>R$ {s.valor}</td>
                          <td><span className={`badge-status ${s.ativo ? 'confirmado' : 'cancelado'}`}>{s.ativo ? 'Ativo' : 'Inativo'}</span></td>
                          <td><button className="btn-acao" style={{ background: '#3b82f6' }} onClick={() => { setFormServico(s); setEditandoServico(true); }}>Editar</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {abaAtiva === 'clientes' && (
              <div className="table-wrapper">
                <table className="admin-table">
                  <thead><tr><th>Cliente</th><th>WhatsApp</th><th>Plano Atual</th><th>Status Plano</th><th>Cortes Restantes</th><th>Vencimento</th><th>Ações</th></tr></thead>
                  <tbody>
                    {clientes.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 'bold' }}>{c.nome}</td>
                        <td><a href={`https://wa.me/55${c.telefone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="link-zap">{c.telefone}</a></td>
                        <td><span style={{ color: c.assinatura ? '#f39c12' : '#888' }}>{c.assinatura ? `Clube ${c.assinatura.plano_nome.toUpperCase()}` : 'Nenhum'}</span></td>
                        <td>{c.assinatura ? <span className={`badge-status ${c.assinatura.status === 'vencido' ? 'cancelado' : (c.assinatura.status === 'ativa' ? 'confirmado' : 'pendente')}`}>{c.assinatura.status.toUpperCase()}</span> : '-'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{c.assinatura ? `${c.assinatura.servicos_restantes} / 4` : '-'}</td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {c.assinatura ? (
                            c.assinatura.data_vencimento ? formatarData(c.assinatura.data_vencimento).replace(' às ', ' ') : <span style={{color: '#f39c12'}}>Aguardando 1º uso</span>
                          ) : '-'}
                        </td>
                        <td><button className="btn-acao" style={{ background: '#f39c12', color: 'black' }} onClick={() => abrirHistoricoCliente(c)}>🔎 Ver Detalhes</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {clienteSelecionado && (
        <div className="auth-overlay" style={{ zIndex: 999 }}>
          <div className="auth-modal" style={{ width: '90%', maxWidth: '700px', background: '#1a1a1a', padding: '25px', borderRadius: '15px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>Ficha do Cliente: {clienteSelecionado.nome}</h3>
              <button className="btn-secundario" style={{ padding: '5px 12px' }} onClick={() => setClienteSelecionado(null)}>Fechar</button>
            </div>

            <div style={{ background: '#111', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
              <h4>⚙️ Gerenciamento do Plano</h4>
              {clienteSelecionado.assinatura ? (
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                  <p style={{ margin: 0 }}>Status atual: <strong style={{ color: clienteSelecionado.assinatura.status === 'vencido' ? '#ef4444' : (clienteSelecionado.assinatura.status === 'ativa' ? '#34d399' : '#888') }}>{clienteSelecionado.assinatura.status.toUpperCase()}</strong></p>
                  <p style={{ margin: 0 }}>Franquia: <strong>{clienteSelecionado.assinatura.servicos_restantes} / 4 cortes</strong></p>
                  
                  {clienteSelecionado.assinatura.data_vencimento && (
                    <p style={{ margin: 0, width: '100%', fontSize: '0.9rem', color: '#94a3b8' }}>
                      {clienteSelecionado.assinatura.status === 'vencido' ? 'Venceu em: ' : 'Válido até: '} 
                      <strong style={{color: 'white'}}>{formatarData(clienteSelecionado.assinatura.data_vencimento)}</strong>
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', marginTop: '10px', flexWrap: 'wrap', width: '100%' }}>
                    <button className="btn-acao" style={{ flex: '1 1 100%', background: clienteSelecionado.assinatura.status === 'ativa' ? '#ef4444' : '#34d399', color: clienteSelecionado.assinatura.status === 'ativa' ? 'white' : 'black' }} onClick={() => alternarStatusAssinatura(clienteSelecionado.assinatura.id, clienteSelecionado.assinatura.status)}>{clienteSelecionado.assinatura.status === 'ativa' ? 'Suspender Plano' : 'Ativar Plano'}</button>
                    <button className="btn-acao" style={{ flex: '1 1 100%', background: '#3b82f6' }} onClick={() => renovarCortesManualmente(clienteSelecionado.assinatura.id)}>🔄 Renovar Plano</button>
                  </div>
                </div>
              ) : <p style={{ color: '#888', margin: '5px 0 0 0' }}>Este cliente não possui uma assinatura vinculada no banco.</p>}
            </div>

            <div style={{ background: 'rgba(243, 156, 18, 0.05)', border: '1px solid #f39c12', padding: '15px', borderRadius: '8px', marginBottom: '25px' }}>
              <h4 style={{ color: '#f39c12', margin: '0 0 5px 0' }}>💰 Venda Manual (Dinheiro / Pix)</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '15px' }}>Ative um plano manualmente para este cliente. O cronômetro de 30 dias só inicia no 1º corte.</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn-acao" style={{ background: '#3b82f6', color: 'white', flex: '1 1 100%' }} onClick={() => atribuirPlanoManual(clienteSelecionado.id, 'básico')}>
                  + Básico (R$ 90)
                </button>
                
                <button className="btn-acao" style={{ background: '#f39c12', color: 'white', flex: '1 1 100%' }} onClick={() => atribuirPlanoManual(clienteSelecionado.id, 'bk')}>
                  + VIP (R$ 130)
                </button>
              </div>
            </div>

            <h4>📋 Histórico de Serviços / Agendamentos</h4>
            {loadingHistorico ? <p style={{ color: '#fbbf24', textAlign: 'center' }}>Carregando histórico...</p> : historicoServicos.length === 0 ? <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>Nenhum serviço registrado para este usuário.</p> : (
              <div className="table-wrapper" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                <table className="admin-table" style={{ fontSize: '0.9rem' }}>
                  <thead><tr><th>Data</th><th>Serviço</th><th>Status Vaga</th><th>Pagamento</th><th>Ações</th></tr></thead>
                  <tbody>
                    {historicoServicos.map(h => {
                      const pagStatusInterno = getCorStatusPagamento(h.status_pagamento, h.usado_credito_assinatura);
                      return (
                        <tr key={h.id}>
                          <td>{formatarData(h.data_hora_inicio).replace(' às ', ' ')}</td>
                          <td style={{ fontWeight: 'bold' }}>{h.servicos?.nome || 'Excluído'}</td>
                          <td><span className={`badge-status ${h.status}`}>{h.status}</span></td>
                          <td>
                            <span style={{ 
                              color: pagStatusInterno.color, 
                              background: pagStatusInterno.bg, 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              fontSize: '0.85rem', 
                              fontWeight: 'bold' 
                            }}>
                              {pagStatusInterno.text}
                            </span>
                          </td>
                          <td className="acoes-botoes" style={{ padding: '5px' }}>
                            {h.status === 'pendente' && (
                              <button className="btn-acao btn-confirmar" style={{ padding: '8px', fontSize: '0.8rem' }} disabled={processandoAgendamentoId === h.id} onClick={() => atualizarStatus(h, 'confirmado')}>
                                {processandoAgendamentoId === h.id ? '...' : 'Confirmar'}
                              </button>
                            )}
                            {h.status === 'confirmado' && (
                              <button className="btn-acao btn-concluir" style={{ padding: '8px', fontSize: '0.8rem' }} disabled={processandoAgendamentoId === h.id} onClick={() => atualizarStatus(h, 'concluido')}>
                                {processandoAgendamentoId === h.id ? '...' : 'Concluir'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE RESERVA MANUAL (ÁREA DO ADMIN) */}
      {modalReserva && slotParaReserva && (
        <div className="auth-overlay" style={{ zIndex: 1000 }}>
          <div className="auth-modal" style={{ width: '90%', maxWidth: '500px', background: '#1a1a1a', padding: '25px', borderRadius: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>Reservar Horário</h3>
              <button className="btn-secundario" style={{ padding: '5px 12px' }} onClick={() => setModalReserva(false)}>✕</button>
            </div>

            <p style={{ color: '#f39c12', fontWeight: 'bold', marginBottom: '15px', fontSize: '1.1rem' }}>
              Data: {slotParaReserva.data.split('-').reverse().join('/')} às {slotParaReserva.horario.substring(0, 5)}
            </p>

            <form onSubmit={realizarReservaManual}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ color: '#94a3b8', display: 'block', marginBottom: '10px' }}>Este agendamento é para um:</label>
                <div style={{ display: 'flex', gap: '20px', background: '#111', padding: '10px', borderRadius: '8px' }}>
                  <label style={{ color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input type="radio" checked={reservaForm.tipoCliente === 'existente'} onChange={() => setReservaForm({...reservaForm, tipoCliente: 'existente', usarCredito: false})} /> 
                    Cliente Existente
                  </label>
                  <label style={{ color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input type="radio" checked={reservaForm.tipoCliente === 'novo'} onChange={() => setReservaForm({...reservaForm, tipoCliente: 'novo', usarCredito: false})} /> 
                    Novo Cliente
                  </label>
                </div>
              </div>

              {reservaForm.tipoCliente === 'existente' ? (
                <div style={{ marginBottom: '15px' }}>
                  <select className="admin-input" required value={reservaForm.clienteId} onChange={e => setReservaForm({...reservaForm, clienteId: e.target.value, usarCredito: false})}>
                    <option value="">-- Selecione o Cliente na Lista --</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome} {c.telefone ? `(${c.telefone})` : ''}</option>)}
                  </select>
                  
                  {reservaForm.clienteId && (() => {
                    const cli = clientes.find(c => c.id == reservaForm.clienteId);
                    if (cli?.assinatura?.status === 'ativa') {
                      const creditos = cli.assinatura.servicos_restantes;
                      return (
                        <div style={{ marginTop: '15px', background: 'rgba(243, 156, 18, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid #f39c12' }}>
                          <label style={{ color: '#f39c12', display: 'flex', alignItems: 'center', gap: '8px', cursor: creditos > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                            <input type="checkbox" disabled={creditos <= 0} checked={reservaForm.usarCredito} onChange={e => setReservaForm({...reservaForm, usarCredito: e.target.checked})} style={{ transform: 'scale(1.2)' }} />
                            Agendar usando 1 Crédito do Plano
                          </label>
                          <p style={{ margin: '5px 0 0 0', color: creditos > 0 ? '#94a3b8' : '#ef4444', fontSize: '0.85rem' }}>
                            (Restam: {creditos} cortes na franquia).
                            {creditos <= 0 && " Não é possível descontar, o saldo está zerado!"}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                  <input type="text" placeholder="Nome Completo do Cliente" required className="admin-input" value={reservaForm.nomeNovo} onChange={e => setReservaForm({...reservaForm, nomeNovo: e.target.value})} style={{ flex: '1 1 100%' }} />
                  <input type="text" placeholder="WhatsApp (Opcional)" className="admin-input" value={reservaForm.telefoneNovo} onChange={e => setReservaForm({...reservaForm, telefoneNovo: e.target.value})} style={{ flex: '1 1 100%' }} />
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ color: '#94a3b8', display: 'block', marginBottom: '8px' }}>Selecione o Serviço:</label>
                <select className="admin-input" required value={reservaForm.servicoId} onChange={e => setReservaForm({...reservaForm, servicoId: e.target.value})}>
                  <option value="">-- Escolha um serviço --</option>
                  {servicos.map(s => <option key={s.id} value={s.id}>{s.nome} - R$ {s.valor}</option>)}
                </select>
              </div>

              {mensagemReserva.texto && (
                <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', background: mensagemReserva.tipo === 'sucesso' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: mensagemReserva.tipo === 'sucesso' ? '#34d399' : '#ef4444', border: `1px solid ${mensagemReserva.tipo === 'sucesso' ? '#34d399' : '#ef4444'}`, fontWeight: 'bold' }}>
                  {mensagemReserva.texto}
                </div>
              )}

              <button type="submit" className="btn-acao btn-confirmar" disabled={loadingReserva} style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}>
                {loadingReserva ? 'Processando...' : 'Confirmar e Fechar Vaga'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
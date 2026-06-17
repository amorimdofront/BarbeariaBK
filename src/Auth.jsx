import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth({ onLoginSuccess, onVoltar }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMensagem({ tipo: '', texto: '' });

    try {
      if (isLogin) {
        // Função de Login do Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onLoginSuccess(data.user);
      } else {
        // Função de Cadastro do Supabase
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nome: nome,
              telefone: telefone,
            }
          }
        });
        if (error) throw error;
        
        // Após cadastrar na autenticação, também salvamos na tabela 'clientes'
        if (data.user) {
          const { error: dbError } = await supabase
            .from('clientes')
            .insert([{ id: data.user.id, nome, telefone, email }]);
            
          if (dbError) throw dbError;
        }

        setMensagem({ tipo: 'sucesso', texto: 'Cadastro realizado! Agora você pode fazer login.' });
        setIsLogin(true); // Volta para a tela de login
      }
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: error.message || 'Ocorreu um erro ao processar a solicitação.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <button className="btn-fechar" onClick={onVoltar}>✕</button>
        
        <div className="auth-header">
          <h2>{isLogin ? 'Bem-vindo de volta' : 'Criar nova conta'}</h2>
          <p>{isLogin ? 'Acesse para gerenciar seus horários.' : 'Cadastre-se para agendar seu estilo.'}</p>
        </div>

        {mensagem.texto && (
          <div className={`alerta ${mensagem.tipo}`}>
            {mensagem.texto}
          </div>
        )}

        <form onSubmit={handleAuth} className="auth-form">
          {!isLogin && (
            <>
              <div className="input-group">
                <label>Nome Completo</label>
                <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
              </div>
              <div className="input-group">
                <label>Telefone (WhatsApp)</label>
                <input type="tel" required value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(71) 99999-9999" />
              </div>
            </>
          )}

          <div className="input-group">
            <label>E-mail</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
          </div>

          <div className="input-group">
            <label>Senha</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isLogin ? 'Ainda não tem conta?' : 'Já possui uma conta?'}
            <button className="btn-link" onClick={() => { setIsLogin(!isLogin); setMensagem({ tipo: '', texto: '' }); }}>
              {isLogin ? 'Cadastre-se' : 'Faça login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
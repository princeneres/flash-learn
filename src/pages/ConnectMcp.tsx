import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from '../components/LoadingState';
import { Button } from '../components/ui/button';

type Status = 'connecting' | 'success' | 'error' | 'needs-login';

/**
 * Bridge page for the MCP `login` command.
 *
 * The local `flash-learn-mcp login` server opens this page with `?callback=` (a
 * localhost URL) and `?state=` (a nonce). The user is already authenticated in
 * the app, so we read the existing Supabase session and POST its tokens to the
 * local callback. No token ever has to be copied by hand.
 *
 * We only ever POST to a localhost/127.0.0.1 callback — never an external host.
 */
const ConnectMcp: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<Status>('connecting');
  const [message, setMessage] = useState('Conectando sua conta ao Claude...');
  const sent = useRef(false);

  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(location.search);
    const callback = params.get('callback');
    const state = params.get('state');

    // Not logged in → ask the user to sign in, then reopen the link. The local
    // login command keeps waiting, so reopening picks up where we left off.
    if (!currentUser) {
      setStatus('needs-login');
      setMessage('Você precisa estar logado no Flash-Learn para conectar ao Claude.');
      return;
    }

    if (sent.current) return;
    sent.current = true;

    const fail = (msg: string) => {
      setStatus('error');
      setMessage(msg);
    };

    if (!callback || !state) {
      fail('Link de conexão inválido. Rode "npx flash-learn-mcp login" novamente.');
      return;
    }

    let callbackUrl: URL;
    try {
      callbackUrl = new URL(callback);
    } catch {
      fail('URL de callback inválida.');
      return;
    }
    // Security: only ever talk to a local callback.
    if (callbackUrl.hostname !== 'localhost' && callbackUrl.hostname !== '127.0.0.1') {
      fail('Callback recusado: apenas conexões locais são permitidas.');
      return;
    }

    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.access_token) {
        fail('Não foi possível ler sua sessão. Faça login novamente.');
        return;
      }
      try {
        const res = await fetch(callbackUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state,
            access_token: session.access_token,
            refresh_token: session.refresh_token ?? '',
          }),
        });
        if (!res.ok) throw new Error(`callback respondeu ${res.status}`);
        setStatus('success');
        setMessage('Conta conectada! Pode fechar esta aba e voltar ao Claude.');
      } catch (err) {
        fail(
          'Não foi possível entregar a sessão ao app local. Verifique se o comando ' +
            '"npx flash-learn-mcp login" ainda está rodando no terminal. ' +
            `(${err instanceof Error ? err.message : String(err)})`,
        );
      }
    })();
  }, [loading, currentUser, location]);

  if (loading) return <LoadingState />;

  const tone =
    status === 'success'
      ? 'text-emerald-600'
      : status === 'error'
        ? 'text-red-600'
        : 'text-muted-foreground';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Conectar ao Claude</h1>
      <p className={`max-w-md ${tone}`}>{message}</p>
      {status === 'connecting' && <LoadingState />}
      {status === 'needs-login' && (
        <div className="flex flex-col items-center gap-2">
          <Button asChild variant="warm">
            <Link to={`/login`}>Fazer login</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Depois de entrar, reabra o link mostrado no terminal.
          </p>
        </div>
      )}
    </div>
  );
};

export default ConnectMcp;

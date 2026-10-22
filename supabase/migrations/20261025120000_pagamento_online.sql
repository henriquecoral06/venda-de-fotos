-- ============================================================================
-- Pagamento online (Asaas ou Mercado Pago) e e-mail automático das fotos
--
-- 1. O dono escolhe em Loja e pagamento como recebe: Pix manual (como antes),
--    Asaas ou Mercado Pago. As chaves ficam em `loja_segredos`, que nenhum
--    cliente lê; só as funções desta migration as usam, chamando o gateway
--    pelo próprio banco (extensão `http`, síncrona, porque o comprador precisa
--    do QR Code na hora). Sem service role no app.
-- 2. O comprador paga na página do pedido: Pix (QR Code na tela) ou cartão
--    (página de pagamento do gateway; o cartão nunca passa por aqui).
-- 3. O pedido só vira pago quando o banco consulta o gateway com a chave do
--    fotógrafo e confere status, referência (código do pedido) e valor. O
--    aviso do gateway (webhook) e a página do pedido só disparam essa
--    consulta: o conteúdo deles nunca é tomado como prova.
-- 4. Pedido pago (pelo gateway, à mão ou grátis) manda ao comprador o link das
--    fotos pelo Resend, com a chave e o remetente do fotógrafo (pg_net).
-- ============================================================================

create extension if not exists http with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Tabelas e colunas
-- ---------------------------------------------------------------------------
alter table public.configuracoes_loja
  add column if not exists gateway text not null default 'manual',
  add column if not exists url_publica text not null default '',
  add column if not exists email_remetente text not null default '';

do $$ begin
  alter table public.configuracoes_loja
    add constraint configuracoes_loja_gateway_check
    check (gateway in ('manual', 'asaas', 'mercadopago'));
exception when duplicate_object then null; end $$;

alter table public.pedidos
  add column if not exists pago_via text not null default '',
  add column if not exists email_enviado_em timestamptz;

-- Linha única com as chaves. Sem grant para anon/authenticated.
create table if not exists public.loja_segredos (
  id int primary key default 1 check (id = 1),
  asaas_chave text not null default '',
  mercadopago_token text not null default '',
  resend_chave text not null default '',
  -- Vai na URL do webhook (`?secret=`) e no cabeçalho do Asaas.
  webhook_segredo text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  updated_at timestamptz not null default now()
);

insert into public.loja_segredos (id) values (1) on conflict (id) do nothing;

-- Cobranças geradas no gateway, para mostrar de novo o mesmo QR Code e para a
-- página do pedido conferir o pagamento.
create table if not exists public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  gateway text not null check (gateway in ('asaas', 'mercadopago')),
  metodo text not null check (metodo in ('pix', 'cartao')),
  externo_id text not null,
  valor numeric(10, 2) not null,
  pix_qrcode text not null default '',
  pix_copia_cola text not null default '',
  link text not null default '',
  expira_em timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists cobrancas_pedido_idx on public.cobrancas (pedido_id, created_at desc);

-- Uma linha por aviso recebido do gateway.
create table if not exists public.pagamentos_eventos (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  externo_id text not null default '',
  resultado text not null,
  corpo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pagamentos_eventos_criado_idx on public.pagamentos_eventos (created_at desc);

drop trigger if exists loja_segredos_set_updated_at on public.loja_segredos;
create trigger loja_segredos_set_updated_at before update on public.loja_segredos
  for each row execute function public.set_updated_at();

revoke all on public.loja_segredos, public.cobrancas, public.pagamentos_eventos
  from anon, authenticated;
grant all on public.loja_segredos, public.cobrancas, public.pagamentos_eventos to service_role;

alter table public.loja_segredos enable row level security;
alter table public.cobrancas enable row level security;
alter table public.pagamentos_eventos enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Auxiliares (sem EXECUTE para anon/authenticated)
-- ---------------------------------------------------------------------------

-- Chamada HTTP síncrona com prazo. Falha de rede vira mensagem para a tela.
create or replace function public.pagamento_http(
  _metodo text,
  _url text,
  _cabecalhos jsonb,
  _corpo jsonb
)
returns jsonb
language plpgsql security definer
set search_path = public, extensions as $$
declare
  r extensions.http_response;
  cabecalhos extensions.http_header[];
  corpo jsonb;
begin
  select coalesce(array_agg(extensions.http_header(k, v)), '{}')
    into cabecalhos
    from jsonb_each_text(coalesce(_cabecalhos, '{}'::jsonb)) as t(k, v);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '15000');
  begin
    r := extensions.http((
      _metodo, _url, cabecalhos, 'application/json',
      case when _corpo is null then null else _corpo::text end
    )::extensions.http_request);
  exception when others then
    raise exception 'Não foi possível falar com o serviço de pagamento. Tente de novo em instantes.';
  end;
  begin
    corpo := nullif(r.content, '')::jsonb;
  exception when others then
    corpo := jsonb_build_object('texto', left(r.content, 500));
  end;
  return jsonb_build_object('status', r.status, 'corpo', coalesce(corpo, '{}'::jsonb));
end;
$$;

-- Asaas: a chave de sandbox (`$aact_hmlg_`) usa o endereço de testes.
create or replace function public.asaas_chamar(_metodo text, _caminho text, _corpo jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, extensions as $$
declare
  chave text;
  r jsonb;
  st int;
begin
  select s.asaas_chave into chave from public.loja_segredos s where s.id = 1;
  if coalesce(chave, '') = '' then
    raise exception 'O Asaas está sem chave de API.';
  end if;
  r := public.pagamento_http(
    _metodo,
    case when starts_with(chave, '$aact_hmlg_') then 'https://api-sandbox.asaas.com/v3'
         else 'https://api.asaas.com/v3' end || _caminho,
    jsonb_build_object('access_token', chave, 'User-Agent', 'FotoVenda'),
    _corpo
  );
  st := (r ->> 'status')::int;
  if st = 401 then
    raise exception 'O Asaas recusou a chave de API. Confira a chave em Loja e pagamento.';
  end if;
  if st >= 400 then
    raise exception '%', coalesce(
      r -> 'corpo' -> 'errors' -> 0 ->> 'description',
      'O Asaas recusou a operação (HTTP ' || st || ').');
  end if;
  return r -> 'corpo';
end;
$$;

create or replace function public.mp_chamar(_metodo text, _caminho text, _corpo jsonb default null)
returns jsonb
language plpgsql security definer
set search_path = public, extensions as $$
declare
  token text;
  r jsonb;
  st int;
begin
  select s.mercadopago_token into token from public.loja_segredos s where s.id = 1;
  if coalesce(token, '') = '' then
    raise exception 'O Mercado Pago está sem access token.';
  end if;
  r := public.pagamento_http(
    _metodo,
    'https://api.mercadopago.com' || _caminho,
    jsonb_build_object(
      'Authorization', 'Bearer ' || token,
      'X-Idempotency-Key', gen_random_uuid()::text),
    _corpo
  );
  st := (r ->> 'status')::int;
  if st in (401, 403) then
    raise exception 'O Mercado Pago recusou o access token. Confira o token em Loja e pagamento.';
  end if;
  if st >= 400 then
    raise exception '%', coalesce(
      r -> 'corpo' -> 'cause' -> 0 ->> 'description',
      r -> 'corpo' ->> 'message',
      'O Mercado Pago recusou a operação (HTTP ' || st || ').');
  end if;
  return r -> 'corpo';
end;
$$;

create or replace function public.cpf_valido(_d text)
returns boolean
language plpgsql immutable
set search_path = public as $$
declare
  soma int;
  resto int;
begin
  if _d !~ '^\d{11}$' or _d ~ '^(\d)\1{10}$' then
    return false;
  end if;
  for j in 0..1 loop
    soma := 0;
    for i in 1..(9 + j) loop
      soma := soma + substr(_d, i, 1)::int * (11 + j - i);
    end loop;
    resto := (soma * 10) % 11;
    if resto = 10 then
      resto := 0;
    end if;
    if resto <> substr(_d, 10 + j, 1)::int then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.escapar_html(_t text)
returns text
language sql immutable
set search_path = public as $$
  select replace(replace(replace(replace(coalesce(_t, ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;

-- Webhook do Asaas apontando para este site, com o segredo atual. A chave do
-- Asaas é da conta inteira: o webhook é criado ou regravado no lugar.
create or replace function public.asaas_sincronizar_webhook()
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  c public.configuracoes_loja%rowtype;
  s public.loja_segredos%rowtype;
  url text;
  existente jsonb;
  desejado jsonb;
begin
  select * into c from public.configuracoes_loja where id = 1;
  select * into s from public.loja_segredos where id = 1;
  url := c.url_publica || '/api/pagamentos/asaas';
  select w into existente
    from jsonb_array_elements(coalesce(public.asaas_chamar('GET', '/webhooks?limit=100') -> 'data', '[]')) as w
   where w ->> 'url' = url
   limit 1;
  desejado := jsonb_build_object(
    'name', 'FotoVenda',
    'url', url,
    'email', coalesce((select p.email from public.perfis p where p.id = auth.uid()), ''),
    'enabled', true,
    'interrupted', false,
    'apiVersion', 3,
    'authToken', s.webhook_segredo,
    'sendType', 'SEQUENTIALLY',
    'events', jsonb_build_array('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED')
  );
  if existente is null then
    perform public.asaas_chamar('POST', '/webhooks', desejado);
  else
    perform public.asaas_chamar('PUT', '/webhooks/' || (existente ->> 'id'), desejado);
  end if;
end;
$$;

-- Consulta o pagamento no gateway e, se estiver pago com o valor do pedido,
-- marca o pedido como pago. Devolve o que aconteceu (vai para o log).
create or replace function public.confirmar_pagamento_gateway(_gateway text, _externo_id text)
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  pg jsonb;
  ref text;
  valor numeric;
  pago boolean;
  situacao text;
  p public.pedidos%rowtype;
begin
  if coalesce(_externo_id, '') !~ '^[A-Za-z0-9_-]{1,64}$' then
    return 'id inválido';
  end if;
  if _gateway = 'asaas' then
    pg := public.asaas_chamar('GET', '/payments/' || _externo_id);
    ref := pg ->> 'externalReference';
    valor := (pg ->> 'value')::numeric;
    situacao := pg ->> 'status';
    pago := situacao in ('RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH');
  elsif _gateway = 'mercadopago' then
    pg := public.mp_chamar('GET', '/v1/payments/' || _externo_id);
    ref := pg ->> 'external_reference';
    valor := (pg ->> 'transaction_amount')::numeric;
    situacao := pg ->> 'status';
    pago := situacao = 'approved';
  else
    return 'gateway desconhecido';
  end if;

  if not pago then
    return 'não pago (' || coalesce(situacao, '?') || ')';
  end if;
  select * into p from public.pedidos where codigo = coalesce(ref, '');
  if not found then
    return 'pedido não encontrado';
  end if;
  if coalesce(valor, 0) < p.valor_total then
    return 'valor menor que o do pedido';
  end if;
  if p.status = 'pago' then
    return 'já estava pago';
  end if;
  if p.status = 'cancelado' then
    return 'pago, mas o pedido está cancelado';
  end if;
  update public.pedidos
     set status = 'pago', pago_via = _gateway
   where id = p.id and status = 'aguardando_pagamento';
  return 'pago';
end;
$$;

-- E-mail com o link das fotos. Devolve quando enviou, ou nulo se o e-mail
-- automático não está configurado.
create or replace function public.enviar_email_pedido(_p public.pedidos)
returns timestamptz
language plpgsql security definer
set search_path = public, extensions as $$
declare
  c public.configuracoes_loja%rowtype;
  s public.loja_segredos%rowtype;
  nome text;
  titulo text;
  link text;
begin
  select * into c from public.configuracoes_loja where id = 1;
  select * into s from public.loja_segredos where id = 1;
  if coalesce(s.resend_chave, '') = '' or coalesce(c.email_remetente, '') = ''
     or coalesce(c.url_publica, '') = '' or coalesce(_p.cliente_email, '') = '' then
    return null;
  end if;
  nome := public.nome_fotografo(_p.organizacao_id);
  select g.titulo into titulo from public.galerias g where g.id = _p.galeria_id;
  link := c.url_publica || '/pedido/' || _p.codigo;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    body := jsonb_build_object(
      'from', '"' || regexp_replace(nome, '["<>]', '', 'g') || '" <' || c.email_remetente || '>',
      'to', jsonb_build_array(_p.cliente_email),
      'subject', 'Suas fotos de "' || coalesce(titulo, '') || '" estão liberadas',
      'text',
        'Olá, ' || _p.cliente_nome || E'!\n\n'
        || 'O pagamento do seu pedido foi confirmado e as fotos já podem ser baixadas:'
        || E'\n' || link || E'\n\nGuarde este link para baixar de novo quando quiser.\n\n' || nome,
      'html',
        '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a;max-width:520px">'
        || '<p>Olá, ' || public.escapar_html(_p.cliente_nome) || '!</p>'
        || '<p>O pagamento do seu pedido de <strong>' || public.escapar_html(titulo)
        || '</strong> foi confirmado e as fotos já podem ser baixadas.</p>'
        || '<p style="margin:28px 0"><a href="' || public.escapar_html(link)
        || '" style="background:#1a1a1a;color:#ffffff;padding:12px 22px;border-radius:999px;text-decoration:none">Baixar minhas fotos</a></p>'
        || '<p style="color:#666;font-size:14px">Guarde este e-mail para baixar de novo quando quiser.</p>'
        || '<p>' || public.escapar_html(nome) || '</p></div>'
    ),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || s.resend_chave,
      'Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
  return now();
end;
$$;

-- Pedido que vira pago (ou já nasce pago, se for grátis) manda o e-mail uma vez.
create or replace function public.pedidos_email_pago()
returns trigger
language plpgsql security definer
set search_path = public as $$
begin
  if new.status = 'pago' and new.email_enviado_em is null
     and (tg_op = 'INSERT' or old.status is distinct from 'pago') then
    new.email_enviado_em := public.enviar_email_pedido(new);
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_email_pago_trg on public.pedidos;
create trigger pedidos_email_pago_trg before insert or update of status on public.pedidos
  for each row execute function public.pedidos_email_pago();

revoke execute on function
  public.pagamento_http(text, text, jsonb, jsonb),
  public.asaas_chamar(text, text, jsonb),
  public.mp_chamar(text, text, jsonb),
  public.cpf_valido(text),
  public.escapar_html(text),
  public.asaas_sincronizar_webhook(),
  public.confirmar_pagamento_gateway(text, text),
  public.enviar_email_pedido(public.pedidos),
  public.pedidos_email_pago()
  from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 3. Painel (só o dono)
-- ---------------------------------------------------------------------------

-- Estado real da integração: consulta o gateway ativo em vez de confiar no
-- que está gravado.
create or replace function public.diagnostico_pagamento()
returns jsonb
language plpgsql security definer
set search_path = public, extensions as $$
declare
  c public.configuracoes_loja%rowtype;
  s public.loja_segredos%rowtype;
  conta text;
  webhook jsonb;
  url text;
  erro text;
begin
  if public.meu_papel() is distinct from 'dono' then
    raise exception 'Só o dono da organização vê a configuração de pagamento.';
  end if;
  select * into c from public.configuracoes_loja where id = 1;
  select * into s from public.loja_segredos where id = 1;

  begin
    if c.gateway = 'asaas' and s.asaas_chave <> '' then
      url := c.url_publica || '/api/pagamentos/asaas';
      select w into webhook
        from jsonb_array_elements(coalesce(public.asaas_chamar('GET', '/webhooks?limit=100') -> 'data', '[]')) as w
       where w ->> 'url' = url
       limit 1;
      begin
        conta := public.asaas_chamar('GET', '/myAccount/commercialInfo') ->> 'name';
      exception when others then
        conta := null;
      end;
    elsif c.gateway = 'mercadopago' and s.mercadopago_token <> '' then
      select coalesce(r ->> 'nickname', r ->> 'email') into conta
        from public.mp_chamar('GET', '/users/me') as r;
    end if;
  exception when others then
    erro := sqlerrm;
  end;

  return jsonb_build_object(
    'gateway', c.gateway,
    'url_publica', c.url_publica,
    'asaas_configurado', s.asaas_chave <> '',
    'asaas_sandbox', starts_with(s.asaas_chave, '$aact_hmlg_'),
    'mercadopago_configurado', s.mercadopago_token <> '',
    'mercadopago_teste', starts_with(s.mercadopago_token, 'TEST-'),
    'conta', conta,
    'erro', erro,
    'webhook', case when c.gateway <> 'asaas' then null else jsonb_build_object(
      'url', url,
      'existe', webhook is not null,
      'ativo', coalesce((webhook ->> 'enabled')::boolean, false)
                 and not coalesce((webhook ->> 'interrupted')::boolean, false),
      'eventos_ok', coalesce(webhook -> 'events', '[]'::jsonb) @> '["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]'::jsonb
    ) end,
    'email_configurado', s.resend_chave <> '' and c.email_remetente <> '' and c.url_publica <> '',
    'email_remetente', c.email_remetente
  );
end;
$$;

-- `_chave` nula mantém a chave gravada; vazia apaga a do gateway escolhido.
create or replace function public.configurar_pagamento(_gateway text, _chave text, _url_publica text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions as $$
declare
  url text := regexp_replace(trim(coalesce(_url_publica, '')), '/+$', '');
  chave text := trim(_chave);
begin
  if public.meu_papel() is distinct from 'dono' then
    raise exception 'Só o dono da organização altera o pagamento.';
  end if;
  if _gateway not in ('manual', 'asaas', 'mercadopago') then
    raise exception 'Forma de recebimento inválida.';
  end if;
  if url <> '' and url !~ '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$' then
    raise exception 'Endereço do site inválido. Use só o domínio, como https://fotos.seusite.com.br.';
  end if;
  if chave is not null and char_length(chave) > 500 then
    raise exception 'Chave longa demais.';
  end if;

  if chave is not null and _gateway = 'asaas' then
    update public.loja_segredos set asaas_chave = chave where id = 1;
  elsif chave is not null and _gateway = 'mercadopago' then
    update public.loja_segredos set mercadopago_token = chave where id = 1;
  end if;

  if _gateway <> 'manual' then
    if url = '' then
      raise exception 'Informe o endereço do site: o gateway avisa o pagamento por ele.';
    end if;
    if (_gateway = 'asaas' and (select asaas_chave from public.loja_segredos where id = 1) = '')
       or (_gateway = 'mercadopago' and (select mercadopago_token from public.loja_segredos where id = 1) = '') then
      raise exception 'Informe a chave do gateway para ativar o pagamento online.';
    end if;
  end if;

  update public.configuracoes_loja set gateway = _gateway, url_publica = url where id = 1;

  -- Confere a chave antes de ativar: erro aqui desfaz tudo.
  if _gateway = 'asaas' then
    perform public.asaas_sincronizar_webhook();
  elsif _gateway = 'mercadopago' then
    perform public.mp_chamar('GET', '/users/me');
  end if;

  return public.diagnostico_pagamento();
end;
$$;

-- `_url_publica` nula mantém o endereço gravado (o link do e-mail usa ele).
create or replace function public.configurar_email(_chave text, _remetente text, _url_publica text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions as $$
declare
  remetente text := lower(trim(coalesce(_remetente, '')));
  url text := regexp_replace(trim(_url_publica), '/+$', '');
begin
  if public.meu_papel() is distinct from 'dono' then
    raise exception 'Só o dono da organização altera o e-mail automático.';
  end if;
  if remetente <> '' and (remetente !~ '^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$' or char_length(remetente) > 200) then
    raise exception 'Informe um e-mail de envio válido.';
  end if;
  if _chave is not null then
    if char_length(trim(_chave)) > 500 then
      raise exception 'Chave longa demais.';
    end if;
    update public.loja_segredos set resend_chave = trim(_chave) where id = 1;
  end if;
  if url is not null and url <> '' and url !~ '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$' then
    raise exception 'Endereço do site inválido. Use só o domínio, como https://fotos.seusite.com.br.';
  end if;
  update public.configuracoes_loja
     set email_remetente = remetente, url_publica = coalesce(url, url_publica)
   where id = 1;
  return public.diagnostico_pagamento();
end;
$$;

-- Teste síncrono para a tela mostrar o erro do Resend (domínio não
-- verificado, chave sem permissão…).
create or replace function public.enviar_email_teste()
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  c public.configuracoes_loja%rowtype;
  s public.loja_segredos%rowtype;
  para text;
  r jsonb;
begin
  if public.meu_papel() is distinct from 'dono' then
    raise exception 'Só o dono da organização testa o e-mail automático.';
  end if;
  select * into c from public.configuracoes_loja where id = 1;
  select * into s from public.loja_segredos where id = 1;
  if s.resend_chave = '' or c.email_remetente = '' then
    raise exception 'Salve a chave do Resend e o e-mail de envio antes de testar.';
  end if;
  select p.email into para from public.perfis p where p.id = auth.uid();
  r := public.pagamento_http(
    'POST', 'https://api.resend.com/emails',
    jsonb_build_object('Authorization', 'Bearer ' || s.resend_chave),
    jsonb_build_object(
      'from', '"' || regexp_replace(public.nome_fotografo(public.minha_organizacao()), '["<>]', '', 'g')
              || '" <' || c.email_remetente || '>',
      'to', jsonb_build_array(para),
      'subject', 'Teste do e-mail automático',
      'text', 'Tudo certo: os compradores vão receber o link das fotos assim que o pagamento for confirmado.')
  );
  if (r ->> 'status')::int >= 400 then
    raise exception 'O Resend recusou o envio: %', coalesce(r -> 'corpo' ->> 'message', 'HTTP ' || (r ->> 'status'));
  end if;
  return para;
end;
$$;

create or replace function public.reenviar_email_pedido(_pedido uuid)
returns void
language plpgsql security definer
set search_path = public as $$
declare
  p public.pedidos%rowtype;
  enviado timestamptz;
begin
  select * into p from public.pedidos
   where id = _pedido
     and (user_id = auth.uid() or (organizacao_id is not null and organizacao_id = public.minha_organizacao()));
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;
  if p.status <> 'pago' then
    raise exception 'O e-mail só vai para pedido pago.';
  end if;
  enviado := public.enviar_email_pedido(p);
  if enviado is null then
    raise exception 'Configure o e-mail automático em Loja e pagamento.';
  end if;
  update public.pedidos set email_enviado_em = enviado where id = p.id;
end;
$$;

revoke execute on function
  public.diagnostico_pagamento(),
  public.configurar_pagamento(text, text, text),
  public.configurar_email(text, text, text),
  public.enviar_email_teste(),
  public.reenviar_email_pedido(uuid)
  from anon, authenticated, public;
grant execute on function
  public.diagnostico_pagamento(),
  public.configurar_pagamento(text, text, text),
  public.configurar_email(text, text, text),
  public.enviar_email_teste(),
  public.reenviar_email_pedido(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Comprador e webhook
-- ---------------------------------------------------------------------------

-- Gera (ou devolve a mesma, se ainda vale) a cobrança do pedido. Erro do
-- gateway volta como `erro` em vez de exceção, para a tentativa ficar contada
-- no limite.
create or replace function public.gerar_cobranca(_codigo text, _metodo text, _cpf text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions as $$
declare
  p public.pedidos%rowtype;
  c public.configuracoes_loja%rowtype;
  cb public.cobrancas%rowtype;
  titulo text;
  cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  cliente text;
  pg jsonb;
  qr jsonb;
  externo text;
  link text := '';
  qrcode text := '';
  copia text := '';
  notificacao text;
  _ip text := public.ip_do_visitante();
begin
  select * into p from public.pedidos where codigo = trim(coalesce(_codigo, ''));
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;
  if p.status <> 'aguardando_pagamento' then
    raise exception 'Este pedido não está aguardando pagamento.';
  end if;
  if _metodo not in ('pix', 'cartao') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  select * into c from public.configuracoes_loja where id = 1;
  if c.gateway = 'manual' then
    raise exception 'O pagamento online não está ativo.';
  end if;

  select * into cb from public.cobrancas
   where pedido_id = p.id and gateway = c.gateway and metodo = _metodo
     and valor = p.valor_total and expira_em > now() + interval '10 minutes'
   order by created_at desc
   limit 1;
  if found then
    return jsonb_build_object('cobranca', jsonb_build_object(
      'metodo', cb.metodo, 'pix_qrcode', cb.pix_qrcode, 'pix_copia_cola', cb.pix_copia_cola,
      'link', cb.link, 'expira_em', cb.expira_em));
  end if;

  if c.gateway = 'asaas' and not (public.cpf_valido(cpf) or cpf ~ '^\d{14}$') then
    raise exception 'Informe um CPF válido.';
  end if;

  perform public.conferir_limite('cobranca', _ip, 20, interval '1 hour');
  perform public.conferir_limite('cobranca-pedido', p.codigo, 8, interval '1 hour');
  perform public.registrar_acesso('cobranca', _ip);
  perform public.registrar_acesso('cobranca-pedido', p.codigo);

  select g.titulo into titulo from public.galerias g where g.id = p.galeria_id;
  titulo := left('Fotos: ' || coalesce(titulo, ''), 100);

  begin
    if c.gateway = 'asaas' then
      cliente := public.asaas_chamar('GET', '/customers?cpfCnpj=' || cpf) -> 'data' -> 0 ->> 'id';
      if cliente is null then
        cliente := public.asaas_chamar('POST', '/customers', jsonb_build_object(
          'name', p.cliente_nome, 'cpfCnpj', cpf, 'email', p.cliente_email,
          'notificationDisabled', true)) ->> 'id';
      end if;
      pg := public.asaas_chamar('POST', '/payments', jsonb_build_object(
        'customer', cliente,
        'billingType', case when _metodo = 'pix' then 'PIX' else 'CREDIT_CARD' end,
        'value', p.valor_total,
        'dueDate', to_char((now() at time zone 'America/Sao_Paulo')::date + 1, 'YYYY-MM-DD'),
        'description', titulo,
        'externalReference', p.codigo));
      externo := pg ->> 'id';
      link := coalesce(pg ->> 'invoiceUrl', '');
      if _metodo = 'pix' then
        qr := public.asaas_chamar('GET', '/payments/' || externo || '/pixQrCode');
        qrcode := coalesce(qr ->> 'encodedImage', '');
        copia := coalesce(qr ->> 'payload', '');
      end if;
    else
      -- O Mercado Pago só aceita aviso em endereço https.
      notificacao := case when starts_with(c.url_publica, 'https://') then
        c.url_publica || '/api/pagamentos/mercadopago?secret='
        || (select s.webhook_segredo from public.loja_segredos s where s.id = 1) end;
      if _metodo = 'pix' then
        pg := public.mp_chamar('POST', '/v1/payments', jsonb_strip_nulls(jsonb_build_object(
          'transaction_amount', p.valor_total,
          'description', titulo,
          'payment_method_id', 'pix',
          'payer', jsonb_build_object('email', p.cliente_email, 'first_name', split_part(p.cliente_nome, ' ', 1)),
          'external_reference', p.codigo,
          'notification_url', notificacao,
          'date_of_expiration', to_char(now() at time zone 'America/Sao_Paulo' + interval '1 day',
                                        'YYYY-MM-DD"T"HH24:MI:SS".000-03:00"'))));
        externo := pg ->> 'id';
        qrcode := coalesce(pg -> 'point_of_interaction' -> 'transaction_data' ->> 'qr_code_base64', '');
        copia := coalesce(pg -> 'point_of_interaction' -> 'transaction_data' ->> 'qr_code', '');
      else
        pg := public.mp_chamar('POST', '/checkout/preferences', jsonb_strip_nulls(jsonb_build_object(
          'items', jsonb_build_array(jsonb_build_object(
            'title', titulo, 'quantity', 1, 'unit_price', p.valor_total, 'currency_id', 'BRL')),
          'payer', jsonb_build_object('email', p.cliente_email),
          'external_reference', p.codigo,
          'notification_url', notificacao,
          'back_urls', case when c.url_publica <> '' then jsonb_build_object(
            'success', c.url_publica || '/pedido/' || p.codigo,
            'pending', c.url_publica || '/pedido/' || p.codigo,
            'failure', c.url_publica || '/pedido/' || p.codigo) end,
          'auto_return', case when starts_with(c.url_publica, 'https://') then 'approved' end,
          'payment_methods', jsonb_build_object('excluded_payment_types', jsonb_build_array(
            jsonb_build_object('id', 'ticket'), jsonb_build_object('id', 'atm'),
            jsonb_build_object('id', 'bank_transfer'))))));
        externo := pg ->> 'id';
        link := coalesce(pg ->> 'init_point', '');
      end if;
    end if;
  exception when others then
    -- Chave recusada ou ausente é problema da loja, não de quem paga.
    return jsonb_build_object('erro', case
      when sqlerrm like '%chave de API%' or sqlerrm like '%access token%'
        then 'O pagamento online está indisponível agora. Fale com o fotógrafo.'
      else sqlerrm end);
  end;

  if externo is null or (_metodo = 'pix' and copia = '') or (_metodo = 'cartao' and link = '') then
    return jsonb_build_object('erro', 'O gateway não devolveu a cobrança. Tente de novo.');
  end if;

  insert into public.cobrancas (pedido_id, gateway, metodo, externo_id, valor, pix_qrcode,
                                pix_copia_cola, link, expira_em)
  values (p.id, c.gateway, _metodo, externo, p.valor_total, qrcode, copia, link,
          now() + interval '23 hours')
  returning * into cb;

  return jsonb_build_object('cobranca', jsonb_build_object(
    'metodo', cb.metodo, 'pix_qrcode', cb.pix_qrcode, 'pix_copia_cola', cb.pix_copia_cola,
    'link', cb.link, 'expira_em', cb.expira_em));
end;
$$;

-- A página do pedido pergunta de tempos em tempos; o banco consulta o gateway
-- (no máximo 60 vezes em 10 minutos por pedido) e devolve o status.
create or replace function public.conferir_pagamento(_codigo text)
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  p public.pedidos%rowtype;
  c public.configuracoes_loja%rowtype;
  cb record;
  r jsonb;
begin
  select * into p from public.pedidos where codigo = trim(coalesce(_codigo, ''));
  if not found then
    return null;
  end if;
  select * into c from public.configuracoes_loja where id = 1;
  if p.status <> 'aguardando_pagamento' or c.gateway = 'manual'
     or (select count(*) from public.limites_acesso l
          where l.acao = 'conferir' and l.chave = p.codigo
            and l.criado_em > now() - interval '10 minutes') >= 60 then
    return p.status;
  end if;
  perform public.registrar_acesso('conferir', p.codigo);

  begin
    if c.gateway = 'asaas' then
      for cb in
        select externo_id from public.cobrancas
         where pedido_id = p.id and gateway = 'asaas'
         order by created_at desc limit 3
      loop
        exit when public.confirmar_pagamento_gateway('asaas', cb.externo_id) = 'pago';
      end loop;
    elsif exists (select 1 from public.cobrancas where pedido_id = p.id and gateway = 'mercadopago') then
      -- O pagamento com cartão só ganha id quando a pessoa paga: busca pela referência.
      r := public.mp_chamar('GET', '/v1/payments/search?sort=date_created&criteria=desc&external_reference=' || p.codigo);
      for cb in
        select x ->> 'id' as externo_id
          from jsonb_array_elements(coalesce(r -> 'results', '[]')) as x
         where x ->> 'status' = 'approved'
         limit 3
      loop
        exit when public.confirmar_pagamento_gateway('mercadopago', cb.externo_id) = 'pago';
      end loop;
    end if;
  exception when others then
    null;
  end;

  return (select status::text from public.pedidos where id = p.id);
end;
$$;

-- Aviso do gateway, repassado pela rota do site. Sem o segredo, recusa.
create or replace function public.receber_webhook_pagamento(_gateway text, _segredo text, _corpo jsonb)
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  segredo text;
  externo text;
  tipo text;
  resultado text;
begin
  select s.webhook_segredo into segredo from public.loja_segredos s where s.id = 1;
  if _gateway not in ('asaas', 'mercadopago') or coalesce(_segredo, '') = ''
     or _segredo is distinct from segredo then
    return 'recusado';
  end if;

  if _gateway = 'asaas' then
    tipo := _corpo ->> 'event';
    externo := _corpo -> 'payment' ->> 'id';
    if tipo not in ('PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED') then
      resultado := 'ignorado (' || coalesce(tipo, '?') || ')';
    end if;
  else
    tipo := coalesce(_corpo ->> 'type', _corpo ->> 'topic');
    externo := coalesce(_corpo -> 'data' ->> 'id', _corpo ->> 'data.id',
                        case when tipo = 'payment' then _corpo ->> 'id' end);
    if tipo is distinct from 'payment' then
      resultado := 'ignorado (' || coalesce(tipo, '?') || ')';
    end if;
  end if;

  if resultado is null then
    begin
      resultado := public.confirmar_pagamento_gateway(_gateway, externo);
    exception when others then
      resultado := 'erro: ' || sqlerrm;
    end;
  end if;

  insert into public.pagamentos_eventos (gateway, externo_id, resultado, corpo)
  values (_gateway, left(coalesce(externo, ''), 64), resultado, coalesce(_corpo, '{}'::jsonb));
  if random() < 0.02 then
    delete from public.pagamentos_eventos where created_at < now() - interval '90 days';
  end if;
  return resultado;
end;
$$;

revoke execute on function
  public.gerar_cobranca(text, text, text),
  public.conferir_pagamento(text),
  public.receber_webhook_pagamento(text, text, jsonb)
  from anon, authenticated, public;
grant execute on function
  public.gerar_cobranca(text, text, text),
  public.conferir_pagamento(text),
  public.receber_webhook_pagamento(text, text, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Pedido público com o pagamento online
-- ---------------------------------------------------------------------------
-- Igual à de `revisao_seguranca`, com a forma de recebimento, a cobrança em
-- aberto e se o e-mail das fotos já saiu.
create or replace function public.pedido_publico(_codigo text)
returns jsonb
language plpgsql stable security definer
set search_path = public as $$
declare
  p public.pedidos%rowtype;
  g public.galerias%rowtype;
  c public.configuracoes_loja%rowtype;
  cb public.cobrancas%rowtype;
begin
  select * into p from public.pedidos where codigo = trim(coalesce(_codigo, ''));
  if not found then
    return null;
  end if;
  select * into g from public.galerias where id = p.galeria_id;
  select * into c from public.configuracoes_loja where id = 1;
  select * into cb from public.cobrancas
   where pedido_id = p.id and gateway = c.gateway and valor = p.valor_total
     and expira_em > now() + interval '10 minutes'
   order by created_at desc
   limit 1;

  return jsonb_build_object(
    'codigo', p.codigo,
    'status', p.status,
    'cliente_nome', p.cliente_nome,
    'cliente_email', p.cliente_email,
    'pacote_completo', p.pacote_completo,
    'valor_total', p.valor_total,
    'created_at', p.created_at,
    'pago_em', p.pago_em,
    'email_enviado', p.email_enviado_em is not null,
    'galeria', jsonb_build_object('titulo', g.titulo, 'slug', public.link_da_galeria(g)),
    'fotografo', public.nome_fotografo(p.organizacao_id),
    'marca', public.marca_publica(),
    'pagamento', jsonb_build_object(
      'chave_pix', coalesce(c.chave_pix, ''),
      'instrucoes', coalesce(c.instrucoes_pagamento, ''),
      'whatsapp', coalesce(c.whatsapp, ''),
      'gateway', c.gateway,
      'cobranca', case when cb.id is null then null else jsonb_build_object(
        'metodo', cb.metodo, 'pix_qrcode', cb.pix_qrcode, 'pix_copia_cola', cb.pix_copia_cola,
        'link', cb.link, 'expira_em', cb.expira_em) end
    ),
    'itens', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'foto_id', f.id,
                 'nome', f.nome_arquivo,
                 'previa', f.caminho_previa,
                 'miniatura', f.caminho_miniatura,
                 'preco', i.preco,
                 'tamanho', f.tamanho_bytes,
                 'original', case when p.status = 'pago' then f.caminho_original end)
               order by f.ordem, f.created_at, f.id)
        from public.pedido_itens i
        join public.fotos f on f.id = i.foto_id
       where i.pedido_id = p.id
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.pedido_publico(text) from anon, authenticated, public;
grant execute on function public.pedido_publico(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Auto-reparo com as tabelas e funções novas
-- ---------------------------------------------------------------------------
-- Igual à versão de `landing_formulario_logo`, com a linha de `loja_segredos`
-- na seção 0 e os grants das tabelas e funções de pagamento na seção 3.
create or replace function public.garantir_instalacao()
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  reparou boolean := false;
  u record;
  meta jsonb;
  _nome text;
  _org uuid;
  _aberto boolean;
begin
  -- 0. Linhas iniciais (o remix copia a estrutura, não os dados).
  if not exists (select 1 from public.configuracoes_loja where id = 1) then
    insert into public.configuracoes_loja (id) values (1) on conflict (id) do nothing;
    reparou := true;
  end if;

  if not exists (select 1 from public.loja_segredos where id = 1) then
    insert into public.loja_segredos (id) values (1) on conflict (id) do nothing;
    reparou := true;
  end if;

  if not exists (select 1 from storage.buckets where id = 'previas') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('previas', 'previas', true, 10485760, array['image/jpeg', 'image/webp'])
    on conflict (id) do nothing;
    reparou := true;
  end if;

  if not exists (select 1 from storage.buckets where id = 'originais') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('originais', 'originais', false, 52428800, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
    reparou := true;
  end if;

  if not exists (select 1 from storage.buckets where id = 'marca') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('marca', 'marca', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do nothing;
    reparou := true;
  end if;

  -- 1. Triggers em auth.users (fundação §5).
  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
    reparou := true;
  end if;

  -- 2. Contas criadas enquanto o trigger faltava (ver `auto_reparo_remix`).
  if exists (
    select 1 from auth.users au
     where not exists (select 1 from public.perfis p where p.id = au.id)
  ) then
    perform pg_advisory_xact_lock(hashtext('ceia.organizacao_unica'));

    for u in
      select au.id, au.email, au.raw_user_meta_data
        from auth.users au
       where not exists (select 1 from public.perfis p where p.id = au.id)
       order by au.created_at, au.id
    loop
      meta := coalesce(u.raw_user_meta_data, '{}'::jsonb);
      _nome := nullif(trim(coalesce(meta ->> 'nome', '')), '');
      if _nome is null then
        _nome := split_part(coalesce(u.email, ''), '@', 1);
      end if;
      if _nome = '' then
        _nome := 'Usuário';
      end if;

      insert into public.perfis (id, nome, email)
      values (u.id, _nome, coalesce(u.email, ''))
      on conflict (id) do nothing;

      if not exists (select 1 from public.organizacao_membros m where m.user_id = u.id) then
        _org := null;
        select o.id, o.cadastro_aberto into _org, _aberto
          from public.organizacoes o
         order by o.created_at, o.id
         limit 1;
        if _org is null then
          insert into public.organizacoes (nome) values ('Minha organização') returning id into _org;
          insert into public.organizacao_membros (user_id, organizacao_id, papel)
          values (u.id, _org, 'dono')
          on conflict (user_id) do nothing;
        elsif _aberto then
          insert into public.organizacao_membros (user_id, organizacao_id, papel)
          values (u.id, _org, 'membro')
          on conflict (user_id) do nothing;
        end if;
      end if;

      reparou := true;
    end loop;
  end if;

  -- 3. Privilégios (sentinelas e lista completa).
  if has_table_privilege('anon', 'public.perfis', 'SELECT')
     or has_table_privilege('authenticated', 'public.organizacao_membros', 'INSERT')
     or has_function_privilege('anon', 'public.remover_membro(uuid)', 'EXECUTE') then

    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    revoke all on all functions in schema public from public, anon, authenticated;

    -- Tabelas. `anon` não lê nenhuma tabela.
    grant select, update (nome) on public.perfis to authenticated;
    grant select, update (nome, cadastro_aberto) on public.organizacoes to authenticated;
    grant select on public.organizacao_membros to authenticated;
    grant select,
      update (nome_exibicao, chave_pix, instrucoes_pagamento, whatsapp, texto_marca_dagua,
              logo_caminho, logo_escuro_caminho, cor_primaria, cor_secundaria, marca_dagua_ativa)
      on public.configuracoes_loja to authenticated;
    grant select, insert, update, delete on public.galerias to authenticated;
    grant select, insert, update, delete on public.fotos to authenticated;
    grant select, update (status) on public.pedidos to authenticated;
    grant select on public.pedido_itens to authenticated;
    grant select, insert, update, delete on public.landing_pages to authenticated;
    grant select, delete on public.landing_contatos to authenticated;

    grant all on
      public.perfis, public.organizacoes, public.organizacao_membros,
      public.configuracoes_loja, public.galerias, public.fotos, public.pedidos,
      public.pedido_itens, public.landing_pages, public.landing_segredos,
      public.limites_acesso, public.landing_contatos, public.loja_segredos,
      public.cobrancas, public.pagamentos_eventos
      to service_role;
    grant usage, select on all sequences in schema public to service_role;

    -- Funções chamadas pelo cliente logado.
    grant execute on function
      public.minha_organizacao(),
      public.meu_papel(),
      public.mesma_organizacao(uuid),
      public.garantir_organizacao(),
      public.remover_membro(uuid),
      public.readmitir_membro(uuid),
      public.contas_fora_da_organizacao(),
      public.definir_cadastro_aberto(boolean),
      public.definir_token_capi(uuid, text),
      public.landing_tem_token_capi(uuid),
      public.diagnostico_pagamento(),
      public.configurar_pagamento(text, text, text),
      public.configurar_email(text, text, text),
      public.enviar_email_teste(),
      public.reenviar_email_pedido(uuid)
      to authenticated, service_role;

    -- Funções públicas da venda: também para o visitante.
    grant execute on function
      public.galeria_publica(text, text),
      public.criar_pedido(text, text, text, text, text, uuid[], boolean),
      public.pedido_publico(text),
      public.foto_original_liberada(text),
      public.eventos_publicos(),
      public.landing_publica(text),
      public.enviar_contato_landing(text, jsonb),
      public.enviar_evento_meta(text, text, text, text, text, text, text, text),
      public.gerar_cobranca(text, text, text),
      public.conferir_pagamento(text),
      public.receber_webhook_pagamento(text, text, jsonb)
      to anon, authenticated, service_role;

    -- Este reparo: chamado também por visitante (tela de entrada).
    grant execute on function public.garantir_instalacao()
      to anon, authenticated, service_role;

    -- Funções de trigger e auxiliares (`set_updated_at`, `handle_new_user`,
    -- `perfis_proteger_campos`, `pedidos_marcar_pago_em`, `nome_fotografo`,
    -- `marca_publica`, as auxiliares de pagamento e e-mail de `pagamento_online`)
    -- ficam sem EXECUTE para anon/authenticated.

    reparou := true;
  end if;

  return reparou;
end;
$$;

revoke all on function public.garantir_instalacao() from public, anon, authenticated;
grant execute on function public.garantir_instalacao() to anon, authenticated, service_role;

do $$ begin perform public.garantir_instalacao(); end $$;

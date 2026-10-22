-- ============================================================================
-- Ajustes do pagamento online depois do primeiro teste real
--
-- 1. Asaas: a cobrança reaproveitava qualquer cliente com o mesmo CPF. Um
--    cliente que já existia na conta vinha com as notificações do Asaas
--    ligadas, e o Asaas cobrou mensageria. Agora o sistema só reaproveita o
--    cliente que ele mesmo criou (`externalReference = fotovenda`, sempre com
--    as notificações desligadas).
-- 2. E-mail: o Resend recusa remetente de domínio que não é do fotógrafo
--    (Gmail, Hotmail…), e o envio pelo `pg_net` não volta com o erro. O
--    remetente gratuito passa a ser recusado ao salvar, e o envio automático
--    só liga depois de um e-mail de teste aceito (`email_testado_em`). Trocar
--    a chave ou o remetente pede o teste de novo.
-- ============================================================================

alter table public.configuracoes_loja
  add column if not exists email_testado_em timestamptz;

create or replace function public.dominios_email_gratuito()
returns text[]
language sql immutable
set search_path = public as $$
  select array[
    'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.br', 'outlook.com',
    'outlook.com.br', 'live.com', 'msn.com', 'yahoo.com', 'yahoo.com.br', 'icloud.com',
    'me.com', 'mac.com', 'bol.com.br', 'uol.com.br', 'terra.com.br', 'ig.com.br',
    'proton.me', 'protonmail.com', 'aol.com', 'gmx.com', 'zoho.com'
  ];
$$;
revoke execute on function public.dominios_email_gratuito() from anon, authenticated, public;

-- Igual à de `pagamento_online`, só com o e-mail testado.
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
     or coalesce(c.url_publica, '') = '' or coalesce(_p.cliente_email, '') = ''
     or c.email_testado_em is null then
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

-- Igual à de `pagamento_online`, dizendo se o e-mail já passou no teste.
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
    'email_remetente', c.email_remetente,
    'email_testado', c.email_testado_em is not null
  );
end;
$$;

-- Igual à de `pagamento_online`, recusando remetente de e-mail gratuito e
-- zerando o teste quando a chave ou o remetente mudam.
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
  if split_part(remetente, '@', 2) = any(public.dominios_email_gratuito()) then
    raise exception 'Use um e-mail de um domínio seu, verificado no Resend (ex.: fotos@seudominio.com.br). Gmail, Hotmail e afins não podem ser remetente.';
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
  -- Chave ou remetente novos voltam a pedir o teste antes de enviar.
  update public.configuracoes_loja
     set email_testado_em = case
           when _chave is not null or remetente is distinct from email_remetente then null
           else email_testado_em end,
         email_remetente = remetente,
         url_publica = coalesce(url, url_publica)
   where id = 1;
  return public.diagnostico_pagamento();
end;
$$;

-- Igual à de `pagamento_online`; o teste que passa libera o envio automático.
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
  update public.configuracoes_loja set email_testado_em = now() where id = 1;
  return para;
end;
$$;

-- Igual à de `pagamento_online`, com o cliente próprio no Asaas.
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
      -- Só reaproveita cliente criado por aqui: o que já existia na conta pode
      -- ter as notificações do Asaas ligadas (cobradas como mensageria).
      cliente := public.asaas_chamar('GET', '/customers?externalReference=fotovenda&cpfCnpj=' || cpf)
                   -> 'data' -> 0 ->> 'id';
      if cliente is null then
        cliente := public.asaas_chamar('POST', '/customers', jsonb_build_object(
          'name', p.cliente_nome, 'cpfCnpj', cpf, 'email', p.cliente_email,
          'externalReference', 'fotovenda', 'notificationDisabled', true)) ->> 'id';
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

revoke execute on function public.enviar_email_pedido(public.pedidos) from anon, authenticated, public;
revoke execute on function
  public.diagnostico_pagamento(),
  public.configurar_email(text, text, text),
  public.enviar_email_teste(),
  public.gerar_cobranca(text, text, text)
  from anon, authenticated, public;
grant execute on function
  public.diagnostico_pagamento(),
  public.configurar_email(text, text, text),
  public.enviar_email_teste()
  to authenticated;
grant execute on function public.gerar_cobranca(text, text, text) to anon, authenticated;

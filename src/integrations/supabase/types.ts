// Mantido à mão: espelha exatamente `supabase/migrations/*`. Toda migration que
// cria ou altera tabela, coluna, enum ou função atualiza este arquivo junto.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      configuracoes_loja: {
        Row: {
          chave_pix: string
          cor_primaria: string
          cor_secundaria: string
          id: number
          instrucoes_pagamento: string
          logo_caminho: string
          nome_exibicao: string
          texto_marca_dagua: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          chave_pix?: string
          cor_primaria?: string
          cor_secundaria?: string
          id?: number
          instrucoes_pagamento?: string
          logo_caminho?: string
          nome_exibicao?: string
          texto_marca_dagua?: string
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          chave_pix?: string
          cor_primaria?: string
          cor_secundaria?: string
          id?: number
          instrucoes_pagamento?: string
          logo_caminho?: string
          nome_exibicao?: string
          texto_marca_dagua?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      fotos: {
        Row: {
          altura: number
          caminho_miniatura: string
          caminho_original: string
          caminho_previa: string
          created_at: string
          galeria_id: string
          id: string
          largura: number
          nome_arquivo: string
          ordem: number
          organizacao_id: string | null
          rostos_analisados_em: string | null
          tamanho_bytes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          altura: number
          caminho_miniatura: string
          caminho_original: string
          caminho_previa: string
          created_at?: string
          galeria_id: string
          id?: string
          largura: number
          nome_arquivo: string
          ordem?: number
          organizacao_id?: string | null
          rostos_analisados_em?: string | null
          tamanho_bytes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          altura?: number
          caminho_miniatura?: string
          caminho_original?: string
          caminho_previa?: string
          created_at?: string
          galeria_id?: string
          id?: string
          largura?: number
          nome_arquivo?: string
          ordem?: number
          organizacao_id?: string | null
          rostos_analisados_em?: string | null
          tamanho_bytes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      galerias: {
        Row: {
          busca_rosto: boolean
          capa_foto_id: string | null
          categoria: string
          cliente_email: string
          cliente_nome: string
          created_at: string
          data_evento: string | null
          descricao: string
          id: string
          local: string
          organizacao_id: string | null
          preco_foto: number
          preco_pacote: number | null
          senha: string
          slug: string
          status: Database["public"]["Enums"]["status_galeria"]
          tipo: Database["public"]["Enums"]["tipo_galeria"]
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          busca_rosto?: boolean
          capa_foto_id?: string | null
          categoria?: string
          cliente_email?: string
          cliente_nome?: string
          created_at?: string
          data_evento?: string | null
          descricao?: string
          id?: string
          local?: string
          organizacao_id?: string | null
          preco_foto?: number
          preco_pacote?: number | null
          senha?: string
          slug: string
          status?: Database["public"]["Enums"]["status_galeria"]
          tipo?: Database["public"]["Enums"]["tipo_galeria"]
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          busca_rosto?: boolean
          capa_foto_id?: string | null
          categoria?: string
          cliente_email?: string
          cliente_nome?: string
          created_at?: string
          data_evento?: string | null
          descricao?: string
          id?: string
          local?: string
          organizacao_id?: string | null
          preco_foto?: number
          preco_pacote?: number | null
          senha?: string
          slug?: string
          status?: Database["public"]["Enums"]["status_galeria"]
          tipo?: Database["public"]["Enums"]["tipo_galeria"]
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "galerias_capa_foto_id_fkey"
            columns: ["capa_foto_id"]
            isOneToOne: false
            referencedRelation: "fotos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galerias_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "galerias_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          codigo_body: string
          codigo_head: string
          conteudo: Json
          cores: Json
          created_at: string
          ga4_id: string
          google_ads_id: string
          gtm_id: string
          id: string
          meta_capi_ativa: boolean
          meta_pixel_id: string
          meta_test_event_code: string
          modelo: string
          organizacao_id: string | null
          publicada: boolean
          slug: string
          tiktok_pixel_id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          codigo_body?: string
          codigo_head?: string
          conteudo?: Json
          cores?: Json
          created_at?: string
          ga4_id?: string
          google_ads_id?: string
          gtm_id?: string
          id?: string
          meta_capi_ativa?: boolean
          meta_pixel_id?: string
          meta_test_event_code?: string
          modelo: string
          organizacao_id?: string | null
          publicada?: boolean
          slug: string
          tiktok_pixel_id?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          codigo_body?: string
          codigo_head?: string
          conteudo?: Json
          cores?: Json
          created_at?: string
          ga4_id?: string
          google_ads_id?: string
          gtm_id?: string
          id?: string
          meta_capi_ativa?: boolean
          meta_pixel_id?: string
          meta_test_event_code?: string
          modelo?: string
          organizacao_id?: string | null
          publicada?: boolean
          slug?: string
          tiktok_pixel_id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_segredos: {
        Row: {
          landing_id: string
          meta_capi_token: string
          updated_at: string
        }
        Insert: {
          landing_id: string
          meta_capi_token?: string
          updated_at?: string
        }
        Update: {
          landing_id?: string
          meta_capi_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_segredos_landing_id_fkey"
            columns: ["landing_id"]
            isOneToOne: true
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacao_membros: {
        Row: {
          created_at: string
          organizacao_id: string
          papel: Database["public"]["Enums"]["papel_organizacao"]
          user_id: string
        }
        Insert: {
          created_at?: string
          organizacao_id: string
          papel: Database["public"]["Enums"]["papel_organizacao"]
          user_id: string
        }
        Update: {
          created_at?: string
          organizacao_id?: string
          papel?: Database["public"]["Enums"]["papel_organizacao"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizacao_membros_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizacao_membros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacoes: {
        Row: {
          cadastro_aberto: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          cadastro_aberto?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          cadastro_aberto?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      pedido_itens: {
        Row: {
          foto_id: string
          pedido_id: string
          preco: number
        }
        Insert: {
          foto_id: string
          pedido_id: string
          preco: number
        }
        Update: {
          foto_id?: string
          pedido_id?: string
          preco?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_foto_id_fkey"
            columns: ["foto_id"]
            isOneToOne: false
            referencedRelation: "fotos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_email: string
          cliente_nome: string
          cliente_telefone: string
          codigo: string
          created_at: string
          galeria_id: string
          id: string
          organizacao_id: string | null
          pacote_completo: boolean
          pago_em: string | null
          status: Database["public"]["Enums"]["status_pedido"]
          updated_at: string
          user_id: string
          valor_total: number
        }
        Insert: {
          cliente_email: string
          cliente_nome: string
          cliente_telefone?: string
          codigo?: string
          created_at?: string
          galeria_id: string
          id?: string
          organizacao_id?: string | null
          pacote_completo?: boolean
          pago_em?: string | null
          status?: Database["public"]["Enums"]["status_pedido"]
          updated_at?: string
          user_id: string
          valor_total: number
        }
        Update: {
          cliente_email?: string
          cliente_nome?: string
          cliente_telefone?: string
          codigo?: string
          created_at?: string
          galeria_id?: string
          id?: string
          organizacao_id?: string | null
          pacote_completo?: boolean
          pago_em?: string | null
          status?: Database["public"]["Enums"]["status_pedido"]
          updated_at?: string
          user_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      rostos: {
        Row: {
          created_at: string
          embedding: string
          foto_id: string
          galeria_id: string
          id: string
          organizacao_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          embedding: string
          foto_id: string
          galeria_id: string
          id?: string
          organizacao_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          embedding?: string
          foto_id?: string
          galeria_id?: string
          id?: string
          organizacao_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rostos_foto_id_fkey"
            columns: ["foto_id"]
            isOneToOne: false
            referencedRelation: "fotos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rostos_galeria_id_fkey"
            columns: ["galeria_id"]
            isOneToOne: false
            referencedRelation: "galerias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rostos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rostos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buscar_fotos_por_rosto: {
        Args: { _rosto: number[]; _senha: string; _slug: string }
        Returns: Json
      }
      contas_fora_da_organizacao: {
        Args: Record<PropertyKey, never>
        Returns: { email: string; nome: string; user_id: string }[]
      }
      criar_pedido: {
        Args: {
          _email: string
          _fotos: string[] | null
          _nome: string
          _pacote_completo: boolean
          _senha: string
          _slug: string
          _telefone: string
        }
        Returns: string
      }
      definir_cadastro_aberto: { Args: { _aberto: boolean }; Returns: boolean }
      definir_token_capi: { Args: { _landing: string; _token: string }; Returns: undefined }
      enviar_evento_meta: {
        Args: {
          _event_id: string
          _evento: string
          _fbc: string
          _fbp: string
          _ip: string
          _slug: string
          _url: string
          _user_agent: string
        }
        Returns: boolean
      }
      eventos_publicos: { Args: Record<PropertyKey, never>; Returns: Json }
      foto_original_liberada: { Args: { _caminho: string }; Returns: boolean }
      galeria_publica: { Args: { _senha?: string; _slug: string }; Returns: Json }
      garantir_instalacao: { Args: Record<PropertyKey, never>; Returns: boolean }
      garantir_organizacao: { Args: Record<PropertyKey, never>; Returns: boolean }
      landing_publica: { Args: { _slug: string }; Returns: Json }
      landing_tem_token_capi: { Args: { _landing: string }; Returns: boolean }
      mesma_organizacao: { Args: { _user: string }; Returns: boolean }
      meu_papel: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["papel_organizacao"]
      }
      minha_organizacao: { Args: Record<PropertyKey, never>; Returns: string }
      pedido_publico: { Args: { _codigo: string }; Returns: Json }
      readmitir_membro: { Args: { _user_id: string }; Returns: undefined }
      remover_membro: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      papel_organizacao: "dono" | "membro"
      status_galeria: "rascunho" | "publicada" | "arquivada"
      status_pedido: "aguardando_pagamento" | "pago" | "cancelado"
      tipo_galeria: "privada" | "evento"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      papel_organizacao: ["dono", "membro"],
      status_galeria: ["rascunho", "publicada", "arquivada"],
      status_pedido: ["aguardando_pagamento", "pago", "cancelado"],
      tipo_galeria: ["privada", "evento"],
    },
  },
} as const;

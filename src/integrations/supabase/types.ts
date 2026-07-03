export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cartoes: {
        Row: {
          bandeira: string | null
          codigo: string | null
          cpf_cnpj: string | null
          created_at: string
          dia_fechamento: number | null
          dia_vencimento: number | null
          id: string
          id_externo: string | null
          limite: number | null
          nome: string
          owner_id: string | null
          titular: string | null
          updated_at: string
        }
        Insert: {
          bandeira?: string | null
          codigo?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          id_externo?: string | null
          limite?: number | null
          nome: string
          owner_id?: string | null
          titular?: string | null
          updated_at?: string
        }
        Update: {
          bandeira?: string | null
          codigo?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          id_externo?: string | null
          limite?: number | null
          nome?: string
          owner_id?: string | null
          titular?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          bairro: string | null
          cep: string | null
          cnpj_cpf: string | null
          codigo: string | null
          codigo_ibge: string | null
          complemento: string | null
          contato: string | null
          created_at: string
          email: string | null
          endereco: string | null
          fone: string | null
          grupo: string | null
          id: string
          id_externo: string | null
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logradouro: string | null
          municipio: string | null
          nome_fantasia: string
          numero: string | null
          origem: string | null
          owner_id: string | null
          razao_social: string | null
          tipo_pessoa: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cnpj_cpf?: string | null
          codigo?: string | null
          codigo_ibge?: string | null
          complemento?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          fone?: string | null
          grupo?: string | null
          id?: string
          id_externo?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          municipio?: string | null
          nome_fantasia: string
          numero?: string | null
          origem?: string | null
          owner_id?: string | null
          razao_social?: string | null
          tipo_pessoa?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cnpj_cpf?: string | null
          codigo?: string | null
          codigo_ibge?: string | null
          complemento?: string | null
          contato?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          fone?: string | null
          grupo?: string | null
          id?: string
          id_externo?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          municipio?: string | null
          nome_fantasia?: string
          numero?: string | null
          origem?: string | null
          owner_id?: string | null
          razao_social?: string | null
          tipo_pessoa?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      conta_programas: {
        Row: {
          ativo: boolean
          conta_id: string
          created_at: string | null
          id: string
          programa_id: string
          saldo_atualizado_em: string | null
          saldo_data_ref: string | null
          saldo_email_em: string | null
          saldo_milhas: number | null
        }
        Insert: {
          ativo?: boolean
          conta_id: string
          created_at?: string | null
          id?: string
          programa_id: string
          saldo_atualizado_em?: string | null
          saldo_data_ref?: string | null
          saldo_email_em?: string | null
          saldo_milhas?: number | null
        }
        Update: {
          ativo?: boolean
          conta_id?: string
          created_at?: string | null
          id?: string
          programa_id?: string
          saldo_atualizado_em?: string | null
          saldo_data_ref?: string | null
          saldo_email_em?: string | null
          saldo_milhas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conta_programas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conta_programas_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas: {
        Row: {
          codigo: string | null
          cpf: string | null
          created_at: string
          email: string | null
          fone: string | null
          id: string
          id_externo: string | null
          nascimento: string | null
          nome: string
          numero_smiles: string | null
          owner_id: string | null
          pix_envio: string | null
          saldo_atualizado_em: string | null
          saldo_milhas: number | null
          saldo_programa: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          codigo?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          fone?: string | null
          id?: string
          id_externo?: string | null
          nascimento?: string | null
          nome: string
          numero_smiles?: string | null
          owner_id?: string | null
          pix_envio?: string | null
          saldo_atualizado_em?: string | null
          saldo_milhas?: number | null
          saldo_programa?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          codigo?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          fone?: string | null
          id?: string
          id_externo?: string | null
          nascimento?: string | null
          nome?: string
          numero_smiles?: string | null
          owner_id?: string | null
          pix_envio?: string | null
          saldo_atualizado_em?: string | null
          saldo_milhas?: number | null
          saldo_programa?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      emissoes: {
        Row: {
          ajuste_campo_aberto: string | null
          ajuste_cupom: number | null
          ajuste_desconto_promo: boolean
          ajuste_hack_upgrade: boolean
          ajuste_retarifacao: boolean
          assentos_cobrado: number | null
          assentos_real: number | null
          assentos_real_tipo: string | null
          assentos_tipo: string | null
          bagagens_cobrado: number | null
          bagagens_real: number | null
          bagagens_real_tipo: string | null
          bagagens_tipo: string | null
          cancelar: boolean
          cartao_id: string | null
          checkout_id: string | null
          checkout_status: string | null
          checkout_url: string | null
          cliente_id: string | null
          codigo_la: string | null
          conta_id: string | null
          cpfs_otimizados: number | null
          created_at: string
          data_cobranca: string | null
          data_emissao: string | null
          data_hora_emissao: string | null
          data_pagto_facial: string | null
          data_recebimento: string | null
          data_voo_ida: string | null
          emissor: string | null
          facial: boolean
          facial_pago: boolean
          forma_cobranca: string | null
          forma_paga: string | null
          forma_pagamento: string | null
          hora: string | null
          id: string
          id_emissao: string | null
          id_externo: string | null
          localizador: string | null
          milhas_cobrado: number | null
          milhas_real: number | null
          nome_operacao: string | null
          nota: string | null
          obs_pix: string | null
          observacao: string | null
          origem_venda: string | null
          outros_cobrado: number | null
          outros_descricao: string | null
          outros_real: number | null
          owner_id: string
          pagar_facial: string | null
          passageiros_qtd: number | null
          percentual_cb: number | null
          pix_copia_cola: string | null
          pix_qrcode: string | null
          pix_txid: string | null
          preco_milheiro: number | null
          preco_total: number | null
          programa: string | null
          reprocessar: boolean
          status_pix: string | null
          taxas_cobrado: number | null
          taxas_real: number | null
          taxas_real_tipo: string | null
          taxas_tipo: string | null
          total_milhas: number | null
          txid: string | null
          updated_at: string
          valor_recebido: number | null
        }
        Insert: {
          ajuste_campo_aberto?: string | null
          ajuste_cupom?: number | null
          ajuste_desconto_promo?: boolean
          ajuste_hack_upgrade?: boolean
          ajuste_retarifacao?: boolean
          assentos_cobrado?: number | null
          assentos_real?: number | null
          assentos_real_tipo?: string | null
          assentos_tipo?: string | null
          bagagens_cobrado?: number | null
          bagagens_real?: number | null
          bagagens_real_tipo?: string | null
          bagagens_tipo?: string | null
          cancelar?: boolean
          cartao_id?: string | null
          checkout_id?: string | null
          checkout_status?: string | null
          checkout_url?: string | null
          cliente_id?: string | null
          codigo_la?: string | null
          conta_id?: string | null
          cpfs_otimizados?: number | null
          created_at?: string
          data_cobranca?: string | null
          data_emissao?: string | null
          data_hora_emissao?: string | null
          data_pagto_facial?: string | null
          data_recebimento?: string | null
          data_voo_ida?: string | null
          emissor?: string | null
          facial?: boolean
          facial_pago?: boolean
          forma_cobranca?: string | null
          forma_paga?: string | null
          forma_pagamento?: string | null
          hora?: string | null
          id?: string
          id_emissao?: string | null
          id_externo?: string | null
          localizador?: string | null
          milhas_cobrado?: number | null
          milhas_real?: number | null
          nome_operacao?: string | null
          nota?: string | null
          obs_pix?: string | null
          observacao?: string | null
          origem_venda?: string | null
          outros_cobrado?: number | null
          outros_descricao?: string | null
          outros_real?: number | null
          owner_id?: string
          pagar_facial?: string | null
          passageiros_qtd?: number | null
          percentual_cb?: number | null
          pix_copia_cola?: string | null
          pix_qrcode?: string | null
          pix_txid?: string | null
          preco_milheiro?: number | null
          preco_total?: number | null
          programa?: string | null
          reprocessar?: boolean
          status_pix?: string | null
          taxas_cobrado?: number | null
          taxas_real?: number | null
          taxas_real_tipo?: string | null
          taxas_tipo?: string | null
          txid?: string | null
          updated_at?: string
          valor_recebido?: number | null
        }
        Update: {
          ajuste_campo_aberto?: string | null
          ajuste_cupom?: number | null
          ajuste_desconto_promo?: boolean
          ajuste_hack_upgrade?: boolean
          ajuste_retarifacao?: boolean
          assentos_cobrado?: number | null
          assentos_real?: number | null
          assentos_real_tipo?: string | null
          assentos_tipo?: string | null
          bagagens_cobrado?: number | null
          bagagens_real?: number | null
          bagagens_real_tipo?: string | null
          bagagens_tipo?: string | null
          cancelar?: boolean
          cartao_id?: string | null
          checkout_id?: string | null
          checkout_status?: string | null
          checkout_url?: string | null
          cliente_id?: string | null
          codigo_la?: string | null
          conta_id?: string | null
          cpfs_otimizados?: number | null
          created_at?: string
          data_cobranca?: string | null
          data_emissao?: string | null
          data_hora_emissao?: string | null
          data_pagto_facial?: string | null
          data_recebimento?: string | null
          data_voo_ida?: string | null
          emissor?: string | null
          facial?: boolean
          facial_pago?: boolean
          forma_cobranca?: string | null
          forma_paga?: string | null
          forma_pagamento?: string | null
          hora?: string | null
          id?: string
          id_emissao?: string | null
          id_externo?: string | null
          localizador?: string | null
          milhas_cobrado?: number | null
          milhas_real?: number | null
          nome_operacao?: string | null
          nota?: string | null
          obs_pix?: string | null
          observacao?: string | null
          origem_venda?: string | null
          outros_cobrado?: number | null
          outros_descricao?: string | null
          outros_real?: number | null
          owner_id?: string
          pagar_facial?: string | null
          passageiros_qtd?: number | null
          percentual_cb?: number | null
          pix_copia_cola?: string | null
          pix_qrcode?: string | null
          pix_txid?: string | null
          preco_milheiro?: number | null
          preco_total?: number | null
          programa?: string | null
          reprocessar?: boolean
          status_pix?: string | null
          taxas_cobrado?: number | null
          taxas_real?: number | null
          taxas_real_tipo?: string | null
          taxas_tipo?: string | null
          txid?: string | null
          updated_at?: string
          valor_recebido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "emissoes_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emissoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emissoes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
      emissores: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      listas: {
        Row: {
          created_at: string
          id: string
          owner_id: string | null
          tipo: string
          updated_at: string
          valor: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id?: string | null
          tipo: string
          updated_at?: string
          valor: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string | null
          tipo?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      operacoes: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      origens: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      perfis_usuario: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          gl_id: string
          id: string
          nome: string
          papel: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          gl_id: string
          id: string
          nome: string
          papel?: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          gl_id?: string
          id?: string
          nome?: string
          papel?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      programas: {
        Row: {
          created_at: string
          id: string
          nome: string
          observacao: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          observacao?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          observacao?: string | null
        }
        Relationships: []
      }
      telas: {
        Row: {
          chave: string
          created_at: string
          fase: number
          id: string
          nome: string
          ordem: number
          pronta: boolean
        }
        Insert: {
          chave: string
          created_at?: string
          fase?: number
          id?: string
          nome: string
          ordem?: number
          pronta?: boolean
        }
        Update: {
          chave?: string
          created_at?: string
          fase?: number
          id?: string
          nome?: string
          ordem?: number
          pronta?: boolean
        }
        Relationships: []
      }
      usuario_telas: {
        Row: {
          tela_id: string
          usuario_id: string
        }
        Insert: {
          tela_id: string
          usuario_id: string
        }
        Update: {
          tela_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_telas_tela_id_fkey"
            columns: ["tela_id"]
            isOneToOne: false
            referencedRelation: "telas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_telas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      atualizar_saldo_latam: {
        Args: {
          p_codigo: string
          p_data_ref: string
          p_email_em?: string
          p_saldo: number
        }
        Returns: Json
      }
      atualizar_saldo_smiles:
        | {
            Args: {
              p_data_ref: string
              p_numero_smiles: string
              p_saldo: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_data_ref: string
              p_email_em?: string
              p_numero_smiles: string
              p_saldo: number
            }
            Returns: Json
          }
      is_admin: { Args: never; Returns: boolean }
      is_delete_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      tem_acesso_tela: { Args: { p_chave: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

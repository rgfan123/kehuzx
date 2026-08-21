export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }

export interface User {
  id: string; username: string; display_name: string; role: string;
}

export interface LoginResponse {
  token: string; user: User;
}

export interface ProductFields {
  product_name?: string; raw_material_part?: string; product_category?: string; meat_grade?: string;
  variety?: string; goods_status?: string; manufacturer?: string; import_domestic?: string;
  origin?: string; execution_standard?: string; processing_method?: string; product_form?: string;
  fat_lean_ratio?: string; cut_length?: string; length_unit?: string; cut_width?: string;
  width_unit?: string; cut_thickness?: string; thickness_unit?: string; trimming_grade?: string;
  processing_details?: string; packaging_plan?: string; unit_price?: string; price_currency?: string;
  pricing_unit?: string; tax_included?: boolean; tax_rate?: string; delivery_fee?: string;
}

export interface Customer {
  id: string; code: string; name: string; category?: string; contact_name?: string; phone?: string;
  wechat?: string; company_name?: string; industry?: string; address?: string; status?: string;
  notes?: string; created_at: string; demand_count: number; sample_order_count: number; formal_order_count: number;
}

export interface Demand extends ProductFields {
  id: string; code: string; name: string; expected_delivery_date?: string; notes?: string; created_at: string;
}

export interface Template extends ProductFields {
  id: string; code: string; name: string; customer_id: string; customer_name?: string;
  source_demand_id?: string; status: string; notes?: string; created_at: string;
}

export interface Supplier {
  id: string; code: string; name: string; contact_name?: string; phone?: string;
  address?: string; status?: string; notes?: string; created_at: string;
}

export interface OrderItem extends ProductFields {
  id: string; source_template_id?: string; source_template_code?: string;
  source_template_name?: string; source_sample_order_id?: string;
  supplier_id?: string; supplier_name?: string;
  quantity_per_unit?: string; quantity_unit?: string; unit_count?: number;
  total_quantity?: string; notes?: string;
}

export interface Order {
  id: string; code: string; name: string; customer_id?: string; customer_name?: string;
  is_submitted: boolean; workflow_status?: string;
  delivery_date?: string; delivery_address?: string; delivery_lead_time?: string; delivery_cycle?: string;
  settlement_period?: string; settlement_method?: string; settlement_amount?: string; notes?: string;
  is_suspended: boolean; suspended_reason?: string;
  created_at: string; updated_at?: string; items: OrderItem[];
}

export interface OperationLog {
  id: string; entity_type: string; entity_id: string; entity_name?: string;
  record_code?: string; action: string; operator: string;
  change_detail?: string; created_at: string;
}

// Workflow display config
export const SAMPLE_FLOW_TEXT: Record<string, string> = {
  SAMPLE_COMMUNICATION: '样品沟通',
  FACTORY_COMMUNICATION: '工厂沟通',
  SAMPLE_PRODUCING: '样品制作中',
  SAMPLE_COMPLETED: '样品制作完成',
  SAMPLE_DELIVERY: '顾客送样',
  PRODUCT_CONFIRMED: '成品确定',
}

export const FORMAL_FLOW_TEXT: Record<string, string> = {
  ORDER_COMMUNICATION: '订单沟通',
  FACTORY_COMMUNICATION: '工厂沟通',
  ORDER_PRODUCING: '订单制作中',
  ORDER_COMPLETED: '订单制作完成',
  DELIVERED_TO_CUSTOMER: '送达顾客',
}

export const ACTION_TEXT: Record<string, string> = {
  create: '创建', update: '更新', delete: '删除',
  create_from_demand: '从需求创建', duplicate: '复制',
  status_change: '状态变更', login: '登录',
  submit: '提交', advance: '推进', suspend: '中止', resume: '恢复',
}

export const ENTITY_TEXT: Record<string, string> = {
  customer: '客户', demand: '需求', template: '模板',
  supplier: '供应商', order: '订单', user: '用户',
}

export interface DashboardData {
  metrics: {
    customers: number
    in_progress: number
    suspended: number
    drafts: number
    monthly_amount: string
  }
  workflow_summary: {
    key: string
    label: string
    sample_count: number
    formal_count: number
  }[]
  suspended_orders: {
    id: string
    code: string
    name: string
    type: 'sample' | 'formal'
    reason: string
  }[]
  draft_orders: {
    id: string
    code: string
    name: string
    type: 'sample' | 'formal'
  }[]
  recent_logs: {
    id: string
    action: string
    entity_type: string
    entity_name: string
    record_code: string
    operator: string
    created_at: string
  }[]
}

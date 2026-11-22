export type Shop = {
  id: string;
  name: string;
  currency: string;
};

export type Product = {
  id: string;
  shop_id: string;
  name: string;
  sku: string | null;
  price: number;
  cost_price: number;
  stock: number;
  low_stock_threshold: number;
  active: boolean;
  barcode: string | null;
  track_stock: boolean;
  quick_added: boolean;
};

export type PaymentMethod = "cash" | "mtn_momo" | "airtel_money" | "zamtel_kwacha";

export type SaleItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
};

export type Sale = {
  id: string;
  receipt_no: string;
  total: number;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  status: "completed" | "refunded";
  created_at: string;
  sale_items?: SaleItem[];
  /** True while the sale is saved on this device but not yet confirmed by the server. */
  pending?: boolean;
};

/** A sale built on the device. The id is created here so retrying the sync can never double-count it. */
export type SalePayload = {
  id: string;
  shop_id: string;
  receipt_no: string;
  created_at: string;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  items: {
    product_id: string | null;
    name: string;
    quantity: number;
    unit_price: number;
    unit_cost: number;
  }[];
};

export type ExpensePayload = {
  id: string;
  shop_id: string;
  description: string;
  category: string;
  amount: number;
  expense_date: string;
};

export type OutboxOp =
  | { seq?: number; kind: "sale"; shop_id: string; payload: SalePayload; created_at: string; attempts: number; failed?: boolean; error?: string }
  | { seq?: number; kind: "product"; shop_id: string; payload: Product; created_at: string; attempts: number; failed?: boolean; error?: string }
  | { seq?: number; kind: "expense"; shop_id: string; payload: ExpensePayload; created_at: string; attempts: number; failed?: boolean; error?: string };

export type Expense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  expense_date: string;
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  mtn_momo: "MTN MoMo",
  airtel_money: "Airtel Money",
  zamtel_kwacha: "Zamtel Kwacha",
};

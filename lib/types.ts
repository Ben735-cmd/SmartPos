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
};

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

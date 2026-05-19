export type CreateOrderInput = {
  userId: string;
  planId: string;
  amountCents: number;
};

export type PayOrderResult = {
  status: "paid" | "failed";
  message: string;
};

export interface BillingAdapter {
  createOrder(input: CreateOrderInput): Promise<{ orderNo: string }>;
  payOrder(orderNo: string): Promise<PayOrderResult>;
}

export class MockBillingAdapter implements BillingAdapter {
  // eslint-disable-next-line
  async createOrder(_input: CreateOrderInput): Promise<{ orderNo: string }> {
    return { orderNo: `MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}` };
  }
  // eslint-disable-next-line
  async payOrder(_orderNo: string): Promise<PayOrderResult> {
    return { status: "paid", message: "【模拟模式】支付成功（未真实扣款）" };
  }
}

export const mockBillingAdapter = new MockBillingAdapter();

export type PushDraftInput = {
  articleId: string;
  officialAccountId: string;
  userId: string;
};

export type PushDraftResult = {
  externalDraftId: string;
  status: "success" | "failed";
  message: string;
};

export interface WeChatDraftAdapter {
  pushDraft(input: PushDraftInput): Promise<PushDraftResult>;
}

export class MockWeChatDraftAdapter implements WeChatDraftAdapter {
  // eslint-disable-next-line
  async pushDraft(_input: PushDraftInput): Promise<PushDraftResult> {
    return {
      externalDraftId: `mock_draft_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      status: "success",
      message: "【模拟模式】草稿已保存（未真实推送到微信）",
    };
  }
}

export const mockWeChatDraftAdapter = new MockWeChatDraftAdapter();

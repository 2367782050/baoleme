/**
 * 中文显示标签映射
 * 所有用户可见的状态/角色/配额/套餐名称统一从这里取
 */

// ─── 用户状态 ──────────────────────────────────────────────────
const USER_STATUS: Record<string, string> = {
  active: "正常",
  disabled: "已禁用",
};

// ─── 订单状态 ──────────────────────────────────────────────────
const ORDER_STATUS: Record<string, string> = {
  pending: "待支付",
  paid: "已支付",
  cancelled: "已取消",
  expired: "已过期",
};

// ─── 会员状态 ──────────────────────────────────────────────────
const MEMBERSHIP_STATUS: Record<string, string> = {
  active: "生效中",
  expired: "已过期",
  cancelled: "已取消",
};

// ─── 文章/提示词生成任务状态 ──────────────────────────────────
const JOB_STATUS: Record<string, string> = {
  pending: "等待中",
  generating: "创作中",
  completed: "已完成",
  failed: "失败",
};

// ─── 提现状态 ──────────────────────────────────────────────────
const WITHDRAWAL_STATUS: Record<string, string> = {
  pending: "待处理",
  approved: "已通过",
  rejected: "已驳回",
};

// ─── 佣金状态 ──────────────────────────────────────────────────
const COMMISSION_STATUS: Record<string, string> = {
  pending: "待生效",
  available: "可提现",
  withdrawn: "已提现",
  cancelled: "已取消",
};

// ─── 提示词来源 ────────────────────────────────────────────────
const PROMPT_SOURCE: Record<string, string> = {
  generated: "智能生成",
  manual: "手动创建",
};

// ─── 公众号授权状态 ────────────────────────────────────────────
const OA_STATUS: Record<string, string> = {
  mock_authorized: "模拟授权",
  authorized: "已授权",
  revoked: "已撤销",
};

// ─── 用户角色 ──────────────────────────────────────────────────
const USER_ROLE: Record<string, string> = {
  admin: "管理员",
  super_admin: "超级管理员",
  user: "普通用户",
};

// ─── 会员套餐 ──────────────────────────────────────────────────
const PLAN_CODE: Record<string, string> = {
  free: "免费版",
  pro: "专业版",
  enterprise: "企业版",
};

// ─── 配额 key → 中文名 ────────────────────────────────────────
const QUOTA_KEY: Record<string, string> = {
  prompt_generate: "提示词生成",
  prompt_generate_monthly: "每月提示词生成",
  article_generate: "文章生成",
  article_generate_daily: "每日文章生成",
  material_export: "素材导出",
  material_export_daily: "每日素材导出",
  image_upload: "图片上传",
  image_upload_daily: "每日图片上传",
  draft_push: "草稿推送",
  draft_push_daily: "每日草稿推送",
  official_account_bind: "公众号数",
  official_account_limit: "公众号数量",
};

// ─── 会员来源 ──────────────────────────────────────────────────
const MEMBERSHIP_SOURCE: Record<string, string> = {
  purchase: "购买",
  redeem: "兑换码",
  admin: "管理员开通",
  trial: "试用",
  promotion: "推广奖励",
};

// ═══════════════════════════════════════════════════════════════
// 导出格式化函数
// ═══════════════════════════════════════════════════════════════

export function formatUserStatus(s: string): string {
  return USER_STATUS[s] ?? s;
}

export function formatOrderStatus(s: string): string {
  return ORDER_STATUS[s] ?? s;
}

export function formatMembershipStatus(s: string): string {
  return MEMBERSHIP_STATUS[s] ?? s;
}

export function formatJobStatus(s: string): string {
  return JOB_STATUS[s] ?? s;
}

export function formatWithdrawalStatus(s: string): string {
  return WITHDRAWAL_STATUS[s] ?? s;
}

export function formatCommissionStatus(s: string): string {
  return COMMISSION_STATUS[s] ?? s;
}

export function formatPromptSource(s: string): string {
  return PROMPT_SOURCE[s] ?? s;
}

export function formatOAStatus(s: string): string {
  return OA_STATUS[s] ?? s;
}

export function formatRole(r: string): string {
  return USER_ROLE[r] ?? r;
}

export function formatPlanCode(c: string): string {
  return PLAN_CODE[c] ?? c;
}

export function formatQuotaKey(k: string): string {
  return QUOTA_KEY[k] ?? k;
}

export function formatMembershipSource(s: string): string {
  return MEMBERSHIP_SOURCE[s] ?? s;
}

/**
 * 通用状态格式化 — 合并所有状态表
 */
export function formatStatus(s: string): string {
  const merged: Record<string, string> = {
    ...USER_STATUS,
    ...ORDER_STATUS,
    ...MEMBERSHIP_STATUS,
    ...JOB_STATUS,
    ...WITHDRAWAL_STATUS,
    ...COMMISSION_STATUS,
    ...OA_STATUS,
  };
  return merged[s] ?? s;
}

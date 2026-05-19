import type {
  MaterialAccount,
  MaterialArticle,
  HotTopic,
  MaterialDomain,
} from "@/lib/generated/prisma/client";

export type AccountQuery = {
  platform?: string;
  domainId?: string;
  keyword?: string;
  sortBy?: "rank" | "avgTopReadCount" | "avgReadCount" | "likeCountTotal" | "originalIndex" | "name";
  sortOrder?: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type ArticleQuery = {
  platform?: string;
  domainId?: string;
  accountId?: string;
  keyword?: string;
  page: number;
  pageSize: number;
};

export type TopicQuery = {
  platform?: string;
  page: number;
  pageSize: number;
};

export type DomainTree = MaterialDomain & {
  children: DomainTree[];
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export interface MaterialProvider {
  getDomainTree(): Promise<DomainTree[]>;
  queryAccounts(query: AccountQuery): Promise<PaginatedResult<MaterialAccount>>;
  queryArticles(query: ArticleQuery): Promise<PaginatedResult<MaterialArticle>>;
  queryHotTopics(query: TopicQuery): Promise<PaginatedResult<HotTopic>>;
}

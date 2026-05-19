import {
  getDomainTree,
} from "@/lib/services/material.service";
import { ok } from "@/lib/utils/api-response";

export async function GET() {
  const tree = await getDomainTree();
  return ok(tree);
}

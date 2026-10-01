import { createHash, timingSafeEqual } from "node:crypto";

export interface CustomerConversationContext {
  id: string;
  customerId: string | null;
  guestTokenHash: string | null;
}

export interface ConversationAccessDependencies {
  findCustomerIdByAuthId(authId: string): Promise<string | null>;
  findByCustomerId(customerId: string): Promise<CustomerConversationContext | null>;
  findByGuestTokenHash(tokenHash: string): Promise<CustomerConversationContext | null>;
}

export class ConversationAccessError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404,
    message: string,
  ) {
    super(message);
  }
}

export function hashGuestConversationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeTokenHashEquals(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashGuestConversationToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function resolveConversationOwner(
  input: { authId?: string; role?: string; guestToken?: string },
  dependencies: ConversationAccessDependencies,
): Promise<CustomerConversationContext> {
  if (input.authId) {
    if (input.role !== "customer") {
      throw new ConversationAccessError(403, "Customer conversation access required");
    }
    const customerId = await dependencies.findCustomerIdByAuthId(input.authId);
    if (!customerId) throw new ConversationAccessError(403, "Customer profile not found");
    const conversation = await dependencies.findByCustomerId(customerId);
    if (!conversation) throw new ConversationAccessError(404, "Conversation not found");
    return conversation;
  }

  if (!input.guestToken) {
    throw new ConversationAccessError(401, "Guest conversation token required");
  }
  const conversation = await dependencies.findByGuestTokenHash(
    hashGuestConversationToken(input.guestToken),
  );
  if (!conversation?.guestTokenHash ||
      !safeTokenHashEquals(input.guestToken, conversation.guestTokenHash)) {
    throw new ConversationAccessError(403, "Invalid or expired guest conversation token");
  }
  return conversation;
}

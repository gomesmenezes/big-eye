import type { Prisma } from '../db/prisma-client.js';

/**
 * Serializes terminal query transitions with admin actions and reconciliation.
 * The caller must invoke this inside the transaction that rereads and updates
 * the query row.
 */
export async function lockQuery(
  tx: Prisma.TransactionClient,
  queryId: string,
): Promise<void> {
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM queries
    WHERE id = ${queryId}::uuid
    FOR UPDATE
  `;
}

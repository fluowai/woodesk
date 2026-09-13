import type pg from "pg";

export type InstagramContactInput = {
  organizationId: string;
  senderId: string;
  name?: string | null;
};

export async function resolveInstagramContact(pool: pg.Pool, input: InstagramContactInput): Promise<string> {
  const identity = `ig:${input.senderId}`;
  const existing = await pool.query<{ id: string }>(
    `select id from contacts
     where organization_id=$1 and instagram_identity=$2
       and is_merged_into is null and is_anonymized=false
     limit 1`,
    [input.organizationId, identity],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  try {
    const created = await pool.query<{ id: string }>(
      `insert into contacts (organization_id, instagram_identity, name, display_name, source)
       values ($1, $2, $3, $3, 'instagram')
       returning id`,
      [input.organizationId, identity, input.name?.trim() || null],
    );
    const id = created.rows[0]?.id;
    if (!id) throw new Error("instagram_contact_persist_failed");
    return id;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || (error as { code?: string }).code !== "23505") throw error;
    const concurrent = await pool.query<{ id: string }>(
      `select id from contacts
       where organization_id=$1 and instagram_identity=$2
         and is_merged_into is null and is_anonymized=false
       limit 1`,
      [input.organizationId, identity],
    );
    const id = concurrent.rows[0]?.id;
    if (!id) throw new Error("instagram_contact_conflict_unresolved");
    return id;
  }
}

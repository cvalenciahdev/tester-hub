export type ParticipationFeedback = { feedback_id: string; feedback_text: string; created_at: string; updated_at: string };
export function readFeedbacks(value: unknown): ParticipationFeedback[] | null {
  if (!Array.isArray(value)) return null;
  const rows: ParticipationFeedback[] = [];
  const ids = new Set<string>();
  for (const row of value) {
    if (!row || typeof row !== "object" || typeof row.feedback_id !== "string" ||
        !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(row.feedback_id) || ids.has(row.feedback_id) ||
        typeof row.feedback_text !== "string" || !row.feedback_text.trim() ||
        typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at)) ||
        typeof row.updated_at !== "string" || !Number.isFinite(Date.parse(row.updated_at))) return null;
    ids.add(row.feedback_id);
    rows.push({ feedback_id: row.feedback_id, feedback_text: row.feedback_text, created_at: row.created_at, updated_at: row.updated_at });
  }
  return rows.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.feedback_id.localeCompare(b.feedback_id));
}

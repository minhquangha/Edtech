export function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
export function normalizeQuestionText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\d+/g, "")
}

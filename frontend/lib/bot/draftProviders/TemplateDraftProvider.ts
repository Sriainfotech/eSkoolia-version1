import type { MessageDraftProvider } from '@/types/bot';
import { API_BASE_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

function fillPlaceholders(body: string, params: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (match, key) => params[key] ?? match);
}

function classifyTopic(freeTextTopic: string): string {
  const t = freeTextTopic.toLowerCase();
  if (t.includes('fee') || t.includes('payment')) return 'fee';
  if (t.includes('attendance') || t.includes('absent')) return 'attendance';
  if (t.includes('exam') || t.includes('result') || t.includes('mark')) return 'exam';
  if (t.includes('meeting') || t.includes('parent teacher')) return 'meeting';
  return 'generic';
}

/**
 * Pulls parameterized templates from apps.assistant.models.MessageTemplate
 * (tenant-scoped, school override over global default) instead of the
 * hardcoded template strings previously inline in AIBot.tsx.
 */
export class TemplateDraftProvider implements MessageDraftProvider {
  providerType = 'template';

  async draft(topicKey: string, params: Record<string, string> = {}): Promise<string> {
    const resolvedTopic = classifyTopic(topicKey);
    const token = getAccessToken();
    const res = await fetch(`${API_BASE_URL}/api/v1/assistant/message-templates/${encodeURIComponent(resolvedTopic)}/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      return `Dear Parent,\n\nWe would like to bring to your attention an important matter regarding ${topicKey}.\n\n[Please add your specific message here]\n\nThank you.\n\nRegards,\n[School Name] Administration`;
    }
    const data = await res.json() as { body: string };
    return fillPlaceholders(data.body, { topic: topicKey, ...params });
  }
}

import pRetry from 'p-retry';
import { formatTicketNumber } from '@shared/support-utils';

const FRESHDESK_DOMAIN = (process.env.FRESHDESK_DOMAIN || '').trim();
const FRESHDESK_API_KEY = (process.env.FRESHDESK_API_KEY || '').trim();

const getBaseUrl = () => {
  let domain = FRESHDESK_DOMAIN;
  if (domain.includes('.freshdesk.com')) {
    domain = domain.replace('.freshdesk.com', '').replace(/^https?:\/\//, '');
  }
  domain = domain.trim();
  return `https://${domain}.freshdesk.com/api/v2`;
};

const getAuthHeader = () => {
  const credentials = Buffer.from(`${FRESHDESK_API_KEY}:X`).toString('base64');
  return `Basic ${credentials}`;
};

export interface FreshdeskTicket {
  id: number;
  subject: string;
  description: string;
  description_text?: string;
  status: number;
  priority: number;
  source: number;
  requester_id?: number;
  email?: string;
  created_at: string;
  updated_at: string;
  custom_fields?: Record<string, any>;
  tags?: string[];
}

export interface CreateTicketInput {
  email: string;
  name?: string;
  subject: string;
  description: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  channel?: 'web' | 'telegram' | 'discord' | 'chatbot' | 'email';
  userId?: string;
}

export interface UpdateTicketInput {
  status?: 'open' | 'pending' | 'resolved' | 'closed' | 'in_progress';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedTo?: string | null;
}

const PRIORITY_MAP: Record<string, number> = {
  low: 1,
  normal: 2,  
  high: 3,
  urgent: 4,
};

const PRIORITY_REVERSE_MAP: Record<number, string> = {
  1: 'low',
  2: 'normal',
  3: 'high',
  4: 'urgent',
};

const STATUS_MAP: Record<string, number> = {
  open: 2,
  pending: 3,
  in_progress: 3,
  resolved: 4,
  closed: 5,
};

const STATUS_REVERSE_MAP: Record<number, string> = {
  2: 'open',
  3: 'pending',
  4: 'resolved',
  5: 'closed',
};

const SOURCE_MAP: Record<string, number> = {
  email: 1,
  web: 2,
  chatbot: 7,
  telegram: 9,
  discord: 9,
};

class FreshdeskService {
  private isConfigured(): boolean {
    return !!(FRESHDESK_DOMAIN && FRESHDESK_API_KEY);
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('Freshdesk is not configured. Please set FRESHDESK_DOMAIN and FRESHDESK_API_KEY.');
    }

    const url = `${getBaseUrl()}${endpoint}`;
    
    const response = await pRetry(
      async () => {
        const res = await fetch(url, {
          ...options,
          headers: {
            'Authorization': getAuthHeader(),
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
          throw new Error(`Rate limited. Retry after ${waitTime}ms`);
        }

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Freshdesk API error: ${res.status} - ${errorText}`);
        }

        if (res.status === 204) {
          return null as T;
        }

        return res.json() as T;
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 5000,
        onFailedAttempt: (error: any) => {
          console.warn(`Freshdesk API attempt ${error.attemptNumber} failed:`, error.message || error);
        },
      }
    );

    return response;
  }

  async createTicket(input: CreateTicketInput): Promise<{
    id: number;
    ticketNumber: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
  }> {
    const priority = PRIORITY_MAP[input.priority || 'normal'] || 2;
    const source = SOURCE_MAP[input.channel || 'web'] || 2;

    const tags: string[] = [];
    if (input.channel) {
      tags.push(`channel:${input.channel}`);
    }
    if (input.userId) {
      tags.push(`user:${input.userId}`);
    }
    tags.push('ironstrike');

    const ticket = await this.makeRequest<FreshdeskTicket>('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        name: input.name || input.email.split('@')[0],
        subject: input.subject,
        description: input.description,
        priority,
        source,
        status: 2,
        tags,
      }),
    });

    return {
      id: ticket.id,
      ticketNumber: formatTicketNumber(ticket.id),
      subject: ticket.subject,
      status: STATUS_REVERSE_MAP[ticket.status] || 'open',
      priority: PRIORITY_REVERSE_MAP[ticket.priority] || 'normal',
      createdAt: ticket.created_at,
    };
  }

  async getTickets(filters?: {
    status?: string;
    priority?: string;
    channel?: string;
  }): Promise<Array<{
    id: number;
    ticketNumber: string;
    email: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    channel: string;
    createdAt: string;
    updatedAt: string;
  }>> {
    let query = 'tag:ironstrike';
    
    if (filters?.status && STATUS_MAP[filters.status]) {
      query += ` AND status:${STATUS_MAP[filters.status]}`;
    }
    if (filters?.priority && PRIORITY_MAP[filters.priority]) {
      query += ` AND priority:${PRIORITY_MAP[filters.priority]}`;
    }

    const encodedQuery = encodeURIComponent(`"${query}"`);
    const response = await this.makeRequest<{ results: FreshdeskTicket[]; total: number }>(
      `/search/tickets?query=${encodedQuery}`
    );

    const tickets = response?.results || [];
    return tickets.map((ticket) => ({
      id: ticket.id,
      ticketNumber: formatTicketNumber(ticket.id),
      email: ticket.email || '',
      subject: ticket.subject,
      description: ticket.description_text || ticket.description || '',
      status: STATUS_REVERSE_MAP[ticket.status] || 'open',
      priority: PRIORITY_REVERSE_MAP[ticket.priority] || 'normal',
      channel: ticket.tags?.find(t => t.startsWith('channel:'))?.replace('channel:', '') || 'web',
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    }));
  }

  async getTicketsByEmail(email: string): Promise<Array<{
    id: number;
    ticketNumber: string;
    email: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    channel: string;
    createdAt: string;
    updatedAt: string;
  }>> {
    if (!email) return [];
    
    const query = `tag:ironstrike AND email:"${email}"`;
    const encodedQuery = encodeURIComponent(`"${query}"`);
    const response = await this.makeRequest<{ results: FreshdeskTicket[]; total: number }>(
      `/search/tickets?query=${encodedQuery}`
    );

    const tickets = response?.results || [];
    return tickets.map((ticket) => ({
      id: ticket.id,
      ticketNumber: formatTicketNumber(ticket.id),
      email: ticket.email || '',
      subject: ticket.subject,
      description: ticket.description_text || ticket.description || '',
      status: STATUS_REVERSE_MAP[ticket.status] || 'open',
      priority: PRIORITY_REVERSE_MAP[ticket.priority] || 'normal',
      channel: ticket.tags?.find((t: string) => t.startsWith('channel:'))?.replace('channel:', '') || 'web',
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    }));
  }

  async getTicketById(id: number): Promise<{
    id: number;
    ticketNumber: string;
    email: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    channel: string;
    createdAt: string;
    updatedAt: string;
  } | null> {
    try {
      const ticket = await this.makeRequest<FreshdeskTicket>(`/tickets/${id}`);
      
      return {
        id: ticket.id,
        ticketNumber: formatTicketNumber(ticket.id),
        email: ticket.email || '',
        subject: ticket.subject,
        description: ticket.description_text || ticket.description || '',
        status: STATUS_REVERSE_MAP[ticket.status] || 'open',
        priority: PRIORITY_REVERSE_MAP[ticket.priority] || 'normal',
        channel: ticket.tags?.find(t => t.startsWith('channel:'))?.replace('channel:', '') || 'web',
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async updateTicket(id: number, input: UpdateTicketInput): Promise<{
    id: number;
    ticketNumber: string;
    status: string;
    priority: string;
    updatedAt: string;
  }> {
    const updates: Record<string, any> = {};
    
    if (input.status && STATUS_MAP[input.status]) {
      updates.status = STATUS_MAP[input.status];
    }
    if (input.priority && PRIORITY_MAP[input.priority]) {
      updates.priority = PRIORITY_MAP[input.priority];
    }

    const ticket = await this.makeRequest<FreshdeskTicket>(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    return {
      id: ticket.id,
      ticketNumber: formatTicketNumber(ticket.id),
      status: STATUS_REVERSE_MAP[ticket.status] || 'open',
      priority: PRIORITY_REVERSE_MAP[ticket.priority] || 'normal',
      updatedAt: ticket.updated_at,
    };
  }

  async addReply(ticketId: number, body: string, isPrivate: boolean = false): Promise<void> {
    await this.makeRequest(`/tickets/${ticketId}/reply`, {
      method: 'POST',
      body: JSON.stringify({
        body,
        private: isPrivate,
      }),
    });
  }

  getStatus(): { configured: boolean; domain: string | null } {
    return {
      configured: this.isConfigured(),
      domain: FRESHDESK_DOMAIN || null,
    };
  }
}

export const freshdeskService = new FreshdeskService();

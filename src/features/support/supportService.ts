import { supabase } from '../../lib/supabase';
import { SupportTicket, TicketMessage } from '../../types';

export const fetchMyTickets = async (): Promise<SupportTicket[]> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Not authenticated. Please sign in again.');
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tickets:', error);
      // If table doesn't exist, return empty array
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.warn('Support tickets table may not exist');
        return [];
      }
      throw new Error(error.message || 'Failed to load tickets');
    }

    return (data || []) as SupportTicket[];
  } catch (error: any) {
    console.error('fetchMyTickets error:', error);
    throw error;
  }
};

export const fetchTicketMessages = async (ticketId: string): Promise<TicketMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('ticket_messages')
      .select(`
        *,
        profile:profiles!ticket_messages_user_id_fkey (
          id,
          full_name,
          email,
          avatar_url,
          role
        )
      `)
      .eq('ticket_id', ticketId)
      .eq('is_internal', false) // Students can't see internal notes
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        return [];
      }
      throw error;
    }

    return (data || []) as TicketMessage[];
  } catch (error) {
    console.error('fetchTicketMessages error:', error);
    return [];
  }
};

export const createTicket = async (
  subject: string,
  description: string,
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
): Promise<SupportTicket> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Not authenticated. Please sign in again.');
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        subject,
        description,
        priority,
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating ticket:', error);
      throw new Error(error.message || 'Failed to create ticket');
    }

    return data as SupportTicket;
  } catch (error: any) {
    console.error('createTicket error:', error);
    throw error;
  }
};

export const sendTicketMessage = async (
  ticketId: string,
  message: string
): Promise<TicketMessage> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('Not authenticated. Please sign in again.');
    }

    const { data, error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        user_id: user.id,
        message,
        is_internal: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      throw new Error(error.message || 'Failed to send message');
    }

    // Update ticket status to 'open' if it was closed/resolved (user is replying)
    await supabase
      .from('support_tickets')
      .update({ 
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .in('status', ['closed', 'resolved']);

    return data as TicketMessage;
  } catch (error: any) {
    console.error('sendTicketMessage error:', error);
    throw error;
  }
};

export const getTicketStatusColor = (status: string): string => {
  switch (status) {
    case 'open': return '#EAB308'; // Yellow
    case 'in_progress': return '#3B82F6'; // Blue
    case 'resolved': return '#22C55E'; // Green
    case 'closed': return '#6B7280'; // Gray
    default: return '#6B7280';
  }
};

export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'urgent': return '#EF4444'; // Red
    case 'high': return '#F97316'; // Orange
    case 'medium': return '#EAB308'; // Yellow
    case 'low': return '#22C55E'; // Green
    default: return '#6B7280';
  }
};

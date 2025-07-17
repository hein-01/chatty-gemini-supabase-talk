import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: number;
  content: string;
  is_ai: boolean;
  created_at: string;
  image_url?: string;
  user_id: string;
  conversation_id?: string;
  title?: string;
}

export const useChatHistory = (userId: string | undefined) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load chat history
  useEffect(() => {
    if (!userId) return;

    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to load chat history",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadMessages();

    // Set up real-time updates
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, toast]);

  // Save message to database
  const saveMessage = async (content: string, isAi: boolean = false, imageUrl?: string) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          content,
          is_ai: isAi,
          user_id: userId,
          image_url: imageUrl,
        })
        .select()
        .single();

      if (error) throw error;

      // Only update local state if real-time didn't already add it
      if (!messages.find(msg => msg.id === data.id)) {
        setMessages(prev => [...prev, data]);
      }

      return data;
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save message",
        variant: "destructive",
      });
    }
  };

  // Clear chat history
  const clearHistory = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      setMessages([]);
      toast({
        title: "Success",
        description: "Chat history cleared",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to clear chat history",
        variant: "destructive",
      });
    }
  };

  return {
    messages,
    loading,
    saveMessage,
    clearHistory,
  };
};
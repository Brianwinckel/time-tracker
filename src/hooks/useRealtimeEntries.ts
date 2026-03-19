// ============================================================
// Realtime subscription for time entries — used by Manager Dashboard
// Subscribes to INSERT/UPDATE/DELETE on time_entries for a team
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { TimeEntry } from '../types';

interface RealtimeEntry extends TimeEntry {
  userId: string;
}

// Map a Supabase row to our TimeEntry + userId
function mapRow(row: Record<string, unknown>): RealtimeEntry {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    taskName: row.task_name as string,
    date: row.date as string,
    startTime: row.start_time as string,
    endTime: (row.end_time as string) ?? null,
    duration: (row.duration_ms as number) ?? null,
    note: (row.note as string) ?? '',
    userId: row.user_id as string,
  };
}

export function useRealtimeEntries(date: string, teamUserIds: string[]) {
  const [entries, setEntries] = useState<RealtimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial fetch
  const fetchEntries = useCallback(async () => {
    if (teamUserIds.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .in('user_id', teamUserIds)
      .eq('date', date)
      .order('start_time');

    if (error) {
      console.error('Failed to fetch team entries:', error.message);
      setLoading(false);
      return;
    }

    setEntries((data ?? []).map(mapRow));
    setLoading(false);
  }, [date, teamUserIds]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Realtime subscription
  useEffect(() => {
    if (teamUserIds.length === 0) return;

    const channel = supabase
      .channel('team-entries')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
        },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;

          if (eventType === 'INSERT') {
            const entry = mapRow(newRow as Record<string, unknown>);
            if (teamUserIds.includes(entry.userId)) {
              setEntries(prev => [...prev, entry]);
            }
          } else if (eventType === 'UPDATE') {
            const entry = mapRow(newRow as Record<string, unknown>);
            if (teamUserIds.includes(entry.userId)) {
              setEntries(prev =>
                prev.map(e => e.id === entry.id ? entry : e)
              );
            }
          } else if (eventType === 'DELETE') {
            const id = (oldRow as Record<string, unknown>).id as string;
            setEntries(prev => prev.filter(e => e.id !== id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamUserIds]);

  return { entries, loading, refetch: fetchEntries };
}

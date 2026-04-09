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
    projectId: (row.project_id as string) ?? null,
    valueCategory: (row.value_category as string) ?? null,
    workStyle: (row.work_style as string) ?? null,
    outputType: (row.output_type as string) ?? null,
    sessionStatus: (row.session_status as string) ?? 'In Progress',
    isCompleted: (row.is_completed as boolean) ?? false,
    completionNote: (row.completion_note as string) ?? '',
    nextSteps: (row.next_steps as string) ?? '',
    blockedBy: (row.blocked_by as string) ?? '',
    carryForward: (row.carry_forward as boolean) ?? false,
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
      .channel(`team-entries-${teamUserIds.sort().join('-').slice(0, 50)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `user_id=in.(${teamUserIds.join(',')})`,
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
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [teamUserIds]);

  return { entries, loading, refetch: fetchEntries };
}

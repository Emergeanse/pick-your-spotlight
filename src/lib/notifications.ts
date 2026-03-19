import { supabase } from "@/integrations/supabase/client";

export async function sendNotification(
  userId: string,
  type: string,
  title: string,
  body?: string,
  data?: Record<string, any>
) {
  await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body: body || null,
    data: data || {},
  } as any);
}

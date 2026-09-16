import { supabase } from '@/lib/supabase';

export type DepotClient = {
  id: string;
  depot_id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  zone?: string | null;
  payment_terms?: string | null;
  linked_establishment_id?: string | null;
  balance?: number | null;
  notes?: string | null;
  status?: string | null;
  created_at?: string;
};

export type DepotDelivery = {
  id: string;
  depot_id: string;
  client_id: string;
  status: string;
  delivery_date?: string | null;
  total_amount?: number | null;
  paid_amount?: number | null;
  payment_method?: string | null;
  driver_name?: string | null;
  note?: string | null;
  delivered_at?: string | null;
  created_at?: string;
  depot_clients?: { name?: string; phone?: string | null } | null;
};

export type DepotDeliveryItem = {
  id?: string;
  delivery_id?: string;
  product_id?: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  prepared: 'Préparée',
  in_transit: 'En route',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

export async function listDepotClients(depotId: string): Promise<DepotClient[]> {
  const { data, error } = await supabase
    .from('depot_clients')
    .select('*')
    .eq('depot_id', depotId)
    .order('name');
  if (error) {
    console.error('listDepotClients', error);
    return [];
  }
  return (data || []) as DepotClient[];
}

export async function upsertDepotClient(
  payload: Partial<DepotClient> & { depot_id: string; name: string }
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (payload.id) {
    const { error } = await supabase.from('depot_clients').update(payload).eq('id', payload.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: payload.id };
  }
  const { data, error } = await supabase.from('depot_clients').insert(payload).select('id').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

export async function listDepotDeliveries(depotId: string): Promise<DepotDelivery[]> {
  const { data, error } = await supabase
    .from('depot_deliveries')
    .select('*, depot_clients(name, phone)')
    .eq('depot_id', depotId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('listDepotDeliveries', error);
    return [];
  }
  return (data || []) as DepotDelivery[];
}

export async function listDeliveryItems(deliveryId: string): Promise<DepotDeliveryItem[]> {
  const { data, error } = await supabase
    .from('depot_delivery_items')
    .select('*')
    .eq('delivery_id', deliveryId);
  if (error) return [];
  return (data || []) as DepotDeliveryItem[];
}

export async function createDepotDelivery(input: {
  depot_id: string;
  client_id: string;
  items: DepotDeliveryItem[];
  payment_method?: string;
  paid_amount?: number;
  driver_name?: string;
  note?: string;
  status?: string;
  created_by?: string | null;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const total = input.items.reduce((s, i) => s + (Number(i.line_total) || Number(i.qty) * Number(i.unit_price) || 0), 0);
  const { data: del, error } = await supabase
    .from('depot_deliveries')
    .insert({
      depot_id: input.depot_id,
      client_id: input.client_id,
      status: input.status || 'prepared',
      total_amount: total,
      paid_amount: input.paid_amount ?? 0,
      payment_method: input.payment_method || 'cash',
      driver_name: input.driver_name || null,
      note: input.note || null,
      created_by: input.created_by || null,
      delivery_date: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single();
  if (error || !del?.id) return { ok: false, error: error?.message || 'Création impossible' };

  const rows = input.items.map((i) => ({
    delivery_id: del.id,
    product_id: i.product_id || null,
    product_name: i.product_name,
    qty: Number(i.qty) || 0,
    unit_price: Number(i.unit_price) || 0,
    line_total: Number(i.line_total) || Number(i.qty) * Number(i.unit_price) || 0,
  }));
  const { error: ie } = await supabase.from('depot_delivery_items').insert(rows);
  if (ie) return { ok: false, error: ie.message };
  return { ok: true, id: del.id };
}

export async function setDeliveryStatus(id: string, status: string): Promise<{ ok: boolean; error?: string }> {
  if (status === 'delivered') {
    const { data, error } = await supabase.rpc('confirm_depot_delivery', { p_delivery_id: id });
    if (error) return { ok: false, error: error.message };
    if (data && (data as { ok?: boolean }).ok === false) {
      return { ok: false, error: 'Confirmation refusée' };
    }
    return { ok: true };
  }
  const { error } = await supabase.from('depot_deliveries').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listMaquisEstablishments(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('establishments')
    .select('id, name, type')
    .in('type', ['maquis', 'restaurant', 'bar'])
    .order('name')
    .limit(200);
  if (error) return [];
  return (data || []).map((e: { id: string; name: string }) => ({ id: e.id, name: e.name }));
}

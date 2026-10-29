import { supabase } from './supabase'

export async function savePredictionSummary(result) {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { error } = await supabase.from('prediction_history').insert({
    predicted_class: result.predicted_class,
    model_version: result.model_version,
  })
  if (error) throw error
}

export async function getPredictionHistory() {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('prediction_history')
    .select('id, created_at, predicted_class, model_version')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data
}

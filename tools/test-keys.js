import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY?.slice(0, 20) + '...');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY?.slice(0, 20) + '...');

console.log('\nTesting Anthropic...');
try {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'say hi' }],
  });
  console.log('✅ Anthropic OK:', msg.content[0].text);
} catch (e) {
  console.error('❌ Anthropic error:', e.message);
  console.error('   Full error:', e);
}

console.log('\nTesting Supabase...');
try {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { global: { fetch } }
  );
  const { data, error } = await supabase.from('tags').select('name').limit(1);
  if (error) throw error;
  console.log('✅ Supabase OK:', data);
} catch (e) {
  console.error('❌ Supabase error:', e.message);
}

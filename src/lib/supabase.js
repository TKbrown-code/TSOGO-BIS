import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL 
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

// Queue auth operations across tabs instead of failing immediately when a
// refresh tick overlaps session initialization or another auth operation.
const authOptions = typeof navigator !== "undefined" && navigator.locks?.request
  ? {
      auth: {
        lock: (name, _acquireTimeout, operation) =>
          navigator.locks.request(name, { mode: "exclusive" }, operation),
      },
    }
  : undefined;

export const supabase = createClient(supabaseUrl, supabaseKey, authOptions);


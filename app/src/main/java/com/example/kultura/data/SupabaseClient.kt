package com.example.kultura.data

import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime

object SupabaseConfig {
    const val URL = "https://knphmxxokowwkruimdus.supabase.co"
    const val ANON_KEY = "sb_publishable_9b7WSJF4UlfF1JIdCDjWqQ_dxOTpqSW"
}

val supabase = createSupabaseClient(
    supabaseUrl = SupabaseConfig.URL,
    supabaseKey = SupabaseConfig.ANON_KEY
) {
    install(Postgrest)
    install(Realtime)
}

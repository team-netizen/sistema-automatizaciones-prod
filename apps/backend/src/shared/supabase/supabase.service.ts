import { Injectable, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import supabaseConfig from '../../config/supabase.config';

@Injectable()
export class SupabaseService {
    private client: SupabaseClient;
    private adminClient: SupabaseClient;

    constructor(
        @Inject(supabaseConfig.KEY)
        private readonly config: ConfigType<typeof supabaseConfig>,
    ) {
        this.client = createClient(config.url, config.key);
        this.adminClient = createClient(config.url, config.serviceRoleKey);
    }

    getClient() {
        return this.client;
    }

    getAdminClient() {
        return this.adminClient;
    }
}

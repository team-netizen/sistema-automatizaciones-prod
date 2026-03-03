import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
    try {
        const { data: perfiles, error } = await supabaseAdmin
            .from('perfiles')
            .select('*');

        return NextResponse.json({ perfiles, error });
    } catch (err: any) {
        return NextResponse.json({ error: err.message });
    }
}

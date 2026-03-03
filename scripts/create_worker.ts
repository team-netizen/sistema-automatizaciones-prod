
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno desde el backend
dotenv.config({ path: path.resolve('d:/Pry-Sistema de Automatizaciones/apps/backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function createWorkerAccount() {
    const email = 'trabajador_distinto@gmail.com';
    const password = 'Trabajador123!';
    const companyId = 'f6f253cd-2143-4e4f-b755-320501ade7d9'; // Distinto Tech

    console.log(`Intentando crear cuenta para ${email}...`);

    // 1. Crear usuario en Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
    });

    if (authError) {
        if (authError.message.includes('already registered')) {
            console.log('El usuario ya existe en Auth. Procediendo a verificar perfil...');
            // Intentar recuperar el ID
            const { data: users } = await supabase.auth.admin.listUsers();
            const existingUser = users.users.find(u => u.email === email);
            if (existingUser) {
                await setupProfile(existingUser.id, companyId, email);
            }
        } else {
            console.error('Error creando usuario en Auth:', authError.message);
        }
        return;
    }

    if (authUser.user) {
        console.log(`Usuario creado en Auth con ID: ${authUser.user.id}`);
        await setupProfile(authUser.user.id, companyId, email);
    }
}

async function setupProfile(userId: string, companyId: string, email: string) {
    // 2. Insertar/Actualizar perfil
    const { error: profileError } = await supabase
        .from('perfiles')
        .upsert({
            id: userId,
            empresa_id: companyId,
            rol: 'operador'
        });

    if (profileError) {
        console.error('Error al configurar el perfil:', profileError.message);
    } else {
        console.log(`Perfil configurado exitosamente para ${email} (Rol: operador)`);
    }
}

createWorkerAccount();

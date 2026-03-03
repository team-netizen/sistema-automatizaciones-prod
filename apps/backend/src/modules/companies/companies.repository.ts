import { Injectable } from '@nestjs/common';

@Injectable()
export class CompaniesRepository {
  // Implementación de acceso a la base de datos (Supabase)
  async findById(id: string, company_id: string) {
    // throw new Error('Not implemented');
    return null;
  }
}

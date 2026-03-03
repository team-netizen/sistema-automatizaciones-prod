export interface Company {
    id: string;
    company_id: string;
    name: string;
    status: 'active' | 'suspended';
    created_at: Date;
}

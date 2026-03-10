import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SupabaseModule } from '../../shared/supabase/supabase.module';
import { MercadoLibreController } from './mercadolibre.controller';
import { MercadoLibreService } from './mercadolibre.service';
import { WooCommerceClient } from './woocommerce/woocommerce.client';
import { WooCommerceController } from './woocommerce/woocommerce.controller';
import { WooCommerceProcessor } from './woocommerce/woocommerce.processor';
import { WooCommerceScheduler } from './woocommerce/woocommerce.scheduler';
import { WooCommerceSyncService } from './woocommerce/woocommerce.sync.service';

@Module({
  imports: [
    SupabaseModule,
    BullModule.registerQueue({ name: 'woocommerce-sync' }),
  ],
  controllers: [WooCommerceController, MercadoLibreController],
  providers: [
    WooCommerceClient,
    WooCommerceSyncService,
    WooCommerceProcessor,
    WooCommerceScheduler,
    MercadoLibreService,
  ],
  exports: [WooCommerceSyncService],
})
export class IntegracionesModule {}

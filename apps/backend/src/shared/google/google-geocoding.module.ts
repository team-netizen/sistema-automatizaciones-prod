import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import googleConfig from '../../config/google.config';
import { GoogleGeocodingService } from './google-geocoding.service';

@Global()
@Module({
    imports: [ConfigModule.forFeature(googleConfig)],
    providers: [GoogleGeocodingService],
    exports: [GoogleGeocodingService],
})
export class GoogleGeocodingModule { }

import { registerAs } from '@nestjs/config';

export default registerAs('google', () => ({
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
}));

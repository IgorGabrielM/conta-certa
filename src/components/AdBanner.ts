import { Platform } from 'react-native';

// O TypeScript lê as exportações e o Metro escolhe a plataforma correta
import AdBannerNative from './AdBanner.native';
import AdBannerWeb from './AdBanner.web';

const AdBanner = Platform.OS === 'web' ? undefined : AdBannerNative;

export default AdBanner;
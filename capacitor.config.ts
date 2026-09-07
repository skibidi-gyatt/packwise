import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'app.packwise.cargo',
  appName: 'Packwise Cargo',
  webDir: 'mobile-dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#f3f5f7',
    preferredContentMode: 'mobile',
  },
  backgroundColor: '#f3f5f7',
};
export default config;

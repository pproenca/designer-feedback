import { defineAppConfig } from '#imports';

declare module 'wxt/utils/define-app-config' {
  export interface WxtAppConfig {
    debug: boolean;
    apiEndpoint?: string;
  }
}

export default defineAppConfig({
  debug: import.meta.env.MODE === 'development',
  apiEndpoint: import.meta.env.WXT_API_ENDPOINT,
});

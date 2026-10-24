export {};

declare global {
  interface Window {
    electron?: {
      saveFile: (args: {
        defaultPath?: string;
        filters?: { name: string; extensions: string[] }[];
        data: string;
        encoding: 'base64' | 'utf8';
      }) => Promise<{
        canceled: boolean;
        filePath?: string;
      }>;
      platform: string;
    };
  }
}

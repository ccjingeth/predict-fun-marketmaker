declare module '@polymarket/clob-client' {
  export interface ApiKeyCredentials {
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
  }

  export interface OrderRequest {
    tokenId: string;
    price: number;
    side: 'BUY' | 'SELL';
    size: number;
  }

  export class ClobClient {
    constructor(host: string, chainId: number, signer: any);
    createOrDeriveApiKey(): Promise<ApiKeyCredentials>;
    createOrder(order: OrderRequest): Promise<any>;
    postOrder(order: any, creds: ApiKeyCredentials): Promise<any>;
  }
}

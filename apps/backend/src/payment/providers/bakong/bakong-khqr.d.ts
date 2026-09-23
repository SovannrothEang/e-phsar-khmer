/**
 * `bakong-khqr` ships no type declarations of its own — this covers only
 * the surface `CreateTransactionHandler` calls, verified against the SDK's
 * own source in `node_modules`, not published docs.
 */
declare module 'bakong-khqr' {
  export interface BakongKhqrStatus {
    /** 0 on success, 1 on error — see `src/model/response.js`'s `KHQRResponse`. */
    code: number;
    errorCode: number | null;
    message: string | null;
  }

  export interface BakongKhqrData {
    qr: string;
    md5: string;
  }

  export interface BakongKhqrGenerateResult {
    status: BakongKhqrStatus;
    data: BakongKhqrData | null;
  }

  export const khqrData: {
    currency: { usd: number; khr: number };
    merchantType: { merchant: string; individual: string };
  };

  export interface MerchantInfoOptions {
    currency?: number;
    amount?: number;
    billNumber?: string;
    storeLabel?: string;
    terminalLabel?: string;
    mobileNumber?: string;
    purposeOfTransaction?: string;
    /**
     * Required whenever `amount` is set — generateKHQR throws
     * EXPIRATION_TIMESTAMP_REQUIRED otherwise (any KHQR carrying an amount
     * is a "dynamic" QR, per `src/controller/generateKHQR.js`).
     */
    expirationTimestamp?: number;
    merchantCategoryCode?: string | number;
  }

  export class MerchantInfo {
    constructor(
      bakongAccountID: string,
      merchantName: string,
      merchantCity: string,
      merchantID: string,
      acquiringBank: string,
      optional?: MerchantInfoOptions,
    );
  }

  /**
   * Same optional fields as `MerchantInfoOptions` — `IndividualInfo` is
   * `MerchantInfo`'s superclass in the SDK (`src/model/information.js`) and
   * shares its `optional` shape verbatim. The one difference: `acquiringBank`
   * is optional here (folded into `optional`), never a required positional
   * arg — an individual KHQR needs no registered acquiring bank at all.
   */
  export interface IndividualInfoOptions extends MerchantInfoOptions {
    acquiringBank?: string;
  }

  export class IndividualInfo {
    constructor(
      bakongAccountID: string,
      merchantName: string,
      merchantCity: string,
      optional?: IndividualInfoOptions,
    );
  }

  export class BakongKHQR {
    generateMerchant(merchantInfo: MerchantInfo): BakongKhqrGenerateResult;
    generateIndividual(
      individualInfo: IndividualInfo,
    ): BakongKhqrGenerateResult;
  }
}

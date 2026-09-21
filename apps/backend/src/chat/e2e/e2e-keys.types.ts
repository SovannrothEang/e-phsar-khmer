export interface E2eKeyBundle {
  identityKey: string;
  identitySigningKey: string;
  registrationId: number;
  signedPrekeyId: number;
  signedPrekeyPublic: string;
  signedPrekeySignature: string;
  oneTimePrekey: { prekeyId: number; publicKey: string } | null;
}

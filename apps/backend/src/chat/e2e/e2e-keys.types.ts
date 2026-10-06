export interface E2eKeyBundle {
  identityKey: string;
  identitySigningKey: string;
  registrationId: number;
  signedPrekeyId: number;
  signedPrekeyPublic: string;
  signedPrekeySignature: string;
  oneTimePrekey: { prekeyId: number; publicKey: string } | null;
}

/** v2: a bundle for one specific device of `userId`. */
export interface E2eDeviceBundle extends E2eKeyBundle {
  deviceId: string;
  userId: string;
}

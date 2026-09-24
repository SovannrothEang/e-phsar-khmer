/** JWT `typ` claim marking a chat WebSocket ticket (see ChatController.issueWsTicket). */
export const WS_TICKET_TYP = 'ws';

/** Long enough for one handshake over a slow tunnel; a reconnect fetches a new one. */
export const WS_TICKET_TTL_SECONDS = 60;

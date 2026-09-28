/** Group replies that only the asker and the bot can see. */

export type EphemeralTarget = {
  receiverUserId: number;
  ephemeralMessageId?: number;
  callbackQueryId?: string;
};

export function isGroupChat(type: string | undefined): boolean {
  return type === "group" || type === "supergroup";
}

/**
 * Fields to merge into sendMessage / sendRichMessage.
 * A follow-up to an ephemeral command replies to that message.
 * A callback on a public group message is replaced for that user only.
 */
export function ephemeralSendExtra(e?: EphemeralTarget): Record<string, unknown> {
  if (!e) return {};
  const params: Record<string, unknown> = { receiver_user_id: e.receiverUserId };
  const extra: Record<string, unknown> = {};
  if (e.ephemeralMessageId) {
    extra.reply_parameters = { ephemeral_message_id: e.ephemeralMessageId };
  } else if (e.callbackQueryId) {
    params.callback_query_id = e.callbackQueryId;
    params.replace_callback_query_message = true;
  }
  extra.ephemeral_message_parameters = params;
  return extra;
}

export function packEphemeral(
  e: EphemeralTarget | undefined,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const eph = ephemeralSendExtra(e);
  if (!eph.ephemeral_message_parameters) return extra;
  return {
    ...extra,
    ...eph,
    reply_parameters: eph.reply_parameters ?? extra.reply_parameters,
  };
}

import { expect, test } from "bun:test";
import { ephemeralSendExtra, isGroupChat } from "./ephemeral";

test("group types are the ones that can hide a reply", () => {
  expect(isGroupChat("group")).toBe(true);
  expect(isGroupChat("supergroup")).toBe(true);
  expect(isGroupChat("private")).toBe(false);
  expect(isGroupChat("channel")).toBe(false);
});

test("an ephemeral command is answered by replying to it", () => {
  const extra = ephemeralSendExtra({ receiverUserId: 7, ephemeralMessageId: 42 });
  expect(extra.reply_parameters).toEqual({ ephemeral_message_id: 42 });
  expect(extra.ephemeral_message_parameters).toEqual({ receiver_user_id: 7 });
});

test("a public group button is replaced for that user only", () => {
  const extra = ephemeralSendExtra({ receiverUserId: 7, callbackQueryId: "cq" });
  expect(extra.reply_parameters).toBeUndefined();
  expect(extra.ephemeral_message_parameters).toEqual({
    receiver_user_id: 7,
    callback_query_id: "cq",
    replace_callback_query_message: true,
  });
});

/**
 * Group consecutive image-only messages from the same sender.
 *
 * A message qualifies for grouping when:
 * - It has `imageUrl` and no `body`
 * - The next message is from the same sender and also image-only
 * - They share the same `groupId` (primary) or are within `MAX_GAP_MS` (fallback)
 *
 * Non-image messages and standalone images are returned as single-item groups.
 */

import type { ThreadMessage } from "@/types/chat";

const MAX_GAP_MS = 5 * 60 * 1000; // 5 minutes

export interface ImageGroup {
  kind: "image-group";
  messages: ThreadMessage[];
  senderId: string;
}

export interface SingleMessage {
  kind: "single";
  message: ThreadMessage;
}

export type MessageNode = ImageGroup | SingleMessage;

function isImageOnly(m: ThreadMessage): boolean {
  return !!m.imageUrl && !m.body;
}

function shouldGroup(a: ThreadMessage, b: ThreadMessage): boolean {
  if (a.senderId !== b.senderId) return false;
  if (!isImageOnly(a) || !isImageOnly(b)) return false;
  // Prefer groupId matching when both have it.
  if (a.groupId && b.groupId) return a.groupId === b.groupId;
  // Fallback: time-based proximity.
  const gap =
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return gap <= MAX_GAP_MS;
}

export function groupImageMessages(
  messages: ThreadMessage[],
): MessageNode[] {
  const nodes: MessageNode[] = [];
  let i = 0;

  while (i < messages.length) {
    const current = messages[i];

    // Start collecting a group if this is an image-only message.
    if (isImageOnly(current)) {
      const group: ThreadMessage[] = [current];
      let j = i + 1;

      // Collect consecutive image-only messages from same sender that should group.
      while (j < messages.length) {
        const next = messages[j];
        if (shouldGroup(current, next)) {
          group.push(next);
          j++;
        } else {
          break;
        }
      }

      // Only create a group if 2+ images; otherwise single.
      if (group.length >= 2) {
        nodes.push({
          kind: "image-group",
          messages: group,
          senderId: current.senderId,
        });
      } else {
        nodes.push({ kind: "single", message: current });
      }

      i = j;
    } else {
      nodes.push({ kind: "single", message: current });
      i++;
    }
  }

  return nodes;
}

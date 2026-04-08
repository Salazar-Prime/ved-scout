import { setDoc, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import { collection, doc, getDocs, deleteDoc, query } from "firebase/firestore";
import { collections } from "./firestore";
import { firebaseSafeChatDocument } from "./chatSave/savedChatRecord";
import type {
  SavedFlightScriptChatRecord,
  SavedFlightScriptChatMessage,
} from "./flightScriptSavedChatsStorage";

/**
 * Recursively strips `undefined` values from any plain object/array so that
 * Firestore never sees them (it throws "Unsupported field value: undefined").
 */
function deepStripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deepStripUndefined);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = deepStripUndefined(v);
      }
    }
    return out;
  }
  return value;
}

export async function uploadSavedFlightScriptChatToFirebase(
  record: SavedFlightScriptChatRecord,
): Promise<void> {
  console.log("[Firebase] uploadSavedFlightScriptChatToFirebase — start", {
    id: record.id,
    chatName: record.chatName,
    messageCount: record.messages.length,
    collection: collections.flightScriptSavedChats,
    projectId: db.app.options.projectId,
  });

  const rawDoc = firebaseSafeChatDocument(record);
  const sanitizedDoc = deepStripUndefined(rawDoc) as Record<string, unknown>;

  console.log("[Firebase] document to write (sanitized):", sanitizedDoc);

  try {
    const ref = doc(db, collections.flightScriptSavedChats, record.id);
    console.log("[Firebase] docRef path:", ref.path);
    await setDoc(ref, sanitizedDoc);
    console.log("[Firebase] setDoc succeeded for id:", record.id);
  } catch (err) {
    console.error("[Firebase] setDoc FAILED:", err);
    throw err;
  }
}

export async function fetchSavedFlightScriptChatsFromFirebase(): Promise<
  SavedFlightScriptChatRecord[]
> {
  const q = query(
    collection(db, collections.flightScriptSavedChats),
    orderBy("savedAt", "desc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      if (
        typeof data.chatName !== "string" ||
        typeof data.noteMessage !== "string" ||
        typeof data.savedAt !== "string" ||
        !Array.isArray(data.messages)
      ) {
        return null;
      }
      const messages = (data.messages as unknown[])
        .filter(
          (m): m is SavedFlightScriptChatMessage =>
            m != null &&
            typeof m === "object" &&
            typeof (m as Record<string, unknown>).id === "string" &&
            typeof (m as Record<string, unknown>).content === "string" &&
            typeof (m as Record<string, unknown>).timestamp === "string" &&
            ((m as Record<string, unknown>).role === "user" ||
              (m as Record<string, unknown>).role === "assistant"),
        );
      if (messages.length === 0) return null;
      return {
        id: d.id,
        chatName: data.chatName,
        noteMessage: data.noteMessage,
        savedAt: data.savedAt,
        messages,
      } satisfies SavedFlightScriptChatRecord;
    })
    .filter((r): r is SavedFlightScriptChatRecord => r !== null);
}

export async function deleteSavedFlightScriptChatFromFirebase(
  docId: string,
): Promise<void> {
  await deleteDoc(doc(db, collections.flightScriptSavedChats, docId));
}

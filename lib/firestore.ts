import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  DocumentData,
  QueryConstraint,
  WithFieldValue,
  UpdateData,
} from "firebase/firestore";
import { db } from "./firebase";

// ---------------------------------------------------------------------------
// Collection names – one per page / feature area
// ---------------------------------------------------------------------------
export const collections = {
  plots: "plots",
  flightHistory: "flightHistory",
  liveMissions: "liveMissions",
  missionTypes: "missionTypes",
  voiceCommands: "voiceCommands",
  cameraSensors: "cameraSensors",
} as const;

export type CollectionName = (typeof collections)[keyof typeof collections];

// ---------------------------------------------------------------------------
// Generic CRUD helpers
// ---------------------------------------------------------------------------

/** Get a reference to a collection */
export function getCollectionRef(collectionName: CollectionName) {
  return collection(db, collectionName);
}

/** Get a reference to a single document */
export function getDocRef(collectionName: CollectionName, docId: string) {
  return doc(db, collectionName, docId);
}

/** Fetch all documents in a collection (with optional query constraints) */
export async function fetchCollection<T = DocumentData>(
  collectionName: CollectionName,
  ...constraints: QueryConstraint[]
) {
  const ref = getCollectionRef(collectionName);
  const q = constraints.length ? query(ref, ...constraints) : query(ref);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T & { id: string });
}

/** Fetch a single document by ID */
export async function fetchDoc<T = DocumentData>(
  collectionName: CollectionName,
  docId: string,
) {
  const ref = getDocRef(collectionName, docId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as T & { id: string };
}

/** Add a new document (auto-generated ID) */
export async function addDocument<T extends DocumentData>(
  collectionName: CollectionName,
  data: WithFieldValue<T>,
) {
  const ref = getCollectionRef(collectionName);
  const docRef = await addDoc(ref, data);
  return docRef.id;
}

/** Update an existing document */
export async function updateDocument<T extends DocumentData>(
  collectionName: CollectionName,
  docId: string,
  data: UpdateData<T>,
) {
  const ref = getDocRef(collectionName, docId);
  await updateDoc(ref, data);
}

/** Delete a document */
export async function deleteDocument(
  collectionName: CollectionName,
  docId: string,
) {
  const ref = getDocRef(collectionName, docId);
  await deleteDoc(ref);
}

// Re-export commonly used Firestore query helpers for convenience
export { where, orderBy, limit };

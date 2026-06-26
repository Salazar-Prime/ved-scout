import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").trim();
      process.env[key.trim()] = value;
    }
  });
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function downloadConfig() {
  console.log("📥 Downloading configuration from Firebase...");

  const plotsSnapshot = await getDocs(collection(db, "plots"));
  const plots = plotsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const missionTypesSnapshot = await getDocs(collection(db, "missionTypes"));
  const missionTypes = missionTypesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const cameraSensorsSnapshot = await getDocs(collection(db, "cameraSensors"));
  const cameraSensors = cameraSensorsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const config = {
    plots,
    missionTypes,
    cameraSensors,
    exportedAt: new Date().toISOString(),
  };

  console.log(`✅ Downloaded ${plots.length} plots`);
  console.log(`✅ Downloaded ${missionTypes.length} mission types`);
  console.log(`✅ Downloaded ${cameraSensors.length} camera sensors`);

  return config;
}

async function saveConfig(config, filename) {
  const configDir = path.join(__dirname, "..", "config");

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const filepath = path.join(configDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(config, null, 2), "utf-8");

  console.log(`💾 Configuration saved to: ${filepath}`);
}

async function loadConfig(filename) {
  const filepath = path.join(__dirname, "..", "config", filename);

  if (!fs.existsSync(filepath)) {
    console.error(`❌ Configuration file not found: ${filepath}`);
    return null;
  }

  const data = fs.readFileSync(filepath, "utf-8");
  const config = JSON.parse(data);

  console.log(`📂 Loaded configuration from: ${filepath}`);
  console.log(`   - ${config.plots.length} plots`);
  console.log(`   - ${config.missionTypes.length} mission types`);
  console.log(`   - ${config.cameraSensors.length} camera sensors`);
  console.log(`   - Exported at: ${config.exportedAt}`);

  return config;
}

async function uploadConfig(config) {
  console.log("📤 Uploading configuration to Firebase...");

  for (const plot of config.plots) {
    const { id, ...plotData } = plot;
    await addDoc(collection(db, "plots"), plotData);
  }
  console.log(`✅ Uploaded ${config.plots.length} plots`);

  for (const missionType of config.missionTypes) {
    const { id, ...missionTypeData } = missionType;
    await addDoc(collection(db, "missionTypes"), missionTypeData);
  }
  console.log(`✅ Uploaded ${config.missionTypes.length} mission types`);

  for (const cameraSensor of config.cameraSensors) {
    const { id, ...cameraSensorData } = cameraSensor;
    await addDoc(collection(db, "cameraSensors"), cameraSensorData);
  }
  console.log(`✅ Uploaded ${config.cameraSensors.length} camera sensors`);

  console.log("✨ Upload complete!");
}

async function clearDatabase() {
  console.log("⚠️  WARNING: This will delete ALL data from Firebase!");
  const confirm = await question(
    "Are you sure you want to clear the database? (yes/no): "
  );

  if (confirm.toLowerCase() !== "yes") {
    console.log("❌ Operation cancelled");
    return;
  }

  console.log("🗑️  Clearing database...");

  const plotsSnapshot = await getDocs(collection(db, "plots"));
  for (const plotDoc of plotsSnapshot.docs) {
    await deleteDoc(doc(db, "plots", plotDoc.id));
  }
  console.log(`✅ Deleted ${plotsSnapshot.docs.length} plots`);

  const missionTypesSnapshot = await getDocs(collection(db, "missionTypes"));
  for (const missionDoc of missionTypesSnapshot.docs) {
    await deleteDoc(doc(db, "missionTypes", missionDoc.id));
  }
  console.log(`✅ Deleted ${missionTypesSnapshot.docs.length} mission types`);

  const cameraSensorsSnapshot = await getDocs(collection(db, "cameraSensors"));
  for (const cameraDoc of cameraSensorsSnapshot.docs) {
    await deleteDoc(doc(db, "cameraSensors", cameraDoc.id));
  }
  console.log(`✅ Deleted ${cameraSensorsSnapshot.docs.length} camera sensors`);

  console.log("✨ Database cleared successfully!");
}

async function listConfigs() {
  const configDir = path.join(__dirname, "..", "config");

  if (!fs.existsSync(configDir)) {
    console.log("📂 No config directory found");
    return;
  }

  const files = fs
    .readdirSync(configDir)
    .filter((file) => file.endsWith(".json"));

  if (files.length === 0) {
    console.log("📂 No configuration files found");
    return;
  }

  console.log("\n📂 Available configuration files:");
  files.forEach((file, index) => {
    const stats = fs.statSync(path.join(configDir, file));
    console.log(
      `   ${index + 1}. ${file} (${stats.size} bytes, ${stats.mtime.toLocaleString()})`
    );
  });
  console.log();
}

async function main() {
  console.log("🔥 Firebase Configuration Manager\n");

  try {
    while (true) {
      console.log("Available operations:");
      console.log("  1. Download config from Firebase");
      console.log("  2. Load config from file");
      console.log("  3. Upload config to Firebase");
      console.log("  4. Clear Firebase database");
      console.log("  5. List config files");
      console.log("  6. Exit");

      const choice = await question("\nSelect operation (1-6): ");

      switch (choice) {
        case "1": {
          const config = await downloadConfig();
          const filename = await question(
            "Enter filename to save (default: config-backup.json): "
          );
          await saveConfig(config, filename.trim() || "config-backup.json");
          break;
        }

        case "2": {
          await listConfigs();
          const filename = await question("Enter filename to load: ");
          const config = await loadConfig(filename.trim());
          if (config) {
            const upload = await question(
              "Upload this config to Firebase? (yes/no): "
            );
            if (upload.toLowerCase() === "yes") {
              await uploadConfig(config);
            }
          }
          break;
        }

        case "3": {
          await listConfigs();
          const filename = await question("Enter filename to upload: ");
          const config = await loadConfig(filename.trim());
          if (config) {
            await uploadConfig(config);
          }
          break;
        }

        case "4": {
          await clearDatabase();
          break;
        }

        case "5": {
          await listConfigs();
          break;
        }

        case "6": {
          console.log("👋 Goodbye!");
          rl.close();
          process.exit(0);
        }

        default:
          console.log("❌ Invalid choice. Please select 1-6.");
      }

      console.log("\n" + "─".repeat(50) + "\n");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    rl.close();
    process.exit(1);
  }
}

main();

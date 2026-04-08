# Firebase Configuration Manager

A command-line tool to manage your Firebase database configurations for VED-SCOUT.

## Features

- **Download**: Export current Firebase data to a JSON config file
- **Load**: Load a config file and optionally upload to Firebase
- **Upload**: Upload a config file to Firebase
- **Clear**: Delete all data from Firebase database
- **List**: View available config files

## Installation

No additional dependencies needed. The script uses Node.js and existing Firebase packages.

## Usage

Run the configuration manager:

```bash
pnpm config-manager
# or
npm run config-manager
```

### Interactive Menu

The script provides an interactive menu with these options:

1. **Download config from Firebase** - Exports all plots, mission types, and camera sensors to a JSON file
2. **Load config from file** - Reads a config file and optionally uploads to Firebase
3. **Upload config to Firebase** - Uploads a config file to Firebase
4. **Clear Firebase database** - Deletes all data (requires confirmation)
5. **List config files** - Shows all available config files in the config directory
6. **Exit** - Closes the tool

### Config File Format

Config files are stored in the `config/` directory and contain:

```json
{
  "plots": [...],
  "missionTypes": [...],
  "cameraSensors": [...],
  "exportedAt": "2026-03-09T02:00:00.000Z"
}
```

## Common Workflows

### Backup Current Configuration

1. Select option 1 (Download config from Firebase)
2. Enter a filename (e.g., `backup-2026-03-09.json`)

### Restore Configuration

1. Select option 2 (Load config from file)
2. Enter the filename to load
3. Confirm upload when prompted

### Clear and Start Fresh

1. Select option 4 (Clear Firebase database)
2. Type "yes" to confirm deletion
3. Optionally load a new config using option 2

## Notes

- Config files are stored in `config/` (ignored by git)
- The `.env.local` file must contain Firebase credentials
- Clearing the database requires typing "yes" exactly
- All operations provide confirmation messages

# OpenCode Browser Extension

This Chrome extension enables browser automation capabilities for OpenCode, allowing AI to interact with web pages directly.

## Installation

### 1. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select this `chrome-extension` folder

### 2. Copy Extension ID

After loading, copy the **ID** shown under the extension (32 lowercase letters, like `jlibopapjildodkmidhmadafepdbaecb`).

### 3. Install Native Messaging Host

```bash
# From the opencode repository root
bun run --cwd packages/opencode ./src/index.ts chrome install YOUR_EXTENSION_ID
```

### 4. Restart Chrome

Close all Chrome windows completely, then reopen Chrome.

### 5. Connect Extension

Click the OpenCode Browser extension icon in Chrome toolbar. This initiates the native messaging connection.

### 6. Verify Connection

```bash
bun run --cwd packages/opencode ./src/index.ts chrome status
```

You should see "Connected to Chrome extension" when the extension is active.

## Architecture

```
Chrome Extension ←→ Native Messaging ←→ Native Host (HTTP Server) ←→ OpenCode
                                         localhost:19875
```

1. **Extension** (`background.js`) - Handles browser automation commands
2. **Native Messaging** - Chrome's stdio-based communication protocol
3. **Native Host** - HTTP bridge server that OpenCode calls
4. **OpenCode** - Browser tools available when `browser_tools: true` in config

## Development

### Reload Extension

After changing extension files:
1. Go to `chrome://extensions`
2. Click the refresh icon on the OpenCode Browser extension

### View Extension Logs

1. Go to `chrome://extensions`
2. Click **Service Worker** under the extension
3. View console output in DevTools

### Test Native Host

```bash
# Run native host manually
bun run --cwd packages/opencode ./src/index.ts chrome native-host
```

### Test HTTP Bridge

When native host is running (after clicking extension icon):

```bash
# Check health
curl http://localhost:19875/health

# Ping extension
curl -X POST http://localhost:19875/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "ping", "params": {}}'
```

## Troubleshooting

### Extension Not Connecting

- Click the extension icon to initiate connection
- Check Service Worker logs for errors
- Verify manifest path in Chrome: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.opencode.browser.json`

### Native Host Not Starting

- Check the host script exists: `~/.opencode/chrome/native-host`
- Ensure it has execute permission: `chmod +x ~/.opencode/chrome/native-host`
- Verify bun is installed and in PATH

### HTTP Bridge Not Responding

The HTTP server only starts when Chrome spawns the native host. Click the extension icon first.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration |
| `background.js` | Service worker with browser tools |
| `content.js` | DOM interaction scripts |
| `icons/` | Extension icons |

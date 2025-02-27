# Brotwurst

A Chrome extension that detects and downloads media files from web pages.

## Installation for Development

1. Clone the repository:
   ```bash
   git clone https://github.com/ipai/brotwurst.git
   cd brotwurst
   ```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the extension directory

## Development

### Key Components

- **Media Detection**: Uses advanced parsing to find media elements and their sources
- **Size Detection**: Makes HEAD requests to determine file sizes when available
- **HLS Support**: Parses .m3u8 manifests to extract different quality variants
- **UI**: Modern interface with smooth animations and responsive design

### Local Development

1. Make changes to the source files
2. If you modify manifest.json, reload the extension in Chrome
3. For other files, just click the extension icon to load the new changes
4. Use Chrome DevTools to debug:
   - Right-click the extension icon and select "Inspect popup"
   - Check the console for logs and errors

### Testing

1. Test on various websites with different types of media
2. Verify file size detection works
3. Check HLS manifest parsing on streaming sites
4. Ensure the UI is responsive and animations are smooth
5. Verify downloads work correctly

### Packaging

```bash
zip -r brotwurst.zip . --exclude @.zipignore
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use and modify as needed.

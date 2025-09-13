# test-cssg

A static site built with [cSSG](https://jsr.io/@adityakurnias/cssg).

## Getting Started

```bash
# Install cSSG globally (if not already installed)
deno install -A --global --name cssg jsr:@adityakurnias/cssg

# Start development server
cssg dev

# Build for production
cssg build
```

## Project Structure

```
test-cssg/
├── cssg.config.ts      # Configuration file
├── deno.json           # Deno configuration
├── src/
│   ├── layouts/        # Layout templates
│   ├── pages/          # Page content
│   ├── assets/         # Static assets
│   └── data/           # Data files
└── dist/               # Built output (generated)
```

## Documentation

- [cSSG Documentation](https://jsr.io/@adityakurnias/cssg)
- [Eta Template Engine](https://eta.js.org/)
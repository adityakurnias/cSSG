# ccs

A static site built with [cSSG](https://jsr.io/@adityakurnias/cssg).

## Getting Started

```bash
# Install cSSG globally (if not already installed)
deno install -gA jsr:@adityakurnias/cssg

# Start development server
deno task dev
# or
cssg dev

# Build for production
deno task build
# or
cssg build
```

## Project Structure

```
ccs/
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
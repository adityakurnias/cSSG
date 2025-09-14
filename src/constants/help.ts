export const HELP_TEXT = `
cSSG - Simple Static Site Generator

USAGE:
  cssg <COMMAND>

COMMANDS:
  create <name>   Create a new cSSG project (recommended)
  build           Build the site for production
  dev             Start the development server
  list            List all available template
  version         Display version
    -v
  help            Display this message
    -h

CREATE OPTIONS:
  -f, --force      Overwrite existing directory
  -t, --template   Use a remote template from the official repository (default: basic)

EXAMPLES:
  cssg create my-blog
  cssg create my-blog -t counter --remote
  cssg dev         # start dev server
  cssg build       # build for production
`;

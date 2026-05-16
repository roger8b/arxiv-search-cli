#!/usr/bin/env node
// Backwards-compat shim. The real entry is src/index.ts (a Commander
// dispatcher). Importing it for side-effects runs the dispatcher.
import './src/index.js';

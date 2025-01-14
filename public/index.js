import { pb } from './pb.js';
import { pbHistory } from './pbHistory.js';
import { tokens } from './token.js';

pb.setupSocket();
pb.refreshPaintboard();
pbHistory.registerEvent();
tokens.registerEvent();

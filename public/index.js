import { pb } from './pb.js';
import { pbHistory } from './pbHistory.js';

pb.setupSocket();
pb.refreshPaintboard();
pbHistory.registerEvent();

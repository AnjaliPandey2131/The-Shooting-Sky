/* -------------------------------------------------------------
   SHOOTING STARS - Main Entry Point
   Initializes the game engine when the document is ready
   ------------------------------------------------------------- */

import { GameEngine } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
    const game = new GameEngine();
    game.startLoop();
});
